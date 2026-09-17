import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PosClient from './pos-client'
import TablesClient from './tables-client'
import AppointmentsClient from './appointments-client'
import { getAppointments, getServices } from './appointment-actions'

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!appUser) redirect('/login')

  const { data: giro } = await supabase
    .from('giros')
    .select('id, slug, nombre, icono')
    .eq('slug', slug)
    .single()

  if (!giro) notFound()

  const { data: orgGiro } = await supabase
    .from('organization_giros')
    .select('id')
    .eq('organization_id', appUser.organization_id)
    .eq('giro_id', giro.id)
    .eq('status', 'active')
    .single()

  if (!orgGiro) redirect('/')

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, price, stock_quantity, unit, category')
    .eq('organization_id', appUser.organization_id)
    .eq('giro_id', giro.id)
    .eq('is_active', true)
    .order('name')

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', appUser.organization_id)
    .eq('is_main', true)
    .single()

   // Giros con lógica especial (mesas, citas, etc.) se detectan por slug
  if (giro.slug === 'restaurante' || giro.slug === 'bar') {
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('id, name, status')
      .eq('organization_id', appUser.organization_id)
      .eq('giro_id', giro.id)
      .order('name')

        return (
      <TablesClient
        tables={tables ?? []}
        products={products ?? []}
        organizationId={appUser.organization_id}
        branchId={branch?.id ?? ''}
        giroId={giro.id}
        giroSlug={giro.slug}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        waiterId={user.id}
      />
    )
  }

  // Giros de agenda/citas: duración fija, sin mesas
  const CITAS_GIROS = ['servicios', 'clinica_general', 'spa']
  if (CITAS_GIROS.includes(giro.slug)) {
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const [appointments, services] = await Promise.all([
      getAppointments(appUser.organization_id, giro.id, today),
      getServices(appUser.organization_id, giro.id),
    ])

    return (
      <AppointmentsClient
        initialAppointments={appointments as any}
        services={services as any}
        organizationId={appUser.organization_id}
        branchId={branch?.id ?? ''}
        giroId={giro.id}
        giroSlug={giro.slug}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        cashierId={user.id}
        today={today}
      />
    )
  }

  // Resto de giros: catálogo de mostrador estándar
  return (
    <PosClient
      giro={giro}
      products={products ?? []}
      organizationId={appUser.organization_id}
      branchId={branch?.id ?? ''}
      cashierId={user.id}
    />
  )
}