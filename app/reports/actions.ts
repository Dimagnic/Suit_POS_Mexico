'use server'

import { createClient } from '@/lib/supabase/server'
import { canViewReports, type Role } from '@/lib/permissions'

export async function getReportData(filters: { from: string; to: string; branchId?: string; giroId?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: current } = await supabase
    .from('app_users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!current) return { error: 'No autenticado' }
  if (!canViewReports(current.role as Role)) return { error: 'No tienes permiso para ver reportes.' }

  let query = supabase
    .from('sales')
    .select('id, subtotal, tax, total, created_at, status, giro_id, branch_id, giros(nombre), branches(name)')
    .eq('organization_id', current.organization_id)
    .eq('status', 'completed')
    .gte('created_at', filters.from)
    .lte('created_at', filters.to + 'T23:59:59')

  if (filters.branchId) query = query.eq('branch_id', filters.branchId)
  if (filters.giroId) query = query.eq('giro_id', filters.giroId)

  const { data: sales, error } = await query.order('created_at', { ascending: false })
  if (error) return { error: error.message }

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('organization_id', current.organization_id)
    .order('name')

  const { data: giros } = await supabase
    .from('organization_giros')
    .select('giro_id, giros(nombre, slug)')
    .eq('organization_id', current.organization_id)
    .eq('status', 'active')

  const totalVentas = sales?.reduce((sum, s) => sum + s.total, 0) ?? 0
  const totalIva = sales?.reduce((sum, s) => sum + s.tax, 0) ?? 0
  const numVentas = sales?.length ?? 0

  const porGiro = new Map<string, { nombre: string; total: number; count: number }>()
  sales?.forEach((s: any) => {
    const nombre = s.giros?.nombre ?? 'Sin giro'
    const entry = porGiro.get(nombre) ?? { nombre, total: 0, count: 0 }
    entry.total += s.total
    entry.count += 1
    porGiro.set(nombre, entry)
  })

  return {
    resumen: { totalVentas, totalIva, numVentas },
    porGiro: Array.from(porGiro.values()).sort((a, b) => b.total - a.total),
    ventas: (sales ?? []).slice(0, 50).map((s: any) => ({
      id: s.id,
      total: s.total,
      createdAt: s.created_at,
      giro: s.giros?.nombre ?? '—',
      branch: s.branches?.name ?? '—',
    })),
    branches: branches ?? [],
    giros: (giros ?? []).map((g: any) => ({ id: g.giro_id, nombre: g.giros.nombre })),
  }
}
