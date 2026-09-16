'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type CartItem = { productId: string; price: number; quantity: number }

export async function checkout({
  organizationId,
  branchId,
  giroId,
  cashierId,
  items,
}: {
  organizationId: string
  branchId: string
  giroId: string
  cashierId: string
  items: CartItem[]
}) {
  const supabase = await createClient()

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
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
    return { error: saleError?.message ?? 'Error al crear la venta' }
  }

  const saleItems = items.map((i) => ({
    sale_id: sale.id,
    product_id: i.productId,
    quantity: i.quantity,
    unit_price: i.price,
    subtotal: i.price * i.quantity,
  }))

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
  if (itemsError) return { error: itemsError.message }

  revalidatePath('/pos')
  return { success: true, saleId: sale.id, total }
}