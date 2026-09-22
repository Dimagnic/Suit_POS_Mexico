'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { descontarStockYAlertar } from '@/lib/inventory'

export async function getRooms(organizationId: string, giroId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('hotel_rooms')
    .select('id, name, status')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .order('name')
  return data ?? []
}

export async function getRoomTypes(organizationId: string, giroId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, price')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)
    .eq('category', 'hospedaje')
    .eq('is_active', true)
    .order('name')
  return data ?? []
}

export async function getActiveReservation(roomId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reservations')
    .select('id, guest_name, guest_phone, check_in_date, check_out_date, room_product_id, products(name, price)')
    .eq('room_id', roomId)
    .eq('status', 'check_in')
    .maybeSingle()
  return data
}

export async function createReservation(input: {
  organizationId: string
  branchId: string
  giroId: string
  roomId: string
  roomProductId: string
  guestName: string
  guestPhone: string
  checkInDate: string
  checkOutDate: string
}) {
  const supabase = await createClient()

  const { error } = await supabase.from('reservations').insert({
    organization_id: input.organizationId,
    branch_id: input.branchId,
    giro_id: input.giroId,
    room_id: input.roomId,
    room_product_id: input.roomProductId,
    guest_name: input.guestName,
    guest_phone: input.guestPhone || null,
    check_in_date: input.checkInDate,
    check_out_date: input.checkOutDate,
    status: 'check_in',
  })

  if (error) return { error: error.message }

  await supabase.from('hotel_rooms').update({ status: 'occupied' }).eq('id', input.roomId)

  return { success: true }
}

export async function checkOut(
  reservationId: string,
  roomId: string,
  organizationId: string,
  branchId: string,
  giroId: string,
  giroSlug: string,
  cashierId: string
) {
  const supabase = await createClient()

  const { data: reservation } = await supabase
    .from('reservations')
    .select('check_in_date, check_out_date, room_product_id, products(name, price)')
    .eq('id', reservationId)
    .single()

  if (!reservation) return { error: 'Reservación no encontrada' }

  const checkIn = new Date(reservation.check_in_date)
  const checkOutD = new Date(reservation.check_out_date)
  const nights = Math.max(1, Math.round((checkOutD.getTime() - checkIn.getTime()) / 86400000))

  const room = reservation.products as unknown as { name: string; price: number }
  const subtotal = room.price * nights
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
    product_id: reservation.room_product_id,
    quantity: nights,
    unit_price: room.price,
    subtotal,
  })

  await descontarStockYAlertar(supabase, organizationId, [
    { productId: reservation.room_product_id, quantity: nights },
  ])

  await supabase
    .from('reservations')
    .update({ status: 'check_out', sale_id: sale.id })
    .eq('id', reservationId)

  await supabase.from('hotel_rooms').update({ status: 'cleaning' }).eq('id', roomId)

  revalidatePath(`/pos/${giroSlug}`)

  return { success: true, saleId: sale.id, total, nights }
}

export async function markRoomAvailable(roomId: string) {
  const supabase = await createClient()
  await supabase.from('hotel_rooms').update({ status: 'available' }).eq('id', roomId)
}