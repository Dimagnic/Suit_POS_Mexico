import { redirect } from 'next/navigation'
import { getPurchaseOrdersPageData } from './actions'
import PurchaseOrdersClient from './purchase-orders-client'

export default async function PurchaseOrdersPage() {
  const result = await getPurchaseOrdersPageData()
  if ('error' in result) redirect('/')

  const { orders, suppliers, products, currentRole } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Órdenes de compra</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Registra lo que le pides a cada proveedor. Cuando la mercancía llegue, márcala como recibida para sumarla de vuelta al inventario.
        </p>
      </header>

      <PurchaseOrdersClient orders={orders} suppliers={suppliers} products={products} currentRole={currentRole} />
    </main>
  )
}
