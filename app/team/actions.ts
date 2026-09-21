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