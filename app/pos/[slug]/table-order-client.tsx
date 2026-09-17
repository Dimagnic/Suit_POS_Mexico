'use client'

import { useState, useEffect } from 'react'
import {
  getOrCreateOpenOrder,
  getOrderItems,
  addOrderItem,
  changeOrderItemQty,
  closeTableOrder,
} from './table-actions'
import { generarFactura } from './invoice-actions'

type Table = { id: string; name: string; status: string }
type Product = { id: string; name: string; price: number; category: string | null }
type OrderItem = { id: string; product_id: string; quantity: number; unit_price: number; products: { name: string } }

export default function TableOrderClient({
  table,
  products,
  organizationId,
  branchId,
  giroId,
  waiterId,
  onBack,
}: {
  table: Table
  products: Product[]
  organizationId: string
  branchId: string
  giroId: string
  waiterId: string
  onBack: () => void
}) {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [closedResult, setClosedResult] = useState<{ saleId: string; total: number } | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{ success?: boolean; error?: string; uuid?: string } | null>(null)

  useEffect(() => {
    const init = async () => {
      const result = await getOrCreateOpenOrder(table.id, organizationId, waiterId)
      if (result.orderId) {
        setOrderId(result.orderId)
        const orderItems = await getOrderItems(result.orderId)
        setItems(orderItems as any)
      }
      setLoading(false)
    }
    init()
  }, [table.id])

  const refreshItems = async () => {
    if (!orderId) return
    const orderItems = await getOrderItems(orderId)
    setItems(orderItems as any)
  }

  const handleAdd = async (product: Product) => {
    if (!orderId) return
    await addOrderItem(orderId, product.id, product.price)
    await refreshItems()
  }

  const handleQty = async (itemId: string, delta: number) => {
    await changeOrderItemQty(itemId, delta)
    await refreshItems()
  }

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const handleClose = async () => {
    if (!orderId) return
    setClosing(true)
    const result = await closeTableOrder(orderId, table.id, organizationId, branchId, giroId, waiterId)
    setClosing(false)

    if (result.error) {
      alert('Error: ' + result.error)
      return
    }

    setClosedResult({ saleId: result.saleId!, total: result.total! })
  }

  const handleInvoice = async () => {
    if (!closedResult) return
    setInvoiceLoading(true)
    const result = await generarFactura(closedResult.saleId)
    setInvoiceLoading(false)
    setInvoiceResult(result)
  }

  if (loading) {
    return <main style={{ padding: 'var(--space-3)', color: 'var(--text-muted)' }}>Cargando mesa...</main>
  }

  if (closedResult) {
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
        <p style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
          ✓ {table.name} cobrada — Total: ${closedResult.total.toFixed(2)}
        </p>

        {!invoiceResult && (
          <button
            onClick={handleInvoice}
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
            {invoiceLoading ? 'Generando factura...' : 'Generar factura CFDI'}
          </button>
        )}

        {invoiceResult?.success && (
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
            ✓ Facturado — UUID: <span className="mono">{invoiceResult.uuid}</span>
          </p>
        )}

        {invoiceResult?.error && (
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
          Volver a mesas
        </button>
      </main>
    )
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }}>
      <section style={{ flex: '1 1 65%', padding: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-3)' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>
            ← Mesas
          </button>
          <h1 style={{ fontSize: '1.25rem' }}>🍽️ {table.name}</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => handleAdd(p)}
              style={{
                textAlign: 'left',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{p.name}</strong>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {p.category ?? 'General'}
              </p>
              <p className="mono" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent)' }}>
                ${p.price.toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </section>

      <aside
        style={{
          flex: '1 1 35%',
          background: 'var(--surface-2)',
          padding: 'var(--space-3)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Comanda — {table.name}</h2>

        {items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin productos todavía.</p>}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{item.products?.name}</p>
                <small className="mono" style={{ color: 'var(--text-muted)' }}>
                  ${item.unit_price.toFixed(2)} c/u
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => handleQty(item.id, -1)} style={qtyBtnStyle}>−</button>
                <span className="mono" style={{ minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => handleQty(item.id, 1)} style={qtyBtnStyle}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
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

          <button
            onClick={handleClose}
            disabled={items.length === 0 || closing}
            style={{
              width: '100%',
              padding: '0.85rem',
              marginTop: 'var(--space-2)',
              background: items.length === 0 ? 'var(--border)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: items.length === 0 ? 'var(--text-muted)' : '#1a1206',
              fontWeight: 600,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {closing ? 'Cobrando...' : 'Cobrar mesa'}
          </button>
        </div>
      </aside>
    </main>
  )
}

const qtyBtnStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1,
}