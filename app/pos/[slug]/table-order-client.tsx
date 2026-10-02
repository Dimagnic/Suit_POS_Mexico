'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  getOrCreateOpenOrder,
  getOrderItems,
  addOrderItem,
  changeOrderItemQty,
    closeTableOrder,
  updateBottleStatus,
  toggleCortesia,
} from './table-actions'
import { generarFactura } from './invoice-actions'

type Table = { id: string; name: string; status: string }
type Product = { id: string; sku?: string | null; name: string; price: number; category: string | null }
type OrderItem = {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  bottle_status: 'sellada' | 'abierta' | 'vacia' | null
  ml_restante: number | null
  is_cortesia: boolean
  products: { name: string; category: string | null; ml_total: number | null }
}

const PADENTRO_ORG_ID = 'a9fc34de-ecf9-44e7-b008-21427324a807'

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
    info: 'Imprime el último ticket en cualquier impresora conectada a tu computadora (normal o térmica). Se habilita después de cobrar la mesa.',
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

export default function TableOrderClient({
  table,
  products,
  organizationId,
  branchId,
  giroId,
  giroSlug,
  giroIcono,
  waiterId,
  onBack,
}: {
  table: Table
  products: Product[]
  organizationId: string
  branchId: string
  giroId: string
  giroSlug: string
  giroIcono: string | null
  waiterId: string
  onBack: () => void
}) {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(false)
  const [closedResult, setClosedResult] = useState<{ saleId: string; total: number } | null>(null)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceResult, setInvoiceResult] = useState<{
    success?: boolean
    error?: string
    uuid?: string
    xmlBase64?: string | null
    pdfBase64?: string | null
  } | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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

  useEffect(() => {
    const init = async () => {
      const result = await getOrCreateOpenOrder(table.id, organizationId, waiterId)
      if (result.orderId) {
        setOrderId(result.orderId)
        const orderItems = await getOrderItems(result.orderId)
        setItems(orderItems as any)
      }
      setLoading(false)
    }
    init()
  }, [table.id])

  const refreshItems = async () => {
    if (!orderId) return
    const orderItems = await getOrderItems(orderId)
    setItems(orderItems as any)
  }

  const handleAdd = async (product: Product) => {
    if (!orderId) return
    await addOrderItem(orderId, product.id, product.price, table.id, product.category)
    await refreshItems()
  }

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = scanValue.trim()
    if (!code) return

    const found = products.find(
      (p) => p.sku && p.sku.toLowerCase() === code.toLowerCase()
    )

    if (found) {
      handleAdd(found)
      setScanError(null)
    } else {
      setScanError('No se encontró ningún producto con ese código/SKU.')
    }

    setScanValue('')
  }

  const handlePrintTicket = () => {
    if (!closedResult || items.length === 0) return

    const itemsHtml = items
      .map(
        (i) => `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>${i.quantity} x ${i.products?.name ?? ''}</span>
          <span>$${(i.unit_price * i.quantity).toFixed(2)}</span>
        </div>`
      )
      .join('')

    const ticketSubtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
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
          <h2>${table.name}</h2>
          <div>${new Date().toLocaleString('es-MX')}</div>
          <hr />
          ${itemsHtml}
          <hr />
          <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>$${ticketSubtotal.toFixed(2)}</span></div>
          <div style="display:flex;justify-content:space-between;"><span>IVA (16%)</span><span>$${ticketTax.toFixed(2)}</span></div>
          <div class="total"><span>TOTAL</span><span>$${closedResult.total.toFixed(2)}</span></div>
          <hr />
          <div style="text-align:center;">¡Gracias por su compra!</div>
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  const handleBottleStatus = async (itemId: string, status: 'sellada' | 'abierta' | 'vacia') => {
    await updateBottleStatus(itemId, status)
    await refreshItems()
  }

    const handleQty = async (itemId: string, delta: number) => {
    await changeOrderItemQty(itemId, delta)
    await refreshItems()
  }

  const handleCortesia = async (itemId: string) => {
    await toggleCortesia(itemId)
    await refreshItems()
  }

  const categorias = useMemo(() => {
    const set = new Set(products.map((p) => p.category ?? 'Otros'))
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [products])

  const productosFiltrados = useMemo(() => {
    const base = selectedCategory
      ? products.filter((p) => (p.category ?? 'Otros') === selectedCategory)
      : products
    return [...base].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [products, selectedCategory])

  const productosAgrupados = useMemo(() => {
    if (selectedCategory) return null
    const grupos = new Map<string, Product[]>()
    for (const cat of categorias) grupos.set(cat, [])
    for (const p of productosFiltrados) {
      const cat = p.category ?? 'Otros'
      grupos.get(cat)?.push(p)
    }
    return grupos
  }, [productosFiltrados, categorias, selectedCategory])

  const subtotal = items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0)
  const tax = subtotal * 0.16
  const total = subtotal + tax

  const handleClose = async () => {
    if (!orderId) return
    setClosing(true)
    const result = await closeTableOrder(orderId, table.id, organizationId, branchId, giroId, giroSlug, waiterId)
    setClosing(false)

    if (result.error) {
      alert('Error: ' + result.error)
      return
    }

    setClosedResult({ saleId: result.saleId!, total: result.total! })
  }

  const handleInvoiceSubmit = async () => {
    if (!closedResult) return
    setInvoiceLoading(true)
    const result = await generarFactura(
      closedResult.saleId,
      esPublicoGeneral ? undefined : { rfc, razonSocial, regimenFiscal, usoCfdi }
    )
    setInvoiceLoading(false)
    setInvoiceResult(result)
    if (!result.error) setShowInvoiceModal(false)
  }

  if (loading) {
    return <main style={{ padding: 'var(--space-3)', color: 'var(--text-muted)' }}>Cargando mesa...</main>
  }

  if (closedResult) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <p style={{ color: 'var(--success)', fontSize: '1.1rem' }}>
          ✓ {table.name} cobrada — Total: ${closedResult.total.toFixed(2)}
        </p>

        <button
          onClick={handlePrintTicket}
          style={{
            padding: '0.5rem 1.2rem',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          🖨️ Imprimir ticket
        </button>

        {!invoiceResult?.success && (
          <button
            onClick={() => setShowInvoiceModal(true)}
            disabled={invoiceLoading}
            style={{
              padding: '0.6rem 1.5rem',
              background: 'transparent',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius)',
              color: 'var(--accent)',
              cursor: invoiceLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {invoiceLoading ? 'Generando factura...' : 'Generar factura CFDI'}
          </button>
        )}

        {invoiceResult?.success && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <p style={{ color: 'var(--success)', fontSize: '0.85rem', margin: 0 }}>
              ✓ Facturado — UUID: <span className="mono">{invoiceResult.uuid}</span>
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {invoiceResult.pdfBase64 && (
                
                  <a
                  href={'data:application/pdf;base64,' + invoiceResult.pdfBase64}
                  download={'factura-' + invoiceResult.uuid + '.pdf'}
                  style={{
                    padding: '0.5rem 1rem',
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
                    padding: '0.5rem 1rem',
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
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>✕ {invoiceResult.error}</p>
        )}

        <button
          onClick={onBack}
          style={{
            padding: '0.6rem 1.5rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#1a1206',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Volver a mesas
        </button>

        {showInvoiceModal && (
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

  return (
    <main style={{ display: 'flex', minHeight: '100vh', overflow: 'hidden' }}>
      <section style={{ flex: '1 1 65%', minWidth: 0, padding: 'var(--space-3)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', marginBottom: 'var(--space-2)' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem' }}>
            ← Mesas
          </button>
          <h1 style={{ fontSize: '1.25rem' }}>{giroIcono ?? '🍽️'} {table.name}</h1>
        </div>

        <form
          onSubmit={handleScanSubmit}
          style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-2)' }}
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

        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            marginBottom: 'var(--space-3)',
            overflowX: 'auto',
            paddingBottom: '0.4rem',
            width: '100%',
            minWidth: 0,
          }}
        >
          <button
            onClick={() => setSelectedCategory(null)}
            style={{
              flexShrink: 0,
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              whiteSpace: 'nowrap',
              background: selectedCategory === null ? 'var(--accent)' : 'transparent',
              color: selectedCategory === null ? '#1a1206' : 'var(--text)',
            }}
          >
            Todas
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                flexShrink: 0,
                padding: '0.4rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                whiteSpace: 'nowrap',
                background: selectedCategory === cat ? 'var(--accent)' : 'transparent',
                color: selectedCategory === cat ? '#1a1206' : 'var(--text)',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {selectedCategory === null && productosAgrupados
          ? categorias.map((cat) => {
              const productosDeCategoria = productosAgrupados.get(cat) ?? []
              if (productosDeCategoria.length === 0) return null
              return (
                <div key={cat} style={{ marginBottom: 'var(--space-3)' }}>
                  <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: 'var(--space-1)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {cat}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
                    {productosDeCategoria.map((p) => (
                      <ProductButton key={p.id} product={p} onClick={() => handleAdd(p)} />
                    ))}
                  </div>
                </div>
              )
            })
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 'var(--space-2)' }}>
              {productosFiltrados.map((p) => (
                <ProductButton key={p.id} product={p} onClick={() => handleAdd(p)} />
              ))}
            </div>
          )}
      </section>

      <aside
        style={{
          flex: '1 1 35%',
          minWidth: '320px',
          maxWidth: '420px',
          background: 'var(--surface-2)',
          padding: 'var(--space-3)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        <h2 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-2)' }}>Comanda — {table.name}</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 'var(--space-2)' }}>
          {TOOLS.map((tool) => {
            const disabled = tool.id === 'print'
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
            {activeTool === 'print'
              ? 'Se habilita después de cobrar la mesa — el botón "Imprimir ticket" aparece en la pantalla de confirmación.'
              : TOOLS.find((t) => t.id === activeTool)?.info}
          </div>
        )}

        {items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin productos todavía.</p>}

        <div style={{ flex: 1, overflowY: 'auto' }}>
                    {items.map((item) => {
            const isBottle = item.products?.category === 'botella'
            const isCover = item.products?.category === 'cover'
            const esPadentro = organizationId === PADENTRO_ORG_ID
            return (
              <div
                key={item.id}
                style={{
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{item.products?.name}</p>
                    <small className="mono" style={{ color: 'var(--text-muted)' }}>
                      ${item.unit_price.toFixed(2)} {isCover ? '/ persona' : 'c/u'}
                    </small>
                  </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button onClick={() => handleQty(item.id, -1)} style={qtyBtnStyle}>−</button>
                    <span className="mono" style={{ minWidth: '1.5rem', textAlign: 'center' }}>{item.quantity}</span>
                    {!isBottle && <button onClick={() => handleQty(item.id, 1)} style={qtyBtnStyle}>+</button>}
                    {esPadentro && (
                      <button
                        onClick={() => handleCortesia(item.id)}
                        style={{
                          marginLeft: '0.4rem',
                          padding: '0.2rem 0.5rem',
                          fontSize: '0.7rem',
                          borderRadius: 'var(--radius)',
                          border: '1px solid var(--accent)',
                          background: item.is_cortesia ? 'var(--accent)' : 'transparent',
                          color: item.is_cortesia ? '#fff' : 'var(--accent)',
                          cursor: 'pointer',
                        }}
                      >
                        {item.is_cortesia ? '🎁 Cortesia ✓' : '🎁 Cortesia'}
                      </button>
                    )}
                  </div>
                </div>

                {isBottle && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
                    {(['sellada', 'abierta', 'vacia'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => handleBottleStatus(item.id, status)}
                        style={{
                          fontSize: '0.7rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '999px',
                          border: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: item.bottle_status === status ? 'var(--accent)' : 'transparent',
                          color: item.bottle_status === status ? '#1a1206' : 'var(--text-muted)',
                        }}
                      >
                        {status === 'sellada' ? 'Sellada' : status === 'abierta' ? 'Abierta' : 'Vacía'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
            onClick={handleClose}
            disabled={items.length === 0 || closing}
            style={{
              width: '100%',
              padding: '0.85rem',
              marginTop: 'var(--space-2)',
              background: items.length === 0 ? 'var(--border)' : 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: items.length === 0 ? 'var(--text-muted)' : '#1a1206',
              fontWeight: 600,
              cursor: items.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {closing ? 'Cobrando...' : 'Cobrar mesa'}
          </button>
        </div>
      </aside>
    </main>
  )
}

function ProductButton({ product, onClick }: { product: Product; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2)',
        color: 'var(--text)',
        cursor: 'pointer',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{product.name}</strong>
      <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        {product.category ?? 'General'}
      </p>
      <p className="mono" style={{ fontSize: '1.1rem', margin: 0, color: 'var(--accent)' }}>
        ${product.price.toFixed(2)}
      </p>
    </button>
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