import { redirect } from 'next/navigation'
import { getInventoryOverview } from './actions'
import InventoryClient from './inventory-client'

export default async function InventoryPage() {
  const result = await getInventoryOverview()
  if ('error' in result) redirect('/')

  const { items } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Inventario</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Define un umbral de reabastecimiento por producto y te avisamos por correo cuando una venta lo cruce.
        </p>
      </header>

      <InventoryClient items={items} />
    </main>
  )
}
