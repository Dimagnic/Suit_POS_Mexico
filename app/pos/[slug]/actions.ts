'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { resend } from '@/lib/resend/client'

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

  // Descontar stock y detectar productos que cruzan su umbral de
  // reabastecimiento en esta misma venta. No bloqueamos el cobro si
  // esto falla — la venta ya quedó registrada, el stock es secundario.
  try {
    await descontarStockYAlertar(supabase, organizationId, items)
  } catch (stockError) {
    console.error('Error al descontar stock / evaluar alertas de inventario:', stockError)
  }

  revalidatePath('/pos')
  revalidatePath('/inventory')
  return { success: true, saleId: sale.id, total }
}

async function descontarStockYAlertar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  items: CartItem[]
) {
  const productIds = items.map((i) => i.productId)

  const { data: products } = await supabase
    .from('products')
    .select('id, name, stock_quantity, reorder_point')
    .in('id', productIds)

  if (!products) return

  const crossedIntoAlert: { name: string; newStock: number; reorderPoint: number }[] = []

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId)
    if (!product) continue

    const oldStock = product.stock_quantity
    const newStock = Math.max(0, oldStock - item.quantity)

    await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.productId)

    if (
      product.reorder_point !== null &&
      oldStock >= product.reorder_point &&
      newStock < product.reorder_point
    ) {
      crossedIntoAlert.push({
        name: product.name,
        newStock,
        reorderPoint: product.reorder_point,
      })
    }
  }

  if (crossedIntoAlert.length > 0) {
    await enviarAlertaInventario(supabase, organizationId, crossedIntoAlert)
  }
}

async function enviarAlertaInventario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  productos: { name: string; newStock: number; reorderPoint: number }[]
) {
  const { data: owner } = await supabase
    .from('app_users')
    .select('email')
    .eq('organization_id', organizationId)
    .eq('role', 'owner')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!owner?.email) return

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const filas = productos
    .map((p) => `<li><strong>${p.name}</strong> — quedan ${p.newStock} (umbral: ${p.reorderPoint})</li>`)
    .join('')

  try {
    await resend.emails.send({
      from: 'Suit POS México <onboarding@resend.dev>',
      to: owner.email,
      subject: `Alerta de inventario: ${productos.length} producto(s) bajo su umbral`,
      html: `
        <p>Hola,</p>
        <p>Los siguientes productos acaban de bajar de su nivel mínimo de stock:</p>
        <ul>${filas}</ul>
        <p>Revisa el inventario y considera hacer una orden de compra:</p>
        <p><a href="${siteUrl}/inventory">${siteUrl}/inventory</a></p>
      `,
    })
  } catch (emailError) {
    console.error('Error enviando alerta de inventario:', emailError)
  }
}
