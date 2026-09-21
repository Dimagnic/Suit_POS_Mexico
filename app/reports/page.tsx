import { redirect } from 'next/navigation'
import { getReportData } from './actions'
import ReportsClient from './reports-client'

export default async function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  const result = await getReportData({ from: thirtyDaysAgo, to: today })
  if ('error' in result) redirect('/')

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Reportes</h1>
      </header>

      <ReportsClient initial={result} initialFrom={thirtyDaysAgo} initialTo={today} />
    </main>
  )
}