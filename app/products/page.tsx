import { redirect } from 'next/navigation'
import { getGirosConProductos } from './actions'

export default async function ProductsIndexPage() {
  const result = await getGirosConProductos()
  if ('error' in result) redirect('/')

  const { giros } = result

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>← Volver</a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Productos</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Elige un giro para ver y editar su catálogo.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {giros.map((g) => (
          <a key={g.giroId} href={'/products/' + g.slug} style={{ textDecoration: 'none' }}>
            <div
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
                width: '190px',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{g.icono}</div>
              <strong style={{ display: 'block' }}>{g.nombre}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{g.count} producto(s)</span>
            </div>
          </a>
        ))}
      </div>
    </main>
  )
}
