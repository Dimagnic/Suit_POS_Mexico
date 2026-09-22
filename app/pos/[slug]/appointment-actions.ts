'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { descontarStockYAlertar } from '@/lib/inventory'

export async function getAppointments(organizationId: string, giroId: string, dateISO: string) {
  const supabase = await createClient()
  const dayStart = `${dateISO}T00:00:00`
  const dayEnd = `${dateISO}T23:59:59`

  const { data } = await supabase
    .from('appointments')
    .select('id, customer_name, customer_phone, starts_at, ends_at, status, sale_id, service_product_id, products(name, price, duration_minutes)')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .gte('starts_at', dayStart)
    .lte('starts_at', dayEnd)
    .order('starts_at')

  return data ?? []
}

export async function getServices(organizationId: string, giroId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, price, duration_minutes')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .eq('category', 'servicio_agendable')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

export async function createAppointment(input: {
  organizationId: string
  branchId: string
  giroId: string
  serviceProductId: string
  customerName: string
  customerPhone: string
  startsAt: string // ISO
  durationMinutes: number
}) {
  const supabase = await createClient()

  const startsAt = new Date(input.startsAt)
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60000)

  const { error } = await supabase.from('appointments').insert({
    organization_id: input.organizationId,
    branch_id: input.branchId,
    giro_id: input.giroId,
    service_product_id: input.serviceProductId,
    customer_name: input.customerName,
    customer_phone: input.customerPhone || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    status: 'pendiente',
  })

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: 'confirmada' | 'en_curso' | 'cancelada' | 'no_asistio',
) {
  const supabase = await createClient()
  await supabase.from('appointments').update({ status }).eq('id', appointmentId)
}

// Marca la cita como completada, genera la venta real (sales/sale_items)
// para poder facturarla con el mismo flujo de invoice-actions.ts
export async function completeAppointment(
  appointmentId: string,
  organizationId: string,
  branchId: string,
  giroId: string,
  giroSlug: string,
  cashierId: string,
) {
  const supabase = await createClient()

  const { data: appointment } = await supabase
    .from('appointments')
    .select('service_product_id, products(name, price)')
    .eq('id', appointmentId)
    .single()

  if (!appointment) return { error: 'Cita no encontrada' }

  const service = appointment.products as unknown as { name: string; price: number }
  const subtotal = service.price
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

  if (saleError || !sale) return { error: saleError?.message ?? 'Error creando la venta' }

  await supabase.from('sale_items').insert({
    sale_id: sale.id,
    product_id: appointment.service_product_id,
    quantity: 1,
    unit_price: service.price,
    subtotal: service.price,
  })

  await descontarStockYAlertar(supabase, organizationId, [
    { productId: appointment.service_product_id, quantity: 1 },
  ])

  await supabase
    .from('appointments')
    .update({ status: 'completada', sale_id: sale.id })
    .eq('id', appointmentId)

  revalidatePath(`/pos/${giroSlug}`)

  return { success: true, saleId: sale.id, total }
}