'use client'

import { useState, useTransition } from 'react'
import { updateMemberRole } from './actions'
import { canManageTeam, ROLE_LABELS, type Role } from '@/lib/permissions'

type Member = {
  id: string
  full_name: string | null
  email: string
  role: Role
  created_at: string
}

const ROLE_OPTIONS: Role[] = ['owner', 'admin', 'manager', 'cashier']

export default function TeamClient({
  members,
  currentRole,
}: {
  members: Member[]
  currentRole: Role
}) {
  const [rows, setRows] = useState(members)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const canEdit = canManageTeam(currentRole)

  function handleRoleChange(memberId: string, newRole: Role) {
    setErrorMsg(null)
    setPendingId(memberId)

    // Optimista: refleja el cambio de inmediato, revertimos si falla
    const previous = rows
    setRows((r) => r.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)))

    startTransition(async () => {
      const result = await updateMemberRole(memberId, newRole)
      setPendingId(null)
      if (result?.error) {
        setRows(previous)
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <div>
      {errorMsg && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--danger)',
            borderLeft: '3px solid var(--danger)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            color: 'var(--danger)',
            fontSize: '0.9rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {rows.map((member, idx) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--space-2)',
              padding: 'var(--space-2)',
              borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              opacity: pendingId === member.id && isPending ? 0.6 : 1,
            }}
          >
            <div>
              <strong style={{ display: 'block' }}>
                {member.full_name || 'Sin nombre'}
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {member.email}
              </span>
            </div>

            {canEdit ? (
              <select
                value={member.role}
                disabled={isPending && pendingId === member.id}
                onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                className="mono"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.85rem',
                }}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  background: 'var(--surface-2)',
                  borderRadius: 'var(--radius)',
                  padding: '0.4rem 0.6rem',
                }}
              >
                {ROLE_LABELS[member.role]}
              </span>
            )}
          </div>
        ))}

        {rows.length === 0 && (
          <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>
            No hay miembros en esta organización.
          </p>
        )}
      </div>
    </div>
  )
}
