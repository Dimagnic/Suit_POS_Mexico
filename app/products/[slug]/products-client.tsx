'use client'

import { useState, useTransition } from 'react'
import { createProduct, updateProduct, toggleProductActive } from '../actions'
import { canEditCatalog, type Role } from '@/lib/permissions'

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  cost: number
  stock_quantity: number
  unit: string
  category: string | null
  duration_minutes: number | null
  is_active: boolean
}

const emptyForm = { sku: '', name: '', price: '', cost: '', stockQuantity: '', unit: 'pza', category: '', durationMinutes: '' }

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
}

export default function ProductsClient({
  giroId,
  products,
  currentRole,
}: {
  giroId: string
  products: Product[]
  currentRole: Role
}) {
  const canEdit = canEditCatalog(currentRole)
  const [rows, setRows] = useState(products)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)
  const [showNew, setShowNew] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function toInput(input: typeof emptyForm) {
    return {
      sku: input.sku,
      name: input.name,
      price: parseFloat(input.price) || 0,
      cost: parseFloat(input.cost) || 0,
      stockQuantity: parseFloat(input.stockQuantity) || 0,
      unit: input.unit,
      category: input.category,
      durationMinutes: input.durationMinutes ? parseInt(input.durationMinutes) : null,
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setForm({
      sku: p.sku ?? '', name: p.name, price: String(p.price), cost: String(p.cost),
      stockQuantity: String(p.stock_quantity), unit: p.unit, category: p.category ?? '',
      durationMinutes: p.duration_minutes ? String(p.duration_minutes) : '',
    })
  }

  function handleSaveEdit(id: string) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await updateProduct(id, toInput(form))
      if (result?.error) { setErrorMsg(result.error); return }
      const updated = toInput(form)
      setRows((prev) => prev.map((p) => p.id === id ? {
        ...p, sku: updated.sku || null, name: updated.name, price: updated.price, cost: updated.cost,
        stock_quantity: updated.stockQuantity, unit: updated.unit, category: updated.category || null,
        duration_minutes: updated.durationMinutes,
      } : p))
      setEditingId(null)
    })
  }

  function handleToggle(id: string, active: boolean) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await toggleProductActive(id, active)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => prev.map((p) => p.id === id ? { ...p, is_active: active } : p))
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    if (!newForm.name.trim()) return
    startTransition(async () => {
      const input = toInput(newForm)
      const result = await createProduct(giroId, input)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => [...prev, {
        id: crypto.randomUUID(), sku: input.sku || null, name: input.name, price: input.price,
        cost: input.cost, stock_quantity: input.stockQuantity, unit: input.unit,
        category: input.category || null, duration_minutes: input.durationMinutes, is_active: true,
      }])
      setNewForm(emptyForm)
      setShowNew(false)
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
              + Nuevo producto
            </button>
          ) : (
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-2)' }}>
              <input placeholder="Nombre" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} style={{ ...inputStyle, flex: '1 1 150px' }} />
              <input placeholder="SKU" value={newForm.sku} onChange={(e) => setNewForm({ ...newForm, sku: e.target.value })} style={{ ...inputStyle, width: '110px' }} />
              <input placeholder="Precio" type="number" step="0.01" value={newForm.price} onChange={(e) => setNewForm({ ...newForm, price: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
              <input placeholder="Costo" type="number" step="0.01" value={newForm.cost} onChange={(e) => setNewForm({ ...newForm, cost: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
              <input placeholder="Stock" type="number" value={newForm.stockQuantity} onChange={(e) => setNewForm({ ...newForm, stockQuantity: e.target.value })} style={{ ...inputStyle, width: '80px' }} />
              <input placeholder="Unidad" value={newForm.unit} onChange={(e) => setNewForm({ ...newForm, unit: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
              <input placeholder="Categoría" value={newForm.category} onChange={(e) => setNewForm({ ...newForm, category: e.target.value })} style={{ ...inputStyle, width: '130px' }} />
              <input placeholder="Min. (citas)" type="number" value={newForm.durationMinutes} onChange={(e) => setNewForm({ ...newForm, durationMinutes: e.target.value })} style={{ ...inputStyle, width: '100px' }} />
              <button type="submit" disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              <button type="button" onClick={() => setShowNew(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancelar</button>
            </form>
          )}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {rows.length === 0 && <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>Sin productos todavía.</p>}
        {rows.map((p, idx) => (
          <div key={p.id} style={{ padding: 'var(--space-2)', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', borderLeft: p.is_active ? '3px solid var(--accent)' : '3px solid var(--text-muted)', opacity: p.is_active ? 1 : 0.5 }}>
            {editingId === p.id ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: '1 1 150px' }} />
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU" style={{ ...inputStyle, width: '110px' }} />
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
                <input type="number" step="0.01" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
                <input type="number" value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} style={{ ...inputStyle, width: '80px' }} />
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ ...inputStyle, width: '90px' }} />
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ ...inputStyle, width: '130px' }} />
                <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} placeholder="Min." style={{ ...inputStyle, width: '90px' }} />
                <button onClick={() => handleSaveEdit(p.id)} disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>{p.name}</strong>{' '}
                  <span className="mono" style={{ color: 'var(--accent)' }}>${p.price.toFixed(2)}</span>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {p.sku ?? 's/n'} · {p.category ?? 'sin categoría'} · Stock: {p.stock_quantity} {p.unit}
                    {p.duration_minutes ? ` · ${p.duration_minutes} min` : ''}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => startEdit(p)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>Editar</button>
                    <button onClick={() => handleToggle(p.id, !p.is_active)} disabled={isPending} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: p.is_active ? 'var(--danger)' : 'var(--success)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      {p.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}