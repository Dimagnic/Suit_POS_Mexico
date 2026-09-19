'use server'

import { createClient } from '@/lib/supabase/server'
import { canManageTeam, canAssignRole, type Role } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

async function getCurrentUserRole() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: appUser } = await supabase
    .from('app_users')
    .select('id, role, organization_id')
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

  if (current.id === memberId) {
    return { error: 'No puedes cambiar tu propio rol.' }
  }

  const { data: target } = await supabase
    .from('app_users')
    .select('organization_id, role')
    .eq('id', memberId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese usuario no pertenece a tu organización.' }
  }

  // Verificación real de permiso — en el servidor, no solo en la UI.
  // Nadie puede tocar a alguien con un rango igual o mayor al suyo,
  // ni asignar un rol por encima de su propio rango.
  const currentRole = current.role as Role
  const targetCurrentRole = target.role as Role
  if (
    !canAssignRole(currentRole, newRole) ||
    !canAssignRole(currentRole, targetCurrentRole)
  ) {
    return { error: 'No tienes permiso para asignar ese rol.' }
  }

  const { error } = await supabase
    .from('app_users')
    .update({ role: newRole })
    .eq('id', memberId)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}

export async function getPendingInvites() {
  const supabase = await createClient()
  const current = await getCurrentUserRole()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) return { invites: [] }

  const { data, error } = await supabase
    .from('organization_invites')
    .select('id, email, role, created_at')
    .eq('organization_id', current.organization_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }
  return { invites: data }
}

export async function createInvite(email: string, role: Role) {
  const supabase = await createClient()
  const current = await getCurrentUserRole()
  if (!current) return { error: 'No autenticado' }

  const currentRole = current.role as Role
  if (!canAssignRole(currentRole, role)) {
    return { error: 'No puedes invitar con ese rol.' }
  }

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { error: 'Correo inválido.' }
  }

  const { data: existingMember } = await supabase
    .from('app_users')
    .select('id')
    .eq('organization_id', current.organization_id)
    .ilike('email', normalizedEmail)
    .maybeSingle()

  if (existingMember) {
    return { error: 'Esa persona ya es parte de tu organización.' }
  }

  const { error } = await supabase.from('organization_invites').insert({
    organization_id: current.organization_id,
    email: normalizedEmail,
    role,
    invited_by: current.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'Ya existe una invitación pendiente para ese correo.' }
    }
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}

export async function cancelInvite(inviteId: string) {
  const supabase = await createClient()
  const current = await getCurrentUserRole()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para cancelar invitaciones.' }
  }

  const { error } = await supabase
    .from('organization_invites')
    .delete()
    .eq('id', inviteId)
    .eq('organization_id', current.organization_id)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { success: true }
}
