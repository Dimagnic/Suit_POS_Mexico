import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function BienvenidaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes ceroGlow { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.08); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .bienvenida-glow { position: absolute; width: 520px; height: 520px; border-radius: 50%; background: radial-gradient(circle, var(--accent) 0%, transparent 70%); filter: blur(60px); animation: ceroGlow 4s ease-in-out infinite; z-index: 0; }
        .bienvenida-content > * { animation: fadeUp 0.8s ease both; }
        .bienvenida-content > *:nth-child(2) { animation-delay: 0.15s; }
        .bienvenida-content > *:nth-child(3) { animation-delay: 0.3s; }
        .bienvenida-content > *:nth-child(4) { animation-delay: 0.45s; }
      `}</style>
      <div className="bienvenida-glow" />
      <div className="bienvenida-content" style={{ position: 'relative', zIndex: 1, maxWidth: '480px' }}>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          Desarrollado por Cero+
        </div>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 700, margin: '0 0 0.5rem', background: 'linear-gradient(135deg, var(--accent), #ffffff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          Suit POS México
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: '0 0 var(--space-4)', lineHeight: 1.6 }}>
          Tu punto de venta multigiro, con facturación CFDI integrada. Vamos a configurar tu cuenta en un par de pasos rápidos.
        </p>
        <a href="/facturacion" style={{ display: 'inline-block', padding: '0.9rem 2rem', background: 'var(--accent)', borderRadius: 'var(--radius)', color: '#1a1206', fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}>
          Comenzar →
        </a>
      </div>
    </main>
  )
}