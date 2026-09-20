import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canManageTeam, type Role } from '@/lib/permissions'

export async function resolveActiveBranch(
  supabase: SupabaseClient,
  organizationId: string,
  role: Role,
  assignedBranchId: string | null
): Promise<string | null> {
  // Owner/admin pueden navegar cualquier sucursal de su organización,
  // usando la que hayan elegido como "activa" en esta sesión (cookie).
  if (canManageTeam(role)) {
    const cookieStore = await cookies()
    const activeBranchId = cookieStore.get('active_branch_id')?.value

    if (activeBranchId) {
      const { data: valid } = await supabase
        .from('branches')
        .select('id')
        .eq('id', activeBranchId)
        .eq('organization_id', organizationId)
        .maybeSingle()

      if (valid) return valid.id
    }
  }

  // Todos (incluido owner/admin sin cookie activa) usan su sucursal asignada
  if (assignedBranchId) return assignedBranchId

  // Respaldo final: la sucursal principal de la organización
  const { data: main } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('is_main', true)
    .maybeSingle()

  return main?.id ?? null
}