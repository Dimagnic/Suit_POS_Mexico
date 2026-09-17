'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getOrCreateOpenOrder(tableId: string, organizationId: string, waiterId: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('table_orders')
    .select('id')
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle()

  if (existing) return { orderId: existing.id }

  const { data: newOrder, error } = await supabase
    .from('table_orders')
    .insert({ organization_id: organizationId, table_id: tableId, waiter_id: waiterId, status: 'open' })
    .select('id')
    .single()

  if (error || !newOrder) return { error: error?.message ?? 'Error creando la orden' }

  await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId)

  return { orderId: newOrder.id }
}

export async function getOrderItems(orderId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('table_order_items')
    .select('id, product_id, quantity, unit_price, products(name)')
    .eq('table_order_id', orderId)
    .order('created_at')
  return data ?? []
}

export async function addOrderItem(orderId: string, productId: string, unitPrice: number) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('table_order_items')
    .select('id, quantity')
    .eq('table_order_id', orderId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('table_order_items')
      .update({ quantity: existing.quantity + 1 })
      .eq('id', existing.id)
  } else {
    await supabase.from('table_order_items').insert({
      table_order_id: orderId,
      product_id: productId,
      quantity: 1,
      unit_price: unitPrice,
    })
  }
}

export async function changeOrderItemQty(itemId: string, delta: number) {
  const supabase = await createClient()
  const { data: item } = await supabase
    .from('table_order_items')
    .select('quantity')
    .eq('id', itemId)
    .single()

  if (!item) return

  const newQty = item.quantity + delta
  if (newQty <= 0) {
    await supabase.from('table_order_items').delete().eq('id', itemId)
  } else {
    await supabase.from('table_order_items').update({ quantity: newQty }).eq('id', itemId)
  }
}

export async function closeTableOrder(
  orderId: string,
  tableId: string,
  organizationId: string,
  branchId: string,
  giroId: string,
  cashierId: string
) {
  const supabase = await createClient()

  const { data: items } = await supabase
    .from('table_order_items')
    .select('product_id, quantity, unit_price')
    .eq('table_order_id', orderId)

  if (!items || items.length === 0) {
    return { error: 'La mesa no tiene productos para cobrar.' }
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      organization_id: organizationId,
      branch_id: branchId,
      giro_id: giroId,
      cashier_id: cashierId,
      subtotal,
      tax,
      total,
      payment_method: 'cash',
      status: 'completed',
    })
    .select('id')
    .single()

  if (saleError || !sale) {
    return { error: saleError?.message ?? 'Error creando la venta' }
  }

  const saleItems = items.map((i) => ({
    sale_id: sale.id,
    product_id: i.product_id,
    quantity: i.quantity,
    unit_price: i.unit_price,
    subtotal: i.unit_price * i.quantity,
  }))

  await supabase.from('sale_items').insert(saleItems)
  await supabase
    .from('table_orders')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', orderId)
  await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)

  revalidatePath('/pos/restaurante')

  return { success: true, saleId: sale.id, total }
}

export async function getTables(organizationId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('restaurant_tables')
    .select('id, name, status')
    .eq('organization_id', organizationId)
    .order('name')
  return data ?? []
}