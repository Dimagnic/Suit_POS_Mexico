'use client'

import { useState, useTransition } from 'react'
import { crearCheckoutParaGiro } from './actions'
import { canManageTeam, type Role } from '@/lib/permissions'

type Giro = {
  id: string
  slug: string
  nombre: string
  icono: string | null
  categoria: string
  stripe_price_id: string | null
  estado: string | null
}

export default function SubscriptionClient({
  giros,
  currentRole,
}: {
  giros: Giro[]
  currentRole: Role
}) {
  const canManage = canManageTeam(currentRole)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleActivar(giroId: string) {
    setErrorMsg(null)
    setLoadingId(giroId)
    startTransition(async () => {
      const result = await crearCheckoutParaGiro(giroId)
      if (result?.error) {
        setErrorMsg(result.error)
        setLoadingId(null)
        return
      }
      if (result?.url) {
        window.location.href = result.url
      }
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        {giros.map((giro) => {
          const activo = giro.estado === 'active'
          return (
            <div
              key={giro.id}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: activo ? '3px solid var(--success)' : '3px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{giro.icono}</div>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{giro.nombre}</strong>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.75rem', textTransform: 'capitalize' }}>
                {giro.categoria}
              </p>

              {activo ? (
                <span
                  style={{
                    display: 'inline-block',
                    color: 'var(--success)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  ✓ Activo
                </span>
              ) : canManage ? (
                <button
                  onClick={() => handleActivar(giro.id)}
                  disabled={isPending && loadingId === giro.id}
                  style={{
                    width: '100%',
                    background: 'var(--accent)',
                    color: 'var(--bg)',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    padding: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isPending && loadingId === giro.id ? 'default' : 'pointer',
                    opacity: isPending && loadingId === giro.id ? 0.6 : 1,
                  }}
                >
                  {isPending && loadingId === giro.id ? 'Redirigiendo...' : 'Activar — $299/mes'}
                </button>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No activo</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}