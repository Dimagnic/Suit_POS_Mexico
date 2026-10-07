import { redirect } from 'next/navigation'
import { getCsdStatus } from './csd-actions'
import CsdClient from './csd-client'

export default async function FacturacionPage() {
  const result = await getCsdStatus()

  if ('error' in result) {
    redirect('/')
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '560px' }}>
        <header style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>
          <a href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block', marginBottom: '0.5rem' }}>
            ← Volver
          </a>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Configuracion fiscal</h1>
          <p style={{ color: 'var(--text-muted)', margin: '0.4rem 0 0', fontSize: '0.9rem' }}>
            Captura tus datos fiscales y tu Certificado de Sello Digital (CSD) para que tus facturas CFDI salgan con tu propio RFC.
          </p>
        </header>

        <CsdClient csd={result.csd ?? null} fiscalProfile={result.fiscalProfile ?? null} role={result.role ?? ''} />
      </div>
    </main>
  )
}