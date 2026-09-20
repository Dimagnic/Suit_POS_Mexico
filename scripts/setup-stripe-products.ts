import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Precio mensual por giro, en centavos de MXN. Ajustable por giro si algún día
// quieres precios distintos (ej. gasolinera más caro que papelería).
const PRECIO_MENSUAL_MXN = 29900 // $299.00 MXN

async function main() {
  const { data: giros, error } = await supabase
    .from('giros')
    .select('id, slug, nombre')
    .order('slug')

  if (error || !giros) {
    console.error('Error leyendo giros:', error)
    return
  }

  for (const giro of giros) {
    const product = await stripe.products.create({
      name: `Suit POS — ${giro.nombre}`,
      metadata: { giro_slug: giro.slug, giro_id: giro.id },
    })

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: PRECIO_MENSUAL_MXN,
      currency: 'mxn',
      recurring: { interval: 'month' },
    })

    const { error: updateError } = await supabase
      .from('giros')
      .update({ stripe_price_id: price.id })
      .eq('id', giro.id)

    if (updateError) {
      console.error(`Error guardando price_id para ${giro.slug}:`, updateError)
    } else {
      console.log(`✓ ${giro.slug} → ${price.id}`)
    }
  }

  console.log('Listo.')
}

main()