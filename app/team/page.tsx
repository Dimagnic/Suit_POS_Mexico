import { redirect } from 'next/navigation'
import { getTeamMembers, getPendingInvites } from './actions'
import { canManageTeam } from '@/lib/permissions'
import TeamClient from './team-client'

export default async function TeamPage() {
  const [result, invitesResult] = await Promise.all([
    getTeamMembers(),
    getPendingInvites(),
  ])

  if ('error' in result) {
    redirect('/')
  }

  const { members, currentRole } = result
  const invites = 'invites' in invitesResult ? invitesResult.invites ?? [] : []

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a
          href="/"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.85rem',
          }}
        >
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Equipo</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          {canManageTeam(currentRole)
            ? 'Gestiona los roles de las personas de tu organización.'
            : 'Personas de tu organización.'}
        </p>
      </header>

      <TeamClient members={members ?? []} currentRole={currentRole} invites={invites} />
    </main>
  )
}
