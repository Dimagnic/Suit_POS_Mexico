'use client'

import { useState } from 'react'
import TableOrderClient from './table-order-client'
import { getTables, createTable, createMultipleTables, renameTable, deleteTable } from './table-actions'
import { canManageTeam, type Role } from '@/lib/permissions'

type Table = { id: string; name: string; status: string }
type Product = { id: string; name: string; price: number; category: string | null }

export default function TablesClient({
  tables,
  products,
  organizationId,
  branchId,
  giroId,
  giroSlug,
  giroNombre,
  giroIcono,
  waiterId,
  currentRole,
}: {
  tables: Table[]
  products: Product[]
  organizationId: string
  branchId: string
  giroId: string
  giroSlug: string
  giroNombre: string
  giroIcono: string | null
  waiterId: string
  currentRole: Role
}) {
  const [tableList, setTableList] = useState<Table[]>(tables)
  const [selectedTable, setSelectedTable] = useState<Table | null>(null)
  const [showManageModal, setShowManageModal] = useState(false)

  const [nuevoNombre, setNuevoNombre] = useState('')
  const [prefijo, setPrefijo] = useState('Mesa')
  const [cantidad, setCantidad] = useState(1)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const puedeGestionar = canManageTeam(currentRole)

  const refreshTables = async () => {
    const updated = await getTables(organizationId, giroId)
    setTableList(updated as Table[])
  }

  const handleBack = async () => {
    await refreshTables()
    setSelectedTable(null)
  }

  const handleAddOne = async () => {
    setActionLoading(true)
    setActionError(null)
    const result = await createTable(giroId, branchId, nuevoNombre)
    setActionLoading(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setNuevoNombre('')
    await refreshTables()
  }

  const handleAddBulk = async () => {
    setActionLoading(true)
    setActionError(null)
    const result = await createMultipleTables(giroId, branchId, cantidad, prefijo)
    setActionLoading(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    await refreshTables()
  }

  const handleRename = async (tableId: string) => {
    setActionLoading(true)
    setActionError(null)
    const result = await renameTable(tableId, renameValue)
    setActionLoading(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    setRenamingId(null)
    setRenameValue('')
    await refreshTables()
  }

  const handleDelete = async (tableId: string) => {
    if (!confirm('¿Eliminar esta mesa? Esta acción no se puede deshacer.')) return
    setActionLoading(true)
    setActionError(null)
    const result = await deleteTable(tableId)
    setActionLoading(false)
    if (result.error) {
      setActionError(result.error)
      return
    }
    await refreshTables()
  }

  if (selectedTable) {
    return (
      <TableOrderClient
        table={selectedTable}
        products={products}
        organizationId={organizationId}
        branchId={branchId}
        giroId={giroId}
        giroSlug={giroSlug}
        giroIcono={giroIcono}
        waiterId={waiterId}
        onBack={handleBack}
      />
    )
  }

  return (
    <main style={{ padding: 'var(--space-3)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ← Volver
          </a>
          <h1 style={{ fontSize: '1.25rem' }}>{giroIcono} {giroNombre} — Mesas</h1>
        </div>
        {puedeGestionar && (
          <button
            onClick={() => setShowManageModal(true)}
            style={{
              padding: '0.5rem 0.9rem',
              background: 'transparent',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Gestionar Mesas
          </button>
        )}
      </div>

      {tableList.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>
          Todavía no hay mesas creadas.
          {puedeGestionar ? ' Dale clic a "Gestionar Mesas" para crear las primeras.' : ' Pídele a un administrador que las cree.'}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        {tableList.map((t) => {
          const occupied = t.status === 'occupied'
          return (
            <button
              key={t.id}
              onClick={() => setSelectedTable(t)}
              style={{
                background: occupied ? 'var(--surface-2)' : 'var(--surface)',
                border: occupied ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderLeft: occupied ? '3px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-3) var(--space-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{giroIcono ?? '🍽️'}</div>
              <strong>{t.name}</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: occupied ? 'var(--accent)' : 'var(--text-muted)' }}>
                {occupied ? 'Ocupada' : 'Disponible'}
              </p>
            </button>
          )
        })}
      </div>

      {showManageModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-3)',
              width: '90%',
              maxWidth: '480px',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <h3 style={{ margin: 0 }}>Gestionar Mesas</h3>
              <button
                onClick={() => setShowManageModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {actionError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>✕ {actionError}</p>
            )}

            <div style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Crear varias mesas de una vez
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  placeholder="Prefijo (ej. Mesa, Barra)"
                  value={prefijo}
                  onChange={(e) => setPrefijo(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={cantidad}
                  onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
                  style={{ ...inputStyle, width: '80px' }}
                />
              </div>
              <button onClick={handleAddBulk} disabled={actionLoading} style={primaryBtnStyle}>
                Crear {cantidad} mesa(s) — se llamarán &quot;{prefijo || 'Mesa'} 1&quot; a &quot;{prefijo || 'Mesa'} {cantidad}&quot;
              </button>
            </div>

            <div style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                O agregar una mesa con nombre específico
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  placeholder="Ej. Terraza 1, Barra Principal"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  style={inputStyle}
                />
                <button onClick={handleAddOne} disabled={actionLoading} style={primaryBtnStyle}>
                  Agregar
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Mesas actuales ({tableList.length})
            </p>
            {tableList.map((t) => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {renamingId === t.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      style={{ ...inputStyle, marginBottom: 0 }}
                    />
                    <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.5rem' }}>
                      <button onClick={() => handleRename(t.id)} style={smallBtnStyle}>✓</button>
                      <button onClick={() => setRenamingId(null)} style={smallBtnStyle}>✕</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span>
                      {t.name}{' '}
                      <span style={{ fontSize: '0.75rem', color: t.status === 'occupied' ? 'var(--accent)' : 'var(--text-muted)' }}>
                        ({t.status === 'occupied' ? 'Ocupada' : 'Disponible'})
                      </span>
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => {
                          setRenamingId(t.id)
                          setRenameValue(t.name)
                        }}
                        style={smallBtnStyle}
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={t.status === 'occupied'}
                        style={{ ...smallBtnStyle, color: 'var(--danger)', opacity: t.status === 'occupied' ? 0.4 : 1 }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '0.5rem 0.8rem',
  background: 'var(--accent)',
  color: '#1a1206',
  border: 'none',
  borderRadius: 'var(--radius)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
}

const smallBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.75rem',
}