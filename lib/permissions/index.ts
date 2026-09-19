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

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
}