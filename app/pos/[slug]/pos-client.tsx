'use client'

import { useState, useRef } from 'react'
import { checkout } from './actions'
import { generarFactura } from './invoice-actions'

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

const TOOLS = [
  {
    id: 'scan',
    icon: '🔎',
    label: 'Escáner',
    info: 'Ya funciona: cualquier lector de código de barras USB actúa como teclado. Haz clic aquí para enfocar el campo de escaneo y pasa el producto.',
  },
  {
    id: 'print',
    icon: '🖨️',
    label: 'Imprimir',
    info: 'Imprime el último ticket en cualquier impresora conectada a tu computadora (normal o térmica). Se habilita después de cobrar una venta.',
  },
  {
    id: 'drawer',
    icon: '💰',
    label: 'Cajón',
    info: 'El cajón de dinero casi siempre se abre a través de la impresora térmica (no se conecta solo). Se activará automáticamente al integrar una impresora térmica compatible con comandos ESC/POS.',
  },
  {
    id: 'terminal',
    icon: '💳',
    label: 'Terminal',
    info: 'El cobro con tarjeta requiere una terminal física y su SDK correspondiente (por ejemplo Stripe Terminal, ya que este sistema usa Stripe). Pendiente de integrar cuando el negocio tenga la terminal.',
  },
  {
    id: 'scale',
    icon: '⚖️',
    label: 'Báscula',
    info: 'Las básculas electrónicas se conectan por USB/serial y requieren programarse según la marca específica del equipo (vía WebSerial). Pendiente hasta definir el modelo que usará el negocio.',
  },
]

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
  const [lastSaleItems, setLastSaleItems] = useState<CartLine[]>([])

  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{
    success?: boolean
    error?: string
    uuid?: string
    xmlBase64?: string | null
    pdfBase64?: string | null
  } | null>(null)

  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [esPublicoGeneral, setEsPublicoGeneral] = useState(true)
  const [rfc, setRfc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [regimenFiscal, setRegimenFiscal] = useState('601')
  const [usoCfdi, setUsoCfdi] = useState('G03')

  const [scanValue, setScanValue] = useState('')
  const [scanError, setScanError] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const scanInputRef = useRef<HTMLInputElement>(null)

  const handleInvoiceSubmit = async () => {
    if (!lastSale) return
    setInvoiceLoading(true)
    const result = await generarFactura(
      lastSale.id,
      esPublicoGeneral ? undefined : { rfc, razonSocial, regimenFiscal, usoCfdi }
    )
    setInvoiceLoading(false)
    setInvoiceResult(result)
    if (!result.error) setShowInvoiceModal(false)
  }

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

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scanValue.trim()
    if (!code) return

    const found = products.find(
      (p) => p.sku && p.sku.toLowerCase() === code.toLowerCase()
    )

    if (found) {
      addToCart(found)
      setScanError(null)
    } else {
      setScanError('No se encontró ningún producto con ese código/SKU.')
    }

    setScanValue('')
  }

  const handlePrintTicket = () => {
    if (!lastSale || lastSaleItems.length === 0) return

    const itemsHtml = lastSaleItems
      .map(
        (l) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>${l.quantity} x ${l.product.name}</span>
          <span>$${(l.product.price * l.quantity).toFixed(2)}</span>
        </div>`
      )
      .join('')

    const ticketSubtotal = lastSaleItems.reduce((sum, l) => sum + l.product.price * l.quantity, 0)
    const ticketTax = ticketSubtotal * 0.16

    const win = window.open('', '_blank', 'width=320,height=600')
    if (!win) return

    win.document.write(`
      <html>
        <head>
          <title>Ticket</title>
          <style>
            body { font-family: monospace; width: 280px; margin: 0 auto; padding: 12px; font-size: 12px; }
            h2 { text-align: center; margin: 0 0 8px; }
            hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
            .total { display:flex; justify-content:space-between; font-weight:bold; margin-top:6px; }
          </style>
        </head>
        <body>
          <h2>${giro.nombre}</h2>
          <div>${new Date().toLocaleString('es-MX')}</div>
          <hr />
          ${itemsHtml}
          <hr />
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>$${ticketSubtotal.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>IVA (16%)</span><span>$${ticketTax.toFixed(2)}</span></div>
          <div class="total"><span>TOTAL</span><span>$${lastSale.total.toFixed(2)}</span></div>
          <hr />
          <div style="text-align:center;">¡Gracias por su compra!</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
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

    setLastSaleItems(cart)
    setLastSale({ id: result.saleId!, total: result.total! })
    setInvoiceResult(null)
    setEsPublicoGeneral(true)
    setRfc('')
    setRazonSocial('')
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
            marginBottom: 'var(--space-2)',
          }}
        >
          <a href="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            ← Volver
          </a>
          <h1 style={{ fontSize: '1.25rem' }}>
            {giro.icono} {giro.nombre}
          </h1>
        </div>

        <form
          onSubmit={handleScanSubmit}
          style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-3)' }}
        >
          <input
            ref={scanInputRef}
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            placeholder="🔎 Escanear o escribir SKU y presionar Enter..."
            style={{
              flex: 1,
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.9rem',
            }}
          />
        </form>
        {scanError && (
          <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '-0.5rem', marginBottom: 'var(--space-2)' }}>
            {scanError}
          </p>
        )}

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

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
          {TOOLS.map((tool) => {
            const disabled = tool.id === 'print' && !lastSale
            return (
              <button
                key={tool.id}
                title={tool.label}
                disabled={disabled}
                onClick={() => {
                  if (tool.id === 'scan') {
                    scanInputRef.current?.focus()
                    setActiveTool('scan')
                    return
                  }
                  if (tool.id === 'print') {
                    handlePrintTicket()
                    return
                  }
                  setActiveTool(activeTool === tool.id ? null : tool.id)
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem 0',
                  fontSize: '1.1rem',
                  background: activeTool === tool.id ? 'var(--surface)' : 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: disabled ? 'var(--text-muted)' : 'var(--text)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.4 : 1,
                }}
              >
                {tool.icon}
              </button>
            )
          })}
        </div>

        {activeTool && (
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: 'var(--radius)',
              padding: '0.6rem 0.75rem',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginBottom: 'var(--space-2)',
            }}
          >
            {TOOLS.find((t) => t.id === activeTool)?.info}
          </div>
        )}

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
                <button onClick={() => changeQty(l.product.id, -1)} style={qtyBtnStyle}>
                  −
                </button>
                <span className="mono" style={{ minWidth: '1.5rem', textAlign: 'center' }}>
                  {l.quantity}
                </span>
                <button onClick={() => changeQty(l.product.id, 1)} style={qtyBtnStyle}>
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
            <div style={{ marginTop: 'var(--space-1)' }}>
              <p style={{ color: 'var(--success)', fontSize: '0.9rem', margin: '0 0 0.5rem' }}>
                ✓ Venta registrada — Total: ${lastSale.total.toFixed(2)}
              </p>

              {!invoiceResult?.success && (
                <button
                  onClick={() => setShowInvoiceModal(true)}
                  disabled={invoiceLoading}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: 'transparent',
                    border: '1px solid var(--accent)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--accent)',
                    cursor: invoiceLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  {invoiceLoading ? 'Generando factura...' : 'Generar factura CFDI'}
                </button>
              )}

              {invoiceResult?.success && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ color: 'var(--success)', fontSize: '0.85rem', margin: '0 0 0.5rem' }}>
                    ✓ Facturado — UUID: <span className="mono">{invoiceResult.uuid}</span>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {invoiceResult.pdfBase64 && (
                      
                        <a
                        href={'data:application/pdf;base64,' + invoiceResult.pdfBase64}
                        download={'factura-' + invoiceResult.uuid + '.pdf'}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          padding: '0.5rem',
                          border: '1px solid var(--accent)',
                          borderRadius: 'var(--radius)',
                          color: 'var(--accent)',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                        }}
                      >
                        Descargar PDF
                      </a>
                    )}
                    {invoiceResult.xmlBase64 && (
                      
                        <a
                        href={'data:application/xml;base64,' + invoiceResult.xmlBase64}
                        download={'factura-' + invoiceResult.uuid + '.xml'}
                        style={{
                          flex: 1,
                          textAlign: 'center',
                          padding: '0.5rem',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius)',
                          color: 'var(--text)',
                          fontSize: '0.8rem',
                          textDecoration: 'none',
                        }}
                      >
                        Descargar XML
                      </a>
                    )}
                  </div>
                </div>
              )}

              {invoiceResult?.error && !showInvoiceModal && (
                <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  ✕ {invoiceResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>

      {showInvoiceModal && lastSale && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-3)',
              width: '90%',
              maxWidth: '420px',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Datos de facturación</h3>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
              <input
                type="checkbox"
                checked={esPublicoGeneral}
                onChange={(e) => setEsPublicoGeneral(e.target.checked)}
              />
              Facturar a Público en General
            </label>

            {!esPublicoGeneral && (
              <>
                <input
                  placeholder="RFC"
                  value={rfc}
                  onChange={(e) => setRfc(e.target.value.toUpperCase())}
                  style={inputStyle}
                />
                <input
                  placeholder="Razón social"
                  value={razonSocial}
                  onChange={(e) => setRazonSocial(e.target.value)}
                  style={inputStyle}
                />
                <select value={regimenFiscal} onChange={(e) => setRegimenFiscal(e.target.value)} style={inputStyle}>
                  <option value="601">601 - General de Ley Personas Morales</option>
                  <option value="603">603 - Personas Morales con Fines no Lucrativos</option>
                  <option value="605">605 - Sueldos y Salarios</option>
                  <option value="612">612 - Personas Físicas con Actividades Empresariales</option>
                  <option value="621">621 - Incorporación Fiscal</option>
                  <option value="626">626 - Régimen Simplificado de Confianza</option>
                </select>
                <select value={usoCfdi} onChange={(e) => setUsoCfdi(e.target.value)} style={inputStyle}>
                  <option value="G01">G01 - Adquisición de mercancías</option>
                  <option value="G03">G03 - Gastos en general</option>
                  <option value="I08">I08 - Otra maquinaria y equipo</option>
                  <option value="P01">P01 - Por definir</option>
                </select>
              </>
            )}

            {invoiceResult?.error && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>✕ {invoiceResult.error}</p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
              <button
                onClick={() => setShowInvoiceModal(false)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleInvoiceSubmit}
                disabled={invoiceLoading}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: 'var(--accent)',
                  color: '#1a1206',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontWeight: 600,
                  cursor: invoiceLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {invoiceLoading ? 'Generando...' : 'Timbrar'}
              </button>
            </div>
          </div>
        </div>
      )}
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  marginBottom: '0.6rem',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
}