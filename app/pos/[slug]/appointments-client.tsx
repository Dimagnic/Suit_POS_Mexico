'use client'

import { useState } from 'react'
import {
  createAppointment,
  updateAppointmentStatus,
  completeAppointment,
  getAppointments,
} from './appointment-actions'
import { generarFactura } from './invoice-actions'

type Service = { id: string; name: string; price: number; duration_minutes: number | null }
type Appointment = {
  id: string
  customer_name: string
  customer_phone: string | null
  starts_at: string
  ends_at: string | null
  status: 'pendiente' | 'confirmada' | 'en_curso' | 'completada' | 'cancelada' | 'no_asistio'
  sale_id: string | null
  service_product_id: string
  products: { name: string; price: number; duration_minutes: number | null }
}

const STATUS_LABEL: Record<Appointment['status'], string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  no_asistio: 'No asistió',
}

const STATUS_COLOR: Record<Appointment['status'], string> = {
  pendiente: 'var(--text-muted)',
  confirmada: 'var(--accent)',
  en_curso: 'var(--accent)',
  completada: 'var(--success)',
  cancelada: 'var(--danger)',
  no_asistio: 'var(--danger)',
}

export default function AppointmentsClient({
  initialAppointments,
  services,
  organizationId,
  branchId,
  giroId,
  giroSlug,
  giroNombre,
  giroIcono,
  cashierId,
  today,
}: {
  initialAppointments: Appointment[]
  services: Service[]
  organizationId: string
  branchId: string
  giroId: string
  giroSlug: string
  giroNombre: string
  giroIcono: string | null
  cashierId: string
  today: string
}) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState<string | null>(null)
  const [invoiceResults, setInvoiceResults] = useState<Record<string, { success?: boolean; error?: string; uuid?: string }>>({})

  const [form, setForm] = useState({ serviceId: '', customerName: '', customerPhone: '', time: '' })

  const refresh = async () => {
    const updated = await getAppointments(organizationId, giroId, today)
    setAppointments(updated as Appointment[])
  }

  const handleCreate = async () => {
    if (!form.serviceId || !form.customerName || !form.time) return
    setSaving(true)
    const service = services.find((s) => s.id === form.serviceId)!
    const startsAt = `${today}T${form.time}:00`

    const result = await createAppointment({
      organizationId,
      branchId,
      giroId,
      serviceProductId: form.serviceId,
      customerName: form.customerName,
      customerPhone: form.customerPhone,
      startsAt,
      durationMinutes: service.duration_minutes ?? 30,
    })

    setSaving(false)
    if (result.error) {
      alert('Error: ' + result.error)
      return
    }
    setForm({ serviceId: '', customerName: '', customerPhone: '', time: '' })
    setShowForm(false)
    await refresh()
  }

  const handleStatus = async (id: string, status: 'confirmada' | 'en_curso' | 'cancelada' | 'no_asistio') => {
    await updateAppointmentStatus(id, status)
    await refresh()
  }

  const handleComplete = async (id: string) => {
    const result = await completeAppointment(id, organizationId, branchId, giroId, giroSlug, cashierId)
    if (result.error) {
      alert('Error: ' + result.error)
      return
    }
    await refresh()
  }

  const handleInvoice = async (appointmentId: string, saleId: string) => {
    setInvoiceLoading(appointmentId)
    const result = await generarFactura(saleId)
    setInvoiceLoading(null)
    setInvoiceResults((prev) => ({ ...prev, [appointmentId]: result }))
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

  return (
    <main style={{ padding: 'var(--space-3)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Volver</a>
          <h1 style={{ fontSize: '1.25rem' }}>{giroIcono} {giroNombre} — Agenda de hoy</h1>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#1a1206',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancelar' : '+ Nueva cita'}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 'var(--space-2)',
            alignItems: 'end',
          }}
        >
          <label style={fieldStyle}>
            Servicio
            <select
              value={form.serviceId}
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Selecciona…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — ${s.price.toFixed(2)} ({s.duration_minutes ?? 30} min)
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            Cliente
            <input
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              style={inputStyle}
              placeholder="Nombre"
            />
          </label>

          <label style={fieldStyle}>
            Teléfono (opcional)
            <input
              value={form.customerPhone}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              style={inputStyle}
              placeholder="10 dígitos"
            />
          </label>

          <label style={fieldStyle}>
            Hora
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              style={inputStyle}
            />
          </label>

          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: '0.6rem',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#1a1206',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : 'Agendar'}
          </button>
        </div>
      )}

      {appointments.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No hay citas agendadas para hoy.</p>
      )}

      <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
        {appointments.map((a) => (
          <div
            key={a.id}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${STATUS_COLOR[a.status]}`,
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 'var(--space-2)',
            }}
          >
            <div>
              <span className="mono" style={{ color: 'var(--accent)', fontSize: '1rem' }}>
                {formatTime(a.starts_at)}
              </span>{' '}
              <strong>{a.customer_name}</strong>
              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {a.products?.name}
                {a.customer_phone ? ` · ${a.customer_phone}` : ''}
              </p>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: STATUS_COLOR[a.status] }}>
                {STATUS_LABEL[a.status]}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {a.status === 'pendiente' && (
                <>
                  <button onClick={() => handleStatus(a.id, 'confirmada')} style={actionBtnStyle}>Confirmar</button>
                  <button onClick={() => handleStatus(a.id, 'cancelada')} style={actionBtnStyle}>Cancelar</button>
                </>
              )}
              {a.status === 'confirmada' && (
                <>
                  <button onClick={() => handleStatus(a.id, 'en_curso')} style={actionBtnStyle}>Iniciar</button>
                  <button onClick={() => handleStatus(a.id, 'no_asistio')} style={actionBtnStyle}>No asistió</button>
                </>
              )}
              {a.status === 'en_curso' && (
                <button onClick={() => handleComplete(a.id)} style={{ ...actionBtnStyle, background: 'var(--accent)', color: '#1a1206' }}>
                  Completar y cobrar
                </button>
              )}
              {a.status === 'completada' && a.sale_id && !invoiceResults[a.id] && (
                <button
                  onClick={() => handleInvoice(a.id, a.sale_id!)}
                  disabled={invoiceLoading === a.id}
                  style={actionBtnStyle}
                >
                  {invoiceLoading === a.id ? 'Generando…' : 'Generar factura CFDI'}
                </button>
              )}
              {invoiceResults[a.id]?.success && (
                <span style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                  ✓ UUID: <span className="mono">{invoiceResults[a.id].uuid}</span>
                </span>
              )}
              {invoiceResults[a.id]?.error && (
                <span style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>✕ {invoiceResults[a.id].error}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.8rem',
  color: 'var(--text-muted)',
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.4rem 0.7rem',
  fontSize: '0.8rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
}