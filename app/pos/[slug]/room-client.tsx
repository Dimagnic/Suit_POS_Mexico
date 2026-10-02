'use client'

import { useState, useEffect } from 'react'
import { getActiveReservation, createReservation, checkOut } from './hotel-actions'
import { generarFactura } from './invoice-actions'
import PosToolsBar from './pos-tools'
import { printTicket } from '@/lib/ticket'
import InvoiceModal, { type Receptor } from './invoice-modal'

type Room = { id: string; name: string; status: string }
type RoomType = { id: string; name: string; price: number }
type Reservation = {
  id: string
  guest_name: string
  guest_phone: string | null
  check_in_date: string
  check_out_date: string
  room_product_id: string
  products: { name: string; price: number }
}

const SCAN_HINT = 'No aplica en hotel: el tipo de habitacion se elige de una lista corta. El escaner se usa en giros con catalogo amplio de productos.'

export default function RoomClient({
  room,
  roomTypes,
  organizationId,
  branchId,
  giroId,
  giroSlug,
  cashierId,
  onBack,
}: {
  room: Room
  roomTypes: RoomType[]
  organizationId: string
  branchId: string
  giroId: string
  giroSlug: string
  cashierId: string
  onBack: () => void
}) {
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checkoutResult, setCheckoutResult] = useState<{ saleId: string; total: number; nights: number } | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{ success?: boolean; error?: string; uuid?: string; pdfBase64?: string | null; xmlBase64?: string | null } | null>(null)

  const [form, setForm] = useState({
    roomProductId: '',
    guestName: '',
    guestPhone: '',
    checkInDate: new Date().toISOString().slice(0, 10),
    checkOutDate: '',
  })

  useEffect(() => {
    const load = async () => {
      const active = await getActiveReservation(room.id)
      setReservation(active as any)
      setLoading(false)
    }
    load()
  }, [room.id])

  const handleReserve = async () => {
    if (!form.roomProductId || !form.guestName || !form.checkOutDate) return
    setSaving(true)

    const result = await createReservation({
      organizationId,
      branchId,
      giroId,
      roomId: room.id,
      roomProductId: form.roomProductId,
      guestName: form.guestName,
      guestPhone: form.guestPhone,
      checkInDate: form.checkInDate,
      checkOutDate: form.checkOutDate,
    })

    setSaving(false)

    if (result.error) {
      alert('Error: ' + result.error)
      return
    }

    const active = await getActiveReservation(room.id)
    setReservation(active as any)
  }

  const handleCheckOut = async () => {
    if (!reservation) return
    setSaving(true)
    const result = await checkOut(reservation.id, room.id, organizationId, branchId, giroId, giroSlug, cashierId)
    setSaving(false)

    if (result.error) {
      alert('Error: ' + result.error)
      return
    }

    setCheckoutResult({ saleId: result.saleId!, total: result.total!, nights: result.nights! })
  }

  const handleInvoiceSubmit = async (receptor?: Receptor) => {
    if (!checkoutResult) return
    setInvoiceLoading(true)
    const result = await generarFactura(checkoutResult.saleId, receptor)
    setInvoiceLoading(false)
    setInvoiceResult(result)
    if (!result.error) setShowInvoiceModal(false)
  }

  const handlePrint = () => {
    if (!checkoutResult || !reservation) return
    const nightly = reservation.products.price
    const subtotal = nightly * checkoutResult.nights
    printTicket({
      title: room.name,
      subtitle: reservation.guest_name + ' - ' + reservation.check_in_date + ' a ' + reservation.check_out_date,
      lines: [
        {
          label: checkoutResult.nights + ' noche(s) x $' + nightly.toFixed(2),
          amount: subtotal,
        },
      ],
      subtotal,
      tax: subtotal * 0.16,
      total: checkoutResult.total,
    })
  }

  if (loading) {
    return <main style={{ padding: 'var(--space-3)', color: 'var(--text-muted)' }}>Cargando habitacion...</main>
  }

  if (checkoutResult) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <PosToolsBar
            scanNotApplicableHint={SCAN_HINT}
            onPrint={handlePrint}
            printEnabled={true}
            printDisabledHint=""
          />
        </div>

        <p style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
          ✓ Check-out {room.name} — {checkoutResult.nights} noche(s) — Total: ${checkoutResult.total.toFixed(2)}
        </p>

        {!invoiceResult?.success && (
          <button
            onClick={() => setShowInvoiceModal(true)}
            disabled={invoiceLoading}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'transparent',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: 'var(--accent)',
              cursor: invoiceLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Generar factura CFDI
          </button>
        )}

        {invoiceResult?.success && (
          <div style={{ width: '100%', maxWidth: '480px' }}>
            <p style={{ color: 'var(--success)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
              ✓ Facturado — UUID: <span className="mono">{invoiceResult.uuid}</span>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {invoiceResult.pdfBase64 && (
                <a href={'data:application/pdf;base64,' + invoiceResult.pdfBase64} download={'factura-' + invoiceResult.uuid + '.pdf'} style={{ flex: 1, textAlign: 'center', padding: '0.5rem', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', fontSize: '0.8rem', textDecoration: 'none' }}>Descargar PDF</a>
              )}
              {invoiceResult.xmlBase64 && (
                <a href={'data:application/xml;base64,' + invoiceResult.xmlBase64} download={'factura-' + invoiceResult.uuid + '.xml'} style={{ flex: 1, textAlign: 'center', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: '0.8rem', textDecoration: 'none' }}>Descargar XML</a>
              )}
            </div>
          </div>
        )}

        {invoiceResult?.error && !showInvoiceModal && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>✕ {invoiceResult.error}</p>
        )}

        <button
          onClick={onBack}
          style={{
            padding: '0.6rem 1.5rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#1a1206',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Volver a habitaciones
        </button>

        <InvoiceModal
          open={showInvoiceModal}
          onCancel={() => setShowInvoiceModal(false)}
          onSubmit={handleInvoiceSubmit}
          loading={invoiceLoading}
          error={invoiceResult?.error}
        />
      </main>
    )
  }

  return (
    <main style={{ padding: 'var(--space-3)', minHeight: '100vh', maxWidth: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>
          ← Habitaciones
        </button>
        <h1 style={{ fontSize: '1.25rem' }}>🛏️ {room.name}</h1>
      </div>

      <PosToolsBar
        scanNotApplicableHint={SCAN_HINT}
        onPrint={handlePrint}
        printEnabled={false}
        printDisabledHint="Se habilita despues de hacer el check-out y cobrar."
      />

      {reservation ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
          <p style={{ margin: '0 0 0.5rem' }}><strong>{reservation.guest_name}</strong></p>
          {reservation.guest_phone && <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{reservation.guest_phone}</p>}
          <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {reservation.check_in_date} a {reservation.check_out_date}
          </p>
          <p className="mono" style={{ color: 'var(--accent)', fontSize: '1.1rem', margin: '0 0 1rem' }}>
            ${reservation.products.price.toFixed(2)} / noche
          </p>

          <button
            onClick={handleCheckOut}
            disabled={saving}
            style={{
              width: '100%',
              padding: '0.85rem',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#1a1206',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Procesando...' : 'Hacer check-out y cobrar'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <select
            value={form.roomProductId}
            onChange={(e) => setForm({ ...form, roomProductId: e.target.value })}
            style={inputStyle}
          >
            <option value="">Tipo de habitacion...</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>{rt.name} — ${rt.price.toFixed(2)}/noche</option>
            ))}
          </select>

          <input
            placeholder="Nombre del huesped"
            value={form.guestName}
            onChange={(e) => setForm({ ...form, guestName: e.target.value })}
            style={inputStyle}
          />

          <input
            placeholder="Telefono (opcional)"
            value={form.guestPhone}
            onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
            style={inputStyle}
          />

          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Check-in</label>
          <input
            type="date"
            value={form.checkInDate}
            onChange={(e) => setForm({ ...form, checkInDate: e.target.value })}
            style={inputStyle}
          />

          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Check-out</label>
          <input
            type="date"
            value={form.checkOutDate}
            onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })}
            style={inputStyle}
          />

          <button
            onClick={handleReserve}
            disabled={saving}
            style={{
              padding: '0.85rem',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#1a1206',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              marginTop: 'var(--space-1)',
            }}
          >
            {saving ? 'Guardando...' : 'Registrar reservacion (check-in)'}
          </button>
        </div>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '0.6rem',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: '0.9rem',
}