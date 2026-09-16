'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const supabase = createClient()

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <main style={{ padding: '2rem', color: 'white' }}>
      <h1>Suit POS México</h1>
      <button onClick={handleGoogleLogin} style={{ padding: '0.75rem 1.5rem', marginTop: '1rem' }}>
        Iniciar sesión con Google
      </button>
    </main>
  )
}