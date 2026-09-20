'use server'

import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe/client'
import { canManageTeam, type Role } from '@/lib/permissions'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, organization_id, email, full_name')
    .eq('id', user.id)
    .single()

  return appUser
}

export async function getGirosConEstado() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const { data: giros, error } = await supabase
    .from('giros')
    .select('id, slug, nombre, icono, categoria, stripe_price_id')
    .order('nombre')

  if (error) return { error: error.message }

  const { data: activos } = await supabase
    .from('organization_giros')
    .select('giro_id, status')
    .eq('organization_id', current.organization_id)

  const activosMap = new Map(activos?.map((a) => [a.giro_id, a.status]) ?? [])

  const girosConEstado = giros.map((g) => ({
    ...g,
    estado: activosMap.get(g.id) ?? null,
  }))

  return { giros: girosConEstado, currentRole: current.role as Role }
}

export async function crearCheckoutParaGiro(giroId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  if (!canManageTeam(current.role as Role)) {
    return { error: 'No tienes permiso para gestionar la suscripción.' }
  }

  const { data: giro } = await supabase
    .from('giros')
    .select('nombre, stripe_price_id')
    .eq('id', giroId)
    .single()

  if (!giro || !giro.stripe_price_id) {
    return { error: 'Ese giro no tiene un precio configurado.' }
  }

  // Reutiliza o crea el Customer de Stripe de la organización
  let { data: platformSub } = await supabase
    .from('platform_subscriptions')
    .select('stripe_customer_id')
    .eq('organization_id', current.organization_id)
    .maybeSingle()

  let customerId = platformSub?.stripe_customer_id

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: current.email,
      name: current.full_name ?? undefined,
      metadata: { organization_id: current.organization_id },
    })
    customerId = customer.id

    await supabase.from('platform_subscriptions').insert({
      organization_id: current.organization_id,
      stripe_customer_id: customerId,
      status: 'trialing',
    })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: giro.stripe_price_id, quantity: 1 }],
    success_url: `${baseUrl}/subscription?success=1`,
    cancel_url: `${baseUrl}/subscription?canceled=1`,
    metadata: {
      organization_id: current.organization_id,
      giro_id: giroId,
    },
  })

  return { url: session.url }
}