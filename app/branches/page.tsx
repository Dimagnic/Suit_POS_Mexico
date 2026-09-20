import { redirect } from 'next/navigation'
import { getBranches } from './actions'
import BranchesClient from './branches-client'

export default async function BranchesPage() {
  const result = await getBranches()

  if ('error' in result) {
    redirect('/')
  }

  const { branches, currentRole } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Sucursales</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Gestiona las sucursales de tu organización.
        </p>
      </header>

      <BranchesClient branches={branches ?? []} currentRole={currentRole} />
    </main>
  )
}