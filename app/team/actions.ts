'use server'

import { createClient } from '@/lib/supabase/server'
import { canManageTeam, type Role } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

async function getCurrentUserRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  return appUser
}

export async function getTeamMembers() {
  const supabase = await createClient()
  const current = await getCurrentUserRole()
  if (!current) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('app_users')
    .select('id, full_name, email, role, created_at')
    .eq('organization_id', current.organization_id)
    .order('created_at')

  if (error) return { error: error.message }
  return { members: data, currentRole: current.role as Role }
}

export async function updateMemberRole(memberId: string, newRole: Role) {
  const supabase = await createClient()
  const current = await getCurrentUserRole()

  if (!current) return { error: 'No autenticado' }

  // Verificación real de permiso — en el servidor, no solo en la UI
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para cambiar roles.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user && user.id === memberId) {
    return { error: 'No puedes cambiar tu propio rol.' }
  }

  const { data: target } = await supabase
    .from('app_users')
    .select('organization_id')
    .eq('id', memberId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese usuario no pertenece a tu organización.' }
  }

  const { error } = await supabase
    .from('app_users')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}