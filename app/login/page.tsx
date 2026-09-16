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
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', marginBottom: 'var(--space-1)' }}>
          Suit POS México
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Inicia sesión para entrar a tu punto de venta
        </p>
      </div>

      <button
        onClick={handleGoogleLogin}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '0.75rem 1.5rem',
          color: 'var(--text)',
          fontSize: '0.95rem',
          cursor: 'pointer',
        }}
      >
        Continuar con Google
      </button>
    </main>
  )
}