import { redirect } from 'next/navigation'
import { getCsdStatus } from './csd-actions'
import CsdClient from './csd-client'

export default async function FacturacionPage() {
  const result = await getCsdStatus()

  if ('error' in result) {
    redirect('/')
  }

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
          ← Volver
        </a>
        <h1 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Facturacion — CSD</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
          Sube el Certificado de Sello Digital (CSD) de tu negocio para que tus facturas CFDI salgan con tu propio RFC.
        </p>
      </header>

      <CsdClient csd={result.csd ?? null} role={result.role ?? ''} />
    </main>
  )
}