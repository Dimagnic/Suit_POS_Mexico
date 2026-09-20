import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'

// Cliente con permisos elevados: un webhook no tiene sesión de usuario,
// así que necesita saltarse RLS para escribir directo.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const organizationId = session.metadata?.organization_id
      const giroId = session.metadata?.giro_id
      const subscriptionId = session.subscription as string

      if (!organizationId || !giroId) break

      await supabaseAdmin
        .from('organization_giros')
        .upsert(
          {
            organization_id: organizationId,
            giro_id: giroId,
            status: 'active',
            stripe_subscription_item_id: subscriptionId,
            activated_at: new Date().toISOString(),
          },
          { onConflict: 'organization_id,giro_id' }
        )

      await supabaseAdmin
        .from('platform_subscriptions')
        .update({ status: 'active' })
        .eq('organization_id', organizationId)

      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      await supabaseAdmin
        .from('platform_subscriptions')
        .update({ status: 'past_due' })
        .eq('stripe_customer_id', customerId)

      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { data: platformSub } = await supabaseAdmin
        .from('platform_subscriptions')
        .select('organization_id')
        .eq('stripe_customer_id', customerId)
        .maybeSingle()

      if (platformSub) {
        await supabaseAdmin
          .from('organization_giros')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('organization_id', platformSub.organization_id)
          .eq('stripe_subscription_item_id', subscription.id)
      }

      break
    }
  }

  return NextResponse.json({ received: true })
}