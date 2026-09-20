'use server'

import { createClient } from '@/lib/supabase/server'
import { canManageTeam, type Role } from '@/lib/permissions'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: appUser } = await supabase
    .from('app_users')
    .select('id, role, organization_id, branch_id')
    .eq('id', user.id)
    .single()

  return appUser
}

export async function getBranches() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, is_main, created_at')
    .eq('organization_id', current.organization_id)
    .order('is_main', { ascending: false })
    .order('name')

  if (error) return { error: error.message }
  return { branches: data, currentRole: current.role as Role, currentBranchId: current.branch_id }
}

export async function createBranch(name: string, address: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para crear sucursales.' }
  }

  const trimmed = name.trim()
  if (!trimmed) return { error: 'El nombre es obligatorio.' }

  const { error } = await supabase.from('branches').insert({
    organization_id: current.organization_id,
    name: trimmed,
    address: address.trim() || null,
    is_main: false,
  })

  if (error) return { error: error.message }

  revalidatePath('/branches')
  return { success: true }
}

export async function updateBranch(branchId: string, name: string, address: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para editar sucursales.' }
  }

  const { data: target } = await supabase
    .from('branches')
    .select('organization_id')
    .eq('id', branchId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Esa sucursal no pertenece a tu organización.' }
  }

  const { error } = await supabase
    .from('branches')
    .update({ name: name.trim(), address: address.trim() || null })
    .eq('id', branchId)

  if (error) return { error: error.message }

  revalidatePath('/branches')
  return { success: true }
}

export async function setMainBranch(branchId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para cambiar la sucursal principal.' }
  }

  const { data: target } = await supabase
    .from('branches')
    .select('organization_id')
    .eq('id', branchId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Esa sucursal no pertenece a tu organización.' }
  }

  await supabase
    .from('branches')
    .update({ is_main: false })
    .eq('organization_id', current.organization_id)

  const { error } = await supabase
    .from('branches')
    .update({ is_main: true })
    .eq('id', branchId)

  if (error) return { error: error.message }

  revalidatePath('/branches')
  return { success: true }
}

// Solo para owner/admin: elegir en qué sucursal están trabajando ahora mismo,
// sin cambiar su sucursal asignada permanente (app_users.branch_id).
export async function setActiveBranch(branchId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para cambiar de sucursal activa.' }
  }

  const { data: target } = await supabase
    .from('branches')
    .select('organization_id')
    .eq('id', branchId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Esa sucursal no pertenece a tu organización.' }
  }

  const cookieStore = await cookies()
  cookieStore.set('active_branch_id', branchId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  revalidatePath('/')
  return { success: true }
}