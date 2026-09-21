import { redirect, notFound } from 'next/navigation'
import { getProductsForGiro } from '../actions'
import ProductsClient from './products-client'

export default async function ProductsGiroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getProductsForGiro(slug)

  if ('error' in result) {
    if (result.error === 'Giro no encontrado') notFound()
    redirect('/')
  }

  const { giro, products, currentRole } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/products" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Productos</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>{giro.icono} {giro.nombre}</h1>
      </header>

      <ProductsClient giroId={giro.id} products={products ?? []} currentRole={currentRole} />
    </main>
  )
}