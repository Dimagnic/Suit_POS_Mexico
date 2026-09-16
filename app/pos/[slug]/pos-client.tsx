'use client'

import { useState } from 'react'
import { checkout } from './actions'

type Product = {
  id: string
  sku: string | null
  name: string
  price: number
  stock_quantity: number
  unit: string
  category: string | null
}

type CartLine = { product: Product; quantity: number }

export default function PosClient({
  giro,
  products,
  organizationId,
  branchId,
  cashierId,
}: {
  giro: { id: string; slug: string; nombre: string; icono: string | null }
  products: Product[]
  organizationId: string
  branchId: string
  cashierId: string
}) {
  const [cart, setCart] = useState<CartLine[]>([])
  const [loading, setLoading] = useState(false)
  const [lastSale, setLastSale] = useState<{ id: string; total: number } | null>(null)

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id)
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  const changeQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    )
  }

  const subtotal = cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const handleCheckout = async () => {
    if (cart.length === 0) return
    setLoading(true)
    setLastSale(null)

    const result = await checkout({
      organizationId,
      branchId,
      giroId: giro.id,
      cashierId,
      items: cart.map((l) => ({
        productId: l.product.id,
        price: l.product.price,
        quantity: l.quantity,
      })),
    })

    setLoading(false)

    if (result.error) {
      alert('Error: ' + result.error)
      return
    }

    setLastSale({ id: result.saleId!, total: result.total! })
    setCart([])
  }

  return (
    <main style={{ display: 'flex', minHeight: '100vh' }}>
      <section style={{ flex: '1 1 65%', padding: 'var(--space-3)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ← Volver
          </a>
          <h1 style={{ fontSize: '1.25rem' }}>
            {giro.icono} {giro.nombre}
          </h1>
        </div>

        {products.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Este giro todavía no tiene productos cargados.</p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
            gap: 'var(--space-2)',
          }}
        >
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              style={{
                textAlign: 'left',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-2)',
                color: 'var(--text)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{p.name}</strong>
              <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {p.category ?? 'General'} · Stock: {p.stock_quantity} {p.unit}
              </p>
              <p className="mono" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent)' }}>
                ${p.price.toFixed(2)}
              </p>
            </button>
          ))}
        </div>
      </section>

      <aside
        style={{
          flex: '1 1 35%',
          background: 'var(--surface-2)',
          padding: 'var(--space-3)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Ticket</h2>

        {cart.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin productos todavía.</p>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.map((l) => (
            <div
              key={l.product.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{l.product.name}</p>
                <small className="mono" style={{ color: 'var(--text-muted)' }}>
                  ${l.product.price.toFixed(2)} c/u
                </small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => changeQty(l.product.id, -1)}
                  style={qtyBtnStyle}
                >
                  −
                </button>
                <span className="mono" style={{ minWidth: '1.5rem', textAlign: 'center' }}>
                  {l.quantity}
                </span>
                <button
                  onClick={() => changeQty(l.product.id, 1)}
                  style={qtyBtnStyle}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span className="mono">${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <span>IVA (16%)</span>
            <span className="mono">${tax.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 600 }}>
            <span>Total</span>
            <span className="mono">${total.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            style={{
              width: '100%',
              padding: '0.85rem',
              marginTop: 'var(--space-2)',
              background: cart.length === 0 ? 'var(--border)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: cart.length === 0 ? 'var(--text-muted)' : '#1a1206',
              fontWeight: 600,
              cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Procesando...' : 'Cobrar'}
          </button>

          {lastSale && (
            <p style={{ color: 'var(--success)', marginTop: 'var(--space-1)', fontSize: '0.9rem' }}>
              ✓ Venta registrada — Total: ${lastSale.total.toFixed(2)}
            </p>
          )}
        </div>
      </aside>
    </main>
  )
}

const qtyBtnStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '4px',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: '0.9rem',
  lineHeight: 1,
}