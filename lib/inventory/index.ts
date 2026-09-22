import type { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type SoldItem = { productId: string; quantity: number }

/**
 * Descuenta stock_quantity de cada producto vendido y, si alguno cruza
 * su reorder_point en esta venta, dispara una alerta por correo al
 * owner de la organización.
 *
 * IMPORTANTE: esta función debe llamarse desde CUALQUIER lugar del
 * código que inserte una venta real en `sales`/`sale_items` — hoy son
 * 5 flujos distintos (mostrador, citas, hotel, gasolinera, mesas),
 * cada uno con su propio archivo de actions. Si se agrega un giro
 * nuevo con su propio flujo de venta en el futuro, debe llamar a esta
 * misma función para no repetir el gap que hubo antes de conectarla
 * en todos los flujos existentes.
 *
 * No lanza errores hacia afuera: si algo falla aquí, se registra en
 * consola pero nunca bloquea el cobro, que ya quedó registrado.
 */
export async function descontarStockYAlertar(
  supabase: SupabaseClient,
  organizationId: string,
  items: SoldItem[]
) {
  try {
    const productIds = items.map((i) => i.productId)
    if (productIds.length === 0) return

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
  } catch (error) {
    console.error('Error al descontar stock / evaluar alertas de inventario:', error)
  }
}

async function enviarAlertaInventario(
  supabase: SupabaseClient,
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
