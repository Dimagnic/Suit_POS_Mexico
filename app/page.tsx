import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('giros').select('nombre').limit(5)

  return (
    <main style={{ padding: '2rem', color: 'white' }}>
      <h1>Prueba de conexión a Supabase</h1>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {data && (
        <ul>
          {data.map((g, i) => (
            <li key={i}>{g.nombre}</li>
          ))}
        </ul>
      )}
    </main>
  )
}