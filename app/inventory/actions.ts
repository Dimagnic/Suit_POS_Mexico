'use server'

import { createClient } from '@/lib/supabase/server'
import { canEditCatalog, type Role } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

async function getCurrentUser() {
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

export async function getInventoryOverview() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para ver el inventario.' }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, stock_quantity, reorder_point, unit, giro_id, giros(nombre)')
    .eq('organization_id', current.organization_id)
    .eq('is_active', true)
    .order('name')

  if (error) return { error: error.message }

  const items = (products ?? []).map((p) => {
    const sinUmbral = p.reorder_point === null
    const bajoUmbral = !sinUmbral && p.stock_quantity < p.reorder_point
    return {
      id: p.id,
      name: p.name,
      sku: p.sku as string | null,
      stockQuantity: p.stock_quantity as number,
      reorderPoint: p.reorder_point as number | null,
      unit: p.unit as string,
      giroNombre: (p.giros as unknown as { nombre: string } | null)?.nombre ?? '—',
      bajoUmbral,
    }
  })

  // Los productos bajo su umbral se muestran primero.
  items.sort((a, b) => {
    if (a.bajoUmbral !== b.bajoUmbral) return a.bajoUmbral ? -1 : 1
    return a.stockQuantity - b.stockQuantity
  })

  return { items, currentRole: current.role as Role }
}

export async function updateReorderPoint(productId: string, reorderPoint: number | null) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar el inventario.' }

  const { data: target } = await supabase.from('products').select('organization_id').eq('id', productId).single()
  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese producto no pertenece a tu organización.' }
  }

  const { error } = await supabase
    .from('products')
    .update({ reorder_point: reorderPoint })
    .eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/inventory')
  return { success: true }
}
