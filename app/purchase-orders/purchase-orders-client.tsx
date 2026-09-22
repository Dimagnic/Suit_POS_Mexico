'use client'

import { useState, useTransition } from 'react'
import { createPurchaseOrder, markPurchaseOrderReceived, cancelPurchaseOrder } from './actions'
import { canEditCatalog, type Role } from '@/lib/permissions'

type Supplier = { id: string; name: string }
type Product = { id: string; name: string; sku: string | null; unit: string; cost: number; giroNombre: string }
type OrderItem = { id: string; productName: string; unit: string; quantity: number; unitCost: number }
type Order = {
  id: string
  status: 'ordered' | 'received' | 'canceled'
  notes: string | null
  createdAt: string
  receivedAt: string | null
  supplierName: string
  items: OrderItem[]
  total: number
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
}

const STATUS_LABELS: Record<Order['status'], string> = {
  ordered: 'Ordenada',
  received: 'Recibida',
  canceled: 'Cancelada',
}

const STATUS_COLORS: Record<Order['status'], string> = {
  ordered: 'var(--accent)',
  received: 'var(--success)',
  canceled: 'var(--text-muted)',
}

export default function PurchaseOrdersClient({
  orders,
  suppliers,
  products,
  currentRole,
}: {
  orders: Order[]
  suppliers: Supplier[]
  products: Product[]
  currentRole: Role
}) {
  const canEdit = canEditCatalog(currentRole)
  const [rows, setRows] = useState(orders)
  const [showNew, setShowNew] = useState(false)
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [draftItems, setDraftItems] = useState<{ productId: string; quantity: string; unitCost: string }[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function addDraftItem() {
    setDraftItems((prev) => [...prev, { productId: '', quantity: '1', unitCost: '' }])
  }

  function updateDraftItem(idx: number, field: 'productId' | 'quantity' | 'unitCost', value: string) {
    setDraftItems((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      if (field === 'productId') {
        const product = products.find((p) => p.id === value)
        if (product && !copy[idx].unitCost) copy[idx].unitCost = String(product.cost)
      }
      return copy
    })
  }

  function removeDraftItem(idx: number) {
    setDraftItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const items = draftItems
      .filter((d) => d.productId)
      .map((d) => ({
        productId: d.productId,
        quantity: parseFloat(d.quantity) || 0,
        unitCost: parseFloat(d.unitCost) || 0,
      }))

    startTransition(async () => {
      const result = await createPurchaseOrder(supplierId, items, notes)
      if (result?.error) { setErrorMsg(result.error); return }

      const supplier = suppliers.find((s) => s.id === supplierId)
      const newOrder: Order = {
        id: result.id,
        status: 'ordered',
        notes: notes.trim() || null,
        createdAt: new Date().toISOString(),
        receivedAt: null,
        supplierName: supplier?.name ?? '—',
        items: items.map((i) => {
          const p = products.find((pr) => pr.id === i.productId)
          return { id: crypto.randomUUID(), productName: p?.name ?? '—', unit: p?.unit ?? '', quantity: i.quantity, unitCost: i.unitCost }
        }),
        total: items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0),
      }
      setRows((prev) => [newOrder, ...prev])
      setSupplierId('')
      setNotes('')
      setDraftItems([])
      setShowNew(false)
    })
  }

  function handleReceive(id: string) {
    setErrorMsg(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await markPurchaseOrderReceived(id)
      setBusyId(null)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => prev.map((o) => o.id === id ? { ...o, status: 'received', receivedAt: new Date().toISOString() } : o))
    })
  }

  function handleCancel(id: string) {
    setErrorMsg(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await cancelPurchaseOrder(id)
      setBusyId(null)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => prev.map((o) => o.id === id ? { ...o, status: 'canceled' } : o))
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {errorMsg && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--danger)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius)', padding: 'var(--space-2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
          {errorMsg}
        </div>
      )}

      {canEdit && (
        <div>
          {!showNew ? (
            <button onClick={() => setShowNew(true)} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>
              + Nueva orden de compra
            </button>
          ) : (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3)' }}>
              {suppliers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Primero necesitas dar de alta un proveedor en <a href="/suppliers" style={{ color: 'var(--accent)' }}>/suppliers</a>.
                </p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={{ ...inputStyle, minWidth: '200px' }}>
                      <option value="">Elige un proveedor</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input placeholder="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, flex: '1 1 200px' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {draftItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={item.productId} onChange={(e) => updateDraftItem(idx, 'productId', e.target.value)} style={{ ...inputStyle, flex: '1 1 220px' }}>
                          <option value="">Elige un producto</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.giroNombre})</option>)}
                        </select>
                        <input type="number" step="0.01" placeholder="Cantidad" value={item.quantity} onChange={(e) => updateDraftItem(idx, 'quantity', e.target.value)} style={{ ...inputStyle, width: '100px' }} />
                        <input type="number" step="0.01" placeholder="Costo unit." value={item.unitCost} onChange={(e) => updateDraftItem(idx, 'unitCost', e.target.value)} style={{ ...inputStyle, width: '110px' }} />
                        <button type="button" onClick={() => removeDraftItem(idx)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.6rem', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                      </div>
                    ))}
                    <button type="button" onClick={addDraftItem} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      + Agregar producto
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="submit" disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>Crear orden</button>
                    <button type="button" onClick={() => setShowNew(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {rows.length === 0 && <p style={{ color: 'var(--text-muted)' }}>Sin órdenes de compra todavía.</p>}
        {rows.map((o) => (
          <div key={o.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: `3px solid ${STATUS_COLORS[o.status]}`, borderRadius: 'var(--radius)', padding: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div>
                <strong>{o.supplierName}</strong>{' '}
                <span style={{ color: STATUS_COLORS[o.status], fontSize: '0.8rem', fontWeight: 600 }}>· {STATUS_LABELS[o.status]}</span>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {new Date(o.createdAt).toLocaleString('es-MX')} {o.notes ? `· ${o.notes}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="mono" style={{ color: 'var(--accent)' }}>${o.total.toFixed(2)}</span>
                {canEdit && o.status === 'ordered' && (
                  <>
                    <button onClick={() => handleReceive(o.id)} disabled={isPending && busyId === o.id} style={{ background: 'var(--success)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                      Marcar recibida
                    </button>
                    <button onClick={() => handleCancel(o.id)} disabled={isPending && busyId === o.id} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      Cancelar
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {o.items.map((it) => (
                <div key={it.id}>{it.productName} — {it.quantity} {it.unit} × ${it.unitCost.toFixed(2)}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
