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
    .select('id, role, organization_id')
    .eq('id', user.id)
    .single()
  return appUser
}

export async function getPurchaseOrdersPageData() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para ver órdenes de compra.' }

  const { data: orders, error } = await supabase
    .from('purchase_orders')
    .select('id, status, notes, created_at, received_at, suppliers(name), purchase_order_items(id, quantity, unit_cost, products(name, unit))')
    .eq('organization_id', current.organization_id)
    .order('created_at', { ascending: false })

  if (error) return { error: error.message }

  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('organization_id', current.organization_id)
    .eq('is_active', true)
    .order('name')

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku, unit, cost, giros(nombre)')
    .eq('organization_id', current.organization_id)
    .eq('is_active', true)
    .order('name')

  const orderList = (orders ?? []).map((o) => ({
    id: o.id,
    status: o.status as 'ordered' | 'received' | 'canceled',
    notes: o.notes as string | null,
    createdAt: o.created_at,
    receivedAt: o.received_at,
    supplierName: (o.suppliers as unknown as { name: string } | null)?.name ?? '—',
    items: (o.purchase_order_items ?? []).map((it) => ({
      id: it.id,
      productName: (it.products as unknown as { name: string; unit: string } | null)?.name ?? '—',
      unit: (it.products as unknown as { name: string; unit: string } | null)?.unit ?? '',
      quantity: it.quantity,
      unitCost: it.unit_cost,
    })),
    total: (o.purchase_order_items ?? []).reduce(
      (sum: number, it: { quantity: number; unit_cost: number }) => sum + it.quantity * it.unit_cost,
      0
    ),
  }))

  return {
    orders: orderList,
    suppliers: suppliers ?? [],
    products: (products ?? []).map((p) => ({
      id: p.id, name: p.name, sku: p.sku, unit: p.unit, cost: p.cost,
      giroNombre: (p.giros as unknown as { nombre: string } | null)?.nombre ?? '—',
    })),
    currentRole: current.role as Role,
  }
}

type NewItem = { productId: string; quantity: number; unitCost: number }

export async function createPurchaseOrder(supplierId: string, items: NewItem[], notes: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para crear órdenes de compra.' }

  if (!supplierId) return { error: 'Elige un proveedor.' }
  if (items.length === 0) return { error: 'Agrega al menos un producto.' }

  const { data: supplier } = await supabase.from('suppliers').select('organization_id').eq('id', supplierId).single()
  if (!supplier || supplier.organization_id !== current.organization_id) {
    return { error: 'Ese proveedor no pertenece a tu organización.' }
  }

  const { data: order, error: orderError } = await supabase
    .from('purchase_orders')
    .insert({
      organization_id: current.organization_id,
      supplier_id: supplierId,
      status: 'ordered',
      created_by: current.id,
      notes: notes.trim() || null,
    })
    .select('id')
    .single()

  if (orderError || !order) return { error: orderError?.message ?? 'Error al crear la orden.' }

  const itemRows = items.map((i) => ({
    purchase_order_id: order.id,
    product_id: i.productId,
    quantity: i.quantity,
    unit_cost: i.unitCost,
  }))

  const { error: itemsError } = await supabase.from('purchase_order_items').insert(itemRows)
  if (itemsError) return { error: itemsError.message }

  revalidatePath('/purchase-orders')
  return { success: true, id: order.id }
}

export async function markPurchaseOrderReceived(purchaseOrderId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para recibir órdenes de compra.' }

  const { data: order } = await supabase
    .from('purchase_orders')
    .select('organization_id, status, purchase_order_items(product_id, quantity)')
    .eq('id', purchaseOrderId)
    .single()

  if (!order || order.organization_id !== current.organization_id) {
    return { error: 'Esa orden no pertenece a tu organización.' }
  }
  if (order.status === 'received') {
    return { error: 'Esa orden ya fue marcada como recibida.' }
  }

  // Suma cada cantidad de vuelta al stock del producto correspondiente.
  const items = (order.purchase_order_items ?? []) as { product_id: string; quantity: number }[]
  for (const item of items) {
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .single()

    if (product) {
      await supabase
        .from('products')
        .update({ stock_quantity: product.stock_quantity + item.quantity })
        .eq('id', item.product_id)
    }
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'received', received_at: new Date().toISOString() })
    .eq('id', purchaseOrderId)

  if (error) return { error: error.message }

  revalidatePath('/purchase-orders')
  revalidatePath('/inventory')
  return { success: true }
}

export async function cancelPurchaseOrder(purchaseOrderId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para cancelar órdenes de compra.' }

  const { data: order } = await supabase.from('purchase_orders').select('organization_id, status').eq('id', purchaseOrderId).single()
  if (!order || order.organization_id !== current.organization_id) {
    return { error: 'Esa orden no pertenece a tu organización.' }
  }
  if (order.status === 'received') {
    return { error: 'No puedes cancelar una orden ya recibida.' }
  }

  const { error } = await supabase.from('purchase_orders').update({ status: 'canceled' }).eq('id', purchaseOrderId)
  if (error) return { error: error.message }

  revalidatePath('/purchase-orders')
  return { success: true }
}
