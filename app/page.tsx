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

  return (
    <main style={{ padding: '2rem', color: 'white' }}>
      <h1>Suit POS México</h1>
      <p style={{ color: '#aaa' }}>
        {appUser?.full_name} · {appUser?.role} · {(appUser?.organizations as any)?.name}
      </p>

      <h2 style={{ marginTop: '2rem' }}>Tus giros</h2>

      {misGiros?.length === 0 && <p>No tienes giros contratados todavía.</p>}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        {misGiros?.map((mg: any) => {
          const giroUrl = '/pos/' + mg.giros.slug
          return (
            <a key={mg.id} href={giroUrl} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div
                style={{
                  border: '1px solid #444',
                  borderRadius: '8px',
                  padding: '1rem',
                  width: '180px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '2rem' }}>{mg.giros.icono}</div>
                <strong>{mg.giros.nombre}</strong>
                <p style={{ fontSize: '0.85rem', color: '#aaa' }}>{mg.giros.descripcion}</p>
              </div>
            </a>
          )
        })}
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: '2rem' }}>
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  )
}