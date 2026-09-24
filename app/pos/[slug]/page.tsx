import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PosClient from './pos-client'
import TablesClient from './tables-client'
import AppointmentsClient from './appointments-client'
import HotelClient from './hotel-client'
import GasClient from './gas-client'
import { getAppointments, getServices } from './appointment-actions'
import { getRooms, getRoomTypes } from './hotel-actions'
import { getPumps } from './gas-actions'
import { resolveActiveBranch } from '@/lib/branch'
import type { Role } from '@/lib/permissions'

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('organization_id, role, branch_id')
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

  // Sucursal activa: respeta la selección del owner/admin (cookie), luego la
  // sucursal asignada al usuario, y solo al final la principal como respaldo.
  const activeBranchId = await resolveActiveBranch(
    supabase,
    appUser.organization_id,
    appUser.role as Role,
    appUser.branch_id
  )

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
        branchId={activeBranchId ?? ''}
        giroId={giro.id}
        giroSlug={giro.slug}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        waiterId={user.id}
        currentRole={appUser.role as Role}
      />
    )
  }

  const CITAS_GIROS = ['servicios', 'clinica_general', 'spa']
  if (CITAS_GIROS.includes(giro.slug)) {
    const today = new Date().toISOString().slice(0, 10)
    const [appointments, services] = await Promise.all([
      getAppointments(appUser.organization_id, giro.id, today),
      getServices(appUser.organization_id, giro.id),
    ])

    return (
      <AppointmentsClient
        initialAppointments={appointments as any}
        services={services as any}
        organizationId={appUser.organization_id}
        branchId={activeBranchId ?? ''}
        giroId={giro.id}
        giroSlug={giro.slug}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        cashierId={user.id}
        today={today}
      />
    )
  }

  if (giro.slug === 'hotel') {
    const [rooms, roomTypes] = await Promise.all([
      getRooms(appUser.organization_id, giro.id),
      getRoomTypes(appUser.organization_id, giro.id),
    ])

    return (
      <HotelClient
        rooms={rooms as any}
        roomTypes={roomTypes as any}
        organizationId={appUser.organization_id}
        branchId={activeBranchId ?? ''}
        giroId={giro.id}
        giroSlug={giro.slug}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        cashierId={user.id}
      />
    )
  }

  if (giro.slug === 'gasolinera') {
    const pumps = await getPumps(appUser.organization_id, giro.id)

    return (
      <GasClient
        pumps={pumps as any}
        fuels={(products ?? []) as any}
        organizationId={appUser.organization_id}
        branchId={activeBranchId ?? ''}
        giroId={giro.id}
        giroNombre={giro.nombre}
        giroIcono={giro.icono}
        cashierId={user.id}
      />
    )
  }

  // Resto de giros: catálogo de mostrador estándar
  return (
    <PosClient
      giro={giro}
      products={products ?? []}
      organizationId={appUser.organization_id}
      branchId={activeBranchId ?? ''}
      cashierId={user.id}
    />
  )
}