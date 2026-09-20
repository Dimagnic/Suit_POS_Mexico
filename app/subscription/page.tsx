import { redirect } from 'next/navigation'
import { getGirosConEstado } from './actions'
import SubscriptionClient from './subscription-client'

export default async function SubscriptionPage() {
  const result = await getGirosConEstado()

  if ('error' in result) {
    redirect('/')
  }

  const { giros, currentRole } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Suscripción</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Activa los giros que quieras usar en tu negocio. Cada uno se factura por separado.
        </p>
      </header>

      <SubscriptionClient giros={giros ?? []} currentRole={currentRole} />
    </main>
  )
}