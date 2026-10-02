'use client'

import { useState } from 'react'
import { dispenseFuel } from './gas-actions'
import { generarFactura } from './invoice-actions'
import PosToolsBar from './pos-tools'
import { printTicket } from '@/lib/ticket'
import InvoiceModal, { type Receptor } from './invoice-modal'

type Pump = { id: string; name: string }
type Fuel = { id: string; name: string; price: number }
type Receipt = {
  pumpName: string
  fuelName: string
  liters: number
  unitPrice: number
  subtotal: number
  tax: number
  total: number
}

const SCAN_HINT = 'No aplica en gasolinera: el combustible se elige de una lista corta. El escaner se usa en giros con catalogo amplio de productos.'

export default function GasClient({
  pumps,
  fuels,
  organizationId,
  branchId,
  giroId,
  giroNombre,
  giroIcono,
  cashierId,
}: {
  pumps: Pump[]
  fuels: Fuel[]
  organizationId: string
  branchId: string
  giroId: string
  giroNombre: string
  giroIcono: string | null
  cashierId: string
}) {
  const [pumpId, setPumpId] = useState('')
  const [fuelId, setFuelId] = useState('')
  const [liters, setLiters] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ saleId: string; total: number } | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{ success?: boolean; error?: string; uuid?: string; pdfBase64?: string | null; xmlBase64?: string | null } | null>(null)

  const selectedFuel = fuels.find((f) => f.id === fuelId)
  const litersNum = parseFloat(liters) || 0
  const subtotal = selectedFuel ? selectedFuel.price * litersNum : 0
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const canDispense = pumpId && fuelId && litersNum > 0

  const handleDispense = async () => {
    if (!canDispense || !selectedFuel) return
    setSaving(true)

    const res = await dispenseFuel({
      organizationId,
      branchId,
      giroId,
      pumpId,
      productId: selectedFuel.id,
      unitPrice: selectedFuel.price,
      liters: litersNum,
      cashierId,
    })

    setSaving(false)

    if (res.error) {
      alert('Error: ' + res.error)
      return
    }

    setReceipt({
      pumpName: pumps.find((p) => p.id === pumpId)?.name ?? '',
      fuelName: selectedFuel.name,
      liters: litersNum,
      unitPrice: selectedFuel.price,
      subtotal,
      tax,
      total: res.total!,
    })
    setResult({ saleId: res.saleId!, total: res.total! })
  }

  const handleInvoiceSubmit = async (receptor?: Receptor) => {
    if (!result) return
    setInvoiceLoading(true)
    const res = await generarFactura(result.saleId, receptor)
    setInvoiceLoading(false)
    setInvoiceResult(res)
    if (!res.error) setShowInvoiceModal(false)
  }

  const handlePrint = () => {
    if (!receipt) return
    printTicket({
      title: giroNombre,
      subtitle: receipt.pumpName,
      lines: [
        {
          label: receipt.fuelName + ' ' + receipt.liters.toFixed(2) + ' L x $' + receipt.unitPrice.toFixed(2),
          amount: receipt.subtotal,
        },
      ],
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      total: receipt.total,
    })
  }

  const handleReset = () => {
    setPumpId('')
    setFuelId('')
    setLiters('')
    setResult(null)
    setReceipt(null)
    setInvoiceResult(null)
  }

  if (result) {
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
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <PosToolsBar
            scanNotApplicableHint={SCAN_HINT}
            onPrint={handlePrint}
            printEnabled={true}
            printDisabledHint=""
          />
        </div>

        <p style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
          ✓ Despacho registrado — Total: ${result.total.toFixed(2)}
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
          <div style={{ width: '100%', maxWidth: '420px' }}>
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
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>✗ {invoiceResult.error}</p>
        )}

        <button
          onClick={handleReset}
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
          Nuevo despacho
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
    <main style={{ padding: 'var(--space-3)', maxWidth: '420px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.25rem' }}>{giroIcono} {giroNombre}</h1>
      </div>

      <PosToolsBar
        scanNotApplicableHint={SCAN_HINT}
        onPrint={handlePrint}
        printEnabled={false}
        printDisabledHint="Se habilita despues de cobrar el despacho."
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Bomba</label>
        <select value={pumpId} onChange={(e) => setPumpId(e.target.value)} style={inputStyle}>
          <option value="">Selecciona una bomba...</option>
          {pumps.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Combustible</label>
        <select value={fuelId} onChange={(e) => setFuelId(e.target.value)} style={inputStyle}>
          <option value="">Selecciona combustible...</option>
          {fuels.map((f) => <option key={f.id} value={f.id}>{f.name} — ${f.price.toFixed(2)}/L</option>)}
        </select>

        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Litros</label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={liters}
          onChange={(e) => setLiters(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
        />

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span className="mono">${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span>IVA (16%)</span>
            <span className="mono">${tax.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 600 }}>
            <span>Total</span>
            <span className="mono">${total.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleDispense}
          disabled={!canDispense || saving}
          style={{
            padding: '0.85rem',
            marginTop: 'var(--space-1)',
            background: canDispense ? 'var(--accent)' : 'var(--border)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: canDispense ? '#1a1206' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: canDispense ? 'pointer' : 'not-allowed',
          }}
        >
          {saving ? 'Procesando...' : 'Cobrar despacho'}
        </button>
      </div>
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