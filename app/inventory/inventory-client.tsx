'use client'

import { useState, useTransition } from 'react'
import { updateReorderPoint } from './actions'

type Item = {
  id: string
  name: string
  sku: string | null
  stockQuantity: number
  reorderPoint: number | null
  unit: string
  giroNombre: string
  bajoUmbral: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0.4rem 0.6rem', fontSize: '0.85rem', width: '80px',
}

export default function InventoryClient({ items }: { items: Item[] }) {
  const [rows, setRows] = useState(items)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const bajoUmbralCount = rows.filter((r) => r.bajoUmbral).length

  function handleSave(id: string) {
    setErrorMsg(null)
    const raw = drafts[id]
    const parsed = raw === '' || raw === undefined ? null : parseInt(raw)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      setErrorMsg('El umbral debe ser un número mayor o igual a 0.')
      return
    }

    startTransition(async () => {
      const result = await updateReorderPoint(id, parsed)
      if (result?.error) { setErrorMsg(result.error); return }
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, reorderPoint: parsed, bajoUmbral: parsed !== null && r.stockQuantity < parsed } : r))
      )
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {bajoUmbralCount > 0 && (
        <div
          style={{
            background: 'var(--surface)', border: '1px solid var(--danger)', borderLeft: '3px solid var(--danger)',
            borderRadius: 'var(--radius)', padding: 'var(--space-2)', color: 'var(--danger)', fontSize: '0.9rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem',
          }}
        >
          <span>{bajoUmbralCount} producto(s) por debajo de su umbral de reabastecimiento.</span>
          <a href="/purchase-orders" style={{ color: 'var(--danger)', fontWeight: 600, textDecoration: 'underline' }}>
            Crear orden de compra →
          </a>
        </div>
      )}

      {errorMsg && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--danger)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius)', padding: 'var(--space-2)', color: 'var(--danger)', fontSize: '0.85rem' }}>
          {errorMsg}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        {rows.length === 0 && <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>Sin productos activos todavía.</p>}
        {rows.map((r, idx) => (
          <div
            key={r.id}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
              padding: 'var(--space-2)', borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
              borderLeft: r.bajoUmbral ? '3px solid var(--danger)' : '3px solid var(--accent)',
            }}
          >
            <div>
              <strong>{r.name}</strong>{' '}
              {r.bajoUmbral && (
                <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>· BAJO</span>
              )}
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {r.giroNombre} · {r.sku ?? 's/n'}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="mono" style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.1rem', color: r.bajoUmbral ? 'var(--danger)' : 'var(--text)' }}>
                  {r.stockQuantity} {r.unit}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>en stock</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Umbral</label>
                <input
                  type="number"
                  min={0}
                  placeholder="—"
                  value={drafts[r.id] ?? (r.reorderPoint ?? '')}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  style={inputStyle}
                />
                <button
                  onClick={() => handleSave(r.id)}
                  disabled={isPending}
                  style={{
                    background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)',
                    padding: '0.4rem 0.75rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                  }}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
