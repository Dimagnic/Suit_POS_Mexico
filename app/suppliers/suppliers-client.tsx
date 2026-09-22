'use client'

import { useState, useTransition } from 'react'
import { createSupplier, updateSupplier, toggleSupplierActive } from './actions'
import { canEditCatalog, type Role } from '@/lib/permissions'

type Supplier = {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_active: boolean
}

const emptyForm = { name: '', contactName: '', phone: '', email: '', notes: '' }

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
}

export default function SuppliersClient({ suppliers, currentRole }: { suppliers: Supplier[]; currentRole: Role }) {
  const canEdit = canEditCatalog(currentRole)
  const [rows, setRows] = useState(suppliers)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [newForm, setNewForm] = useState(emptyForm)
  const [showNew, setShowNew] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(s: Supplier) {
    setEditingId(s.id)
    setForm({ name: s.name, contactName: s.contact_name ?? '', phone: s.phone ?? '', email: s.email ?? '', notes: s.notes ?? '' })
  }

  function handleSaveEdit(id: string) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await updateSupplier(id, form)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => prev.map((s) => s.id === id ? {
        ...s, name: form.name, contact_name: form.contactName || null, phone: form.phone || null,
        email: form.email || null, notes: form.notes || null,
      } : s))
      setEditingId(null)
    })
  }

  function handleToggle(id: string, active: boolean) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await toggleSupplierActive(id, active)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => prev.map((s) => s.id === id ? { ...s, is_active: active } : s))
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    if (!newForm.name.trim()) return
    startTransition(async () => {
      const result = await createSupplier(newForm)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) => [...prev, {
        id: result.id, name: newForm.name, contact_name: newForm.contactName || null, phone: newForm.phone || null,
        email: newForm.email || null, notes: newForm.notes || null, is_active: true,
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
              + Nuevo proveedor
            </button>
          ) : (
            <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-2)' }}>
              <input placeholder="Nombre del proveedor" value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} style={{ ...inputStyle, flex: '1 1 180px' }} />
              <input placeholder="Contacto" value={newForm.contactName} onChange={(e) => setNewForm({ ...newForm, contactName: e.target.value })} style={{ ...inputStyle, width: '150px' }} />
              <input placeholder="Teléfono" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} style={{ ...inputStyle, width: '140px' }} />
              <input placeholder="Correo" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} style={{ ...inputStyle, width: '180px' }} />
              <input placeholder="Notas" value={newForm.notes} onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })} style={{ ...inputStyle, flex: '1 1 150px' }} />
              <button type="submit" disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              <button type="button" onClick={() => setShowNew(false)} style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', cursor: 'pointer' }}>Cancelar</button>
            </form>
          )}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {rows.length === 0 && <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>Sin proveedores todavía.</p>}
        {rows.map((s, idx) => (
          <div key={s.id} style={{ padding: 'var(--space-2)', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', borderLeft: s.is_active ? '3px solid var(--accent)' : '3px solid var(--text-muted)', opacity: s.is_active ? 1 : 0.5 }}>
            {editingId === s.id ? (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: '1 1 150px' }} />
                <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Contacto" style={{ ...inputStyle, width: '150px' }} />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Teléfono" style={{ ...inputStyle, width: '140px' }} />
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Correo" style={{ ...inputStyle, width: '180px' }} />
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas" style={{ ...inputStyle, flex: '1 1 150px' }} />
                <button onClick={() => handleSaveEdit(s.id)} disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>Guardar</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>{s.name}</strong>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {s.contact_name ?? 'sin contacto'} · {s.phone ?? 'sin teléfono'} · {s.email ?? 'sin correo'}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => startEdit(s)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>Editar</button>
                    <button onClick={() => handleToggle(s.id, !s.is_active)} disabled={isPending} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.4rem 0.75rem', color: s.is_active ? 'var(--danger)' : 'var(--success)', cursor: 'pointer', fontSize: '0.8rem' }}>
                      {s.is_active ? 'Desactivar' : 'Activar'}
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
