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
    <main style={{ display: 'flex', minHeight: '100vh', color: 'white' }}>
      <section style={{ flex: 2, padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <a href="/" style={{ color: '#aaa', textDecoration: 'none' }}>← Volver</a>
          <h1 style={{ margin: 0 }}>{giro.icono} {giro.nombre}</h1>
        </div>

        {products.length === 0 && <p style={{ color: '#aaa' }}>Este giro todavía no tiene productos cargados.</p>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              style={{ textAlign: 'left', background: '#1a1a1a', border: '1px solid #333', borderRadius: '8px', padding: '1rem', color: 'white', cursor: 'pointer' }}
            >
              <strong>{p.name}</strong>
              <p style={{ margin: '0.25rem 0', color: '#aaa', fontSize: '0.85rem' }}>
                {p.category ?? 'General'} · Stock: {p.stock_quantity} {p.unit}
              </p>
              <p style={{ fontSize: '1.1rem', margin: 0 }}>${p.price.toFixed(2)}</p>
            </button>
          ))}
        </div>
      </section>

      <aside style={{ flex: 1, background: '#111', padding: '1.5rem', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        <h2>Ticket</h2>

        {cart.length === 0 && <p style={{ color: '#aaa' }}>Sin productos todavía.</p>}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {cart.map((l) => (
            <div key={l.product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <p style={{ margin: 0 }}>{l.product.name}</p>
                <small style={{ color: '#aaa' }}>${l.product.price.toFixed(2)} c/u</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button onClick={() => changeQty(l.product.id, -1)}>-</button>
                <span>{l.quantity}</span>
                <button onClick={() => changeQty(l.product.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #333', paddingTop: '1rem', marginTop: '1rem' }}>
          <p>Subtotal: ${subtotal.toFixed(2)}</p>
          <p>IVA (16%): ${tax.toFixed(2)}</p>
          <p style={{ fontSize: '1.2rem' }}><strong>Total: ${total.toFixed(2)}</strong></p>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || loading}
            style={{ width: '100%', padding: '0.75rem', marginTop: '0.5rem', background: cart.length === 0 ? '#333' : '#22c55e', border: 'none', borderRadius: '6px', color: 'white', cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}
          >
            {loading ? 'Procesando...' : 'Cobrar'}
          </button>

          {lastSale && (
            <p style={{ color: 'lightgreen', marginTop: '0.5rem' }}>
              ✓ Venta registrada — Total: ${lastSale.total.toFixed(2)}
            </p>
          )}
        </div>
      </aside>
    </main>
  )
}