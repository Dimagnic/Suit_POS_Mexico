import { redirect } from 'next/navigation'
import { getSuppliers } from './actions'
import SuppliersClient from './suppliers-client'

export default async function SuppliersPage() {
  const result = await getSuppliers()
  if ('error' in result) redirect('/')

  const { suppliers, currentRole } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Proveedores</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Registro de tus proveedores. Las compras se registran y controlan aquí; el pedido en sí se hace por tu cuenta (teléfono, WhatsApp, etc.).
        </p>
      </header>

      <SuppliersClient suppliers={suppliers ?? []} currentRole={currentRole} />
    </main>
  )
}
