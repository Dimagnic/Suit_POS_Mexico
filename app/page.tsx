import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: appUser } = await supabase
    .from('app_users')
    .select('full_name, role, organization_id, organizations(name)')
    .eq('id', user.id)
    .single()

  const { data: misGiros } = await supabase
    .from('organization_giros')
    .select('id, status, giros(slug, nombre, icono, descripcion)')
    .eq('organization_id', appUser?.organization_id)
    .eq('status', 'active')

  const orgName = (appUser?.organizations as any)?.name

  return (
    <main style={{ minHeight: '100vh', padding: 'var(--space-4)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Suit POS México</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>
            {appUser?.full_name} · {appUser?.role} · {orgName}
          </p>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.5rem 1rem',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)', color: 'var(--text-muted)' }}>
        Tus giros
      </h2>

      {misGiros?.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>No tienes giros contratados todavía.</p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {misGiros?.map((mg: any) => {
          const giroUrl = '/pos/' + mg.giros.slug
          return (
            <a key={mg.id} href={giroUrl} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--accent)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2)',
                  width: '200px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>{mg.giros.icono}</div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{mg.giros.nombre}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  {mg.giros.descripcion}
                </p>
              </div>
            </a>
          )
        })}
      </div>
    </main>
  )
}