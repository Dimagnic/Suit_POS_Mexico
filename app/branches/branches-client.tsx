'use client'

import { useState, useTransition } from 'react'
import { createBranch, updateBranch, setMainBranch } from './actions'
import { canManageTeam, type Role } from '@/lib/permissions'

type Branch = {
  id: string
  name: string
  address: string | null
  is_main: boolean
  created_at: string
}

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  overflow: 'hidden',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-2)',
  padding: 'var(--space-2)',
  borderLeft: '3px solid var(--accent)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.9rem',
}

export default function BranchesClient({
  branches,
  currentRole,
}: {
  branches: Branch[]
  currentRole: Role
}) {
  const canEdit = canManageTeam(currentRole)
  const [rows, setRows] = useState(branches)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(branch: Branch) {
    setEditingId(branch.id)
    setName(branch.name)
    setAddress(branch.address ?? '')
  }

  function handleSaveEdit(branchId: string) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await updateBranch(branchId, name, address)
      if (result?.error) {
        setErrorMsg(result.error)
        return
      }
      setRows((prev) =>
        prev.map((b) => (b.id === branchId ? { ...b, name: name.trim(), address: address.trim() || null } : b))
      )
      setEditingId(null)
    })
  }

  function handleSetMain(branchId: string) {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await setMainBranch(branchId)
      if (result?.error) {
        setErrorMsg(result.error)
        return
      }
      setRows((prev) => prev.map((b) => ({ ...b, is_main: b.id === branchId })))
    })
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    const trimmed = newName.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await createBranch(trimmed, newAddress)
      if (result?.error) {
        setErrorMsg(result.error)
        return
      }
      setRows((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: trimmed,
          address: newAddress.trim() || null,
          is_main: false,
          created_at: new Date().toISOString(),
        },
      ])
      setNewName('')
      setNewAddress('')
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {errorMsg && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--danger)',
            borderLeft: '3px solid var(--danger)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
            color: 'var(--danger)',
            fontSize: '0.85rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      <div>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
          Tus sucursales
        </h2>

        <div style={cardStyle}>
          {rows.map((branch, idx) => (
            <div
              key={branch.id}
              style={{
                ...rowStyle,
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                borderLeft: branch.is_main ? '3px solid var(--accent)' : '3px solid var(--text-muted)',
              }}
            >
              {editingId === branch.id ? (
                <div style={{ display: 'flex', gap: 'var(--space-1)', flex: 1 }}>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Dirección (opcional)"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={() => handleSaveEdit(branch.id)}
                    disabled={isPending}
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--bg)',
                      border: 'none',
                      borderRadius: 'var(--radius)',
                      padding: '0.5rem 1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <strong style={{ display: 'block' }}>
                      {branch.name} {branch.is_main && <span style={{ color: 'var(--accent)', fontSize: '0.8rem' }}>· Principal</span>}
                    </strong>
                    {branch.address && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{branch.address}</span>
                    )}
                  </div>

                  {canEdit && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {!branch.is_main && (
                        <button
                          onClick={() => handleSetMain(branch.id)}
                          disabled={isPending}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)',
                            padding: '0.4rem 0.75rem',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                          }}
                        >
                          Marcar principal
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(branch)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '0.4rem 0.75rem',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Editar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {canEdit && (
        <div>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
            Agregar sucursal
          </h2>
          <form onSubmit={handleCreate} style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <input
              placeholder="Nombre"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <input
              placeholder="Dirección (opcional)"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 'var(--radius)',
                padding: '0.5rem 1rem',
                fontWeight: 600,
                cursor: isPending ? 'default' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Crear
            </button>
          </form>
        </div>
      )}
    </div>
  )
}