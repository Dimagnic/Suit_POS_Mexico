'use server'

import { createClient } from '@/lib/supabase/server'

export async function getPumps(organizationId: string, giroId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gas_pumps')
    .select('id, name')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .order('name')
  return data ?? []
}

export async function dispenseFuel(input: {
  organizationId: string
  branchId: string
  giroId: string
  pumpId: string
  productId: string
  unitPrice: number
  liters: number
  cashierId: string
}) {
  const supabase = await createClient()

  const subtotal = input.unitPrice * input.liters
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      organization_id: input.organizationId,
      branch_id: input.branchId,
      giro_id: input.giroId,
      cashier_id: input.cashierId,
      pump_id: input.pumpId,
      subtotal,
      tax,
      total,
      payment_method: 'cash',
      status: 'completed',
    })
    .select('id')
    .single()

  if (saleError || !sale) return { error: saleError?.message ?? 'Error creando la venta' }

  const { error: itemError } = await supabase.from('sale_items').insert({
    sale_id: sale.id,
    product_id: input.productId,
    quantity: input.liters,
    unit_price: input.unitPrice,
    subtotal,
  })

  if (itemError) return { error: itemError.message }

  return { success: true, saleId: sale.id, total }
}