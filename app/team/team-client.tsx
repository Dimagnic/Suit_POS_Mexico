'use client'

import { useState, useTransition } from 'react'
import { updateMemberRole, createInvite, cancelInvite } from './actions'
import { canManageTeam, assignableRoles, ROLE_LABELS, type Role } from '@/lib/permissions'

type Member = {
  id: string
  full_name: string | null
  email: string
  role: Role
  created_at: string
}

type Invite = {
  id: string
  email: string
  role: Role
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

const selectStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '0.4rem 0.6rem',
  fontSize: '0.85rem',
}

export default function TeamClient({
  members,
  currentRole,
  invites,
}: {
  members: Member[]
  currentRole: Role
  invites: Invite[]
}) {
  const canEdit = canManageTeam(currentRole)
  const myAssignableRoles = assignableRoles(currentRole)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <MembersSection members={members} canEdit={canEdit} myAssignableRoles={myAssignableRoles} />
      {canEdit && (
        <InvitesSection invites={invites} myAssignableRoles={myAssignableRoles} />
      )}
    </div>
  )
}

function MembersSection({
  members,
  canEdit,
  myAssignableRoles,
}: {
  members: Member[]
  canEdit: boolean
  myAssignableRoles: Role[]
}) {
  const [rows, setRows] = useState(members)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRoleChange(memberId: string, newRole: Role) {
    setErrorMsg(null)
    setPendingId(memberId)

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
      <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
        Miembros
      </h2>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      <div style={cardStyle}>
        {rows.map((member, idx) => {
          // Un usuario solo puede asignar, a otro miembro, un rol que él mismo
          // podría asignar Y que no exceda su propio rango de gestión.
          const rowIsEditable =
            canEdit && myAssignableRoles.includes(member.role) // no puede tocar a alguien de rango mayor al suyo

          return (
            <div
              key={member.id}
              style={{
                ...rowStyle,
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                opacity: pendingId === member.id && isPending ? 0.6 : 1,
              }}
            >
              <div>
                <strong style={{ display: 'block' }}>{member.full_name || 'Sin nombre'}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {member.email}
                </span>
              </div>

              {rowIsEditable ? (
                <select
                  value={member.role}
                  disabled={isPending && pendingId === member.id}
                  onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                  className="mono"
                  style={selectStyle}
                >
                  {myAssignableRoles.map((role) => (
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
          )
        })}

        {rows.length === 0 && (
          <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>
            No hay miembros en esta organización.
          </p>
        )}
      </div>
    </div>
  )
}

function InvitesSection({
  invites,
  myAssignableRoles,
}: {
  invites: Invite[]
  myAssignableRoles: Role[]
}) {
  const [list, setList] = useState(invites)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>(myAssignableRoles[myAssignableRoles.length - 1] ?? 'cashier')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const trimmed = email.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await createInvite(trimmed, role)
      if (result?.error) {
        setErrorMsg(result.error)
        return
      }
      setEmail('')
      setSuccessMsg(`Invitación enviada a ${trimmed}. Cuando inicie sesión con Google usando ese correo, entrará directo a tu organización como ${ROLE_LABELS[role]}.`)
      setList((prev) => [
        { id: crypto.randomUUID(), email: trimmed, role, created_at: new Date().toISOString() },
        ...prev,
      ])
    })
  }

  function handleCancel(inviteId: string) {
    setCancelingId(inviteId)
    const previous = list
    setList((prev) => prev.filter((i) => i.id !== inviteId))

    startTransition(async () => {
      const result = await cancelInvite(inviteId)
      setCancelingId(null)
      if (result?.error) {
        setList(previous)
        setErrorMsg(result.error)
      }
    })
  }

  return (
    <div>
      <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>
        Invitar a alguien
      </h2>

      {errorMsg && <ErrorBanner message={errorMsg} />}
      {successMsg && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--success)',
            borderLeft: '3px solid var(--success)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            color: 'var(--success)',
            fontSize: '0.85rem',
          }}
        >
          {successMsg}
        </div>
      )}

      <form
        onSubmit={handleInvite}
        style={{ display: 'flex', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}
      >
        <input
          type="email"
          required
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.9rem',
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="mono"
          style={selectStyle}
        >
          {myAssignableRoles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
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
          Invitar
        </button>
      </form>

      {list.length > 0 && (
        <div style={cardStyle}>
          {list.map((invite, idx) => (
            <div
              key={invite.id}
              style={{
                ...rowStyle,
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                borderLeft: '3px solid var(--text-muted)',
                opacity: cancelingId === invite.id ? 0.6 : 1,
              }}
            >
              <div>
                <strong style={{ display: 'block' }}>{invite.email}</strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Pendiente · {ROLE_LABELS[invite.role]}
                </span>
              </div>
              <button
                onClick={() => handleCancel(invite.id)}
                disabled={isPending && cancelingId === invite.id}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '0.4rem 0.75rem',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Cancelar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--danger)',
        borderLeft: '3px solid var(--danger)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2)',
        marginBottom: 'var(--space-2)',
        color: 'var(--danger)',
        fontSize: '0.85rem',
      }}
    >
      {message}
    </div>
  )
}
