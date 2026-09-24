'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { descontarStockYAlertar } from '@/lib/inventory'
import { canManageTeam, type Role } from '@/lib/permissions'

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

  // Nota: ya NO marcamos la mesa como "occupied" aquí. Solo se marca
  // ocupada hasta que se agrega el primer producto (ver addOrderItem).

  return { orderId: newOrder.id }
}

export async function getOrderItems(orderId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('table_order_items')
    .select('id, product_id, quantity, unit_price, bottle_status, ml_restante, products(name, category, ml_total)')
    .eq('table_order_id', orderId)
    .order('created_at')
  return data ?? []
}

export async function updateBottleStatus(itemId: string, status: 'sellada' | 'abierta' | 'vacia') {
  const supabase = await createClient()
  const mlRestante = status === 'vacia' ? 0 : status === 'sellada' ? null : undefined
  await supabase
    .from('table_order_items')
    .update({ bottle_status: status, ...(mlRestante !== undefined ? { ml_restante: mlRestante } : {}) })
    .eq('id', itemId)
}

export async function addOrderItem(
  orderId: string,
  productId: string,
  unitPrice: number,
  tableId: string,
  category?: string | null
) {
  const supabase = await createClient()

  if (category === 'botella') {
    await supabase.from('table_order_items').insert({
      table_order_id: orderId,
      product_id: productId,
      quantity: 1,
      unit_price: unitPrice,
      bottle_status: 'sellada',
    })
  } else {
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

  // Ahora sí: al agregar el primer (o cualquier) producto, la mesa pasa a ocupada.
  await supabase.from('restaurant_tables').update({ status: 'occupied' }).eq('id', tableId)
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
  giroSlug: string,
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

  await descontarStockYAlertar(
    supabase,
    organizationId,
    items.map((i) => ({ productId: i.product_id, quantity: i.quantity }))
  )

  await supabase
    .from('table_orders')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', orderId)
  await supabase.from('restaurant_tables').update({ status: 'available' }).eq('id', tableId)

  revalidatePath(`/pos/${giroSlug}`)

  return { success: true, saleId: sale.id, total }
}

export async function getTables(organizationId: string, giroId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('restaurant_tables')
    .select('id, name, status')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .order('name')
  return data ?? []
}

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

export async function createTable(giroId: string, branchId: string, name: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) return { error: 'No tienes permiso para gestionar mesas.' }
  if (!name.trim()) return { error: 'El nombre es obligatorio.' }

  const { data: existing } = await supabase
    .from('restaurant_tables')
    .select('id')
    .eq('organization_id', current.organization_id)
    .eq('giro_id', giroId)
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) return { error: `Ya existe una mesa llamada "${name.trim()}".` }

  const { error } = await supabase.from('restaurant_tables').insert({
    organization_id: current.organization_id,
    branch_id: branchId,
    giro_id: giroId,
    name: name.trim(),
    status: 'available',
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function createMultipleTables(giroId: string, branchId: string, cantidad: number, prefijo: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) return { error: 'No tienes permiso para gestionar mesas.' }
  if (cantidad < 1 || cantidad > 100) return { error: 'La cantidad debe ser entre 1 y 100.' }

  const { data: existentes } = await supabase
    .from('restaurant_tables')
    .select('name')
    .eq('organization_id', current.organization_id)
    .eq('giro_id', giroId)

  const nombresExistentes = new Set((existentes ?? []).map((t) => t.name.trim().toLowerCase()))

  const nuevas: { organization_id: string; branch_id: string; giro_id: string; name: string; status: string }[] = []
  for (let i = 1; i <= cantidad; i++) {
    const nombre = `${prefijo.trim() || 'Mesa'} ${i}`
    if (!nombresExistentes.has(nombre.toLowerCase())) {
      nuevas.push({
        organization_id: current.organization_id,
        branch_id: branchId,
        giro_id: giroId,
        name: nombre,
        status: 'available',
      })
    }
  }

  if (nuevas.length === 0) {
    return { error: 'Todas esas mesas ya existen.' }
  }

  const { error } = await supabase.from('restaurant_tables').insert(nuevas)
  if (error) return { error: error.message }
  return { success: true, creadas: nuevas.length }
}

export async function renameTable(tableId: string, newName: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) return { error: 'No tienes permiso para gestionar mesas.' }
  if (!newName.trim()) return { error: 'El nombre es obligatorio.' }

  const { data: target } = await supabase
    .from('restaurant_tables')
    .select('organization_id')
    .eq('id', tableId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Esa mesa no pertenece a tu organización.' }
  }

  const { error } = await supabase
    .from('restaurant_tables')
    .update({ name: newName.trim() })
    .eq('id', tableId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteTable(tableId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canManageTeam(current.role as Role)) return { error: 'No tienes permiso para gestionar mesas.' }

  const { data: target } = await supabase
    .from('restaurant_tables')
    .select('organization_id, status')
    .eq('id', tableId)
    .single()

  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Esa mesa no pertenece a tu organización.' }
  }

  if (target.status === 'occupied') {
    return { error: 'No puedes eliminar una mesa ocupada. Cierra su cuenta primero.' }
  }

  const { error } = await supabase.from('restaurant_tables').delete().eq('id', tableId)
  if (error) return { error: error.message }
  return { success: true }
}