export type Role = 'owner' | 'admin' | 'manager' | 'cashier'

const ROLE_RANK: Record<Role, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  cashier: 1,
}

export function canManageTeam(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin
}

export function canEditCatalog(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.manager
}

export function canViewReports(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.manager
}

// Nadie puede asignar (por cambio de rol o invitación) un rol por encima
// del suyo propio — evita que un admin cree o ascienda a un owner.
export function canAssignRole(currentRole: Role, targetRole: Role): boolean {
  return canManageTeam(currentRole) && ROLE_RANK[currentRole] >= ROLE_RANK[targetRole]
}

// Roles que currentRole puede asignar a otros, en orden de mayor a menor.
export function assignableRoles(currentRole: Role): Role[] {
  return (['owner', 'admin', 'manager', 'cashier'] as Role[]).filter((r) =>
    canAssignRole(currentRole, r)
  )
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
}