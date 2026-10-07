'use client'

import { useState, useEffect } from 'react'
import {
  listarFacturas,
  obtenerDetalleFactura,
  descargarArchivoFactura,
  cancelarFactura,
  descargarAcuseFactura,
  reenviarFacturaPorCorreo,
} from './actions'

const MOTIVOS = [
  { value: '01', label: '01 - Comprobante emitido con errores, con relacion (requiere UUID sustituto)' },
  { value: '02', label: '02 - Comprobante emitido con errores, sin relacion' },
  { value: '03', label: '03 - La operacion no se llevo a cabo' },
  { value: '04', label: '04 - Operacion nominativa relacionada en una factura global' },
]

function descargarBase64(base64: string, contentType: string, nombre: string) {
  const link = document.createElement('a')
  link.href = `data:${contentType};base64,${base64}`
  link.download = nombre
  link.click()
}

export default function FacturasClient() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [folioFiltro, setFolioFiltro] = useState('')
  const [page, setPage] = useState(0)

  const [detalle, setDetalle] = useState<any>(null)
  const [detalleCargando, setDetalleCargando] = useState(false)
  const [verCrudo, setVerCrudo] = useState<string | null>(null)

  const [cancelando, setCancelando] = useState<any>(null)
  const [motivo, setMotivo] = useState('02')
  const [uuidSustituto, setUuidSustituto] = useState('')
  const [cancelError, setCancelError] = useState('')

  const [reenviando, setReenviando] = useState<any>(null)
  const [correoDestino, setCorreoDestino] = useState('')
  const [reenviarError, setReenviarError] = useState('')
  const [reenviarOk, setReenviarOk] = useState(false)

    const [descargando, setDescargando] = useState<string | null>(null)

  const [consultaId, setConsultaId] = useState('')
  const [consultaResultado, setConsultaResultado] = useState<any>(null)
  const [consultaError, setConsultaError] = useState('')

  async function consultarPorId() {
    setConsultaError('')
    setConsultaResultado(null)
    if (!consultaId.trim()) { setConsultaError('Pon un Id.'); return }
    const resultado = await obtenerDetalleFactura(consultaId.trim())
    if (resultado.error) {
      setConsultaError(typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error))
    } else {
      setConsultaResultado(resultado.data)
    }
  }

    async function cargar(pageOverride?: number) {
    setLoading(true)
    setError('')
    const paginaActual = pageOverride ?? page
    const statusReal = statusFiltro.startsWith('__manual__') ? statusFiltro.replace('__manual__', '') : statusFiltro
    const resultado = await listarFacturas({ page: paginaActual, status: statusReal || undefined, folio: folioFiltro || undefined })
    if (resultado.error) {
      setError(resultado.error)
      setRows([])
    } else {
      const data = resultado.data
      const lista = Array.isArray(data) ? data : data?.Content ?? data?.content ?? data?.Items ?? data?.items ?? []
      setRows(Array.isArray(lista) ? lista : [])
    }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [page])

  function campo(row: any, ...nombres: string[]) {
    for (const n of nombres) {
      if (row[n] !== undefined && row[n] !== null) return row[n]
    }
    return undefined
  }

  async function verDetalle(id: string) {
    setDetalleCargando(true)
    setDetalle({ id })
    const resultado = await obtenerDetalleFactura(id)
    if (resultado.error) {
      setDetalle({ id, error: resultado.error })
    } else {
      setDetalle({ id, data: resultado.data })
    }
    setDetalleCargando(false)
  }

  async function descargar(id: string, formato: 'xml' | 'pdf' | 'html', folio: string) {
    setDescargando(`${id}-${formato}`)
    const resultado = await descargarArchivoFactura(id, formato)
    if (resultado.error) {
      alert(`No se pudo descargar: ${typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error)}`)
    } else if (resultado.base64) {
      const contentType = formato === 'xml' ? 'application/xml' : formato === 'pdf' ? 'application/pdf' : 'text/html'
      descargarBase64(resultado.base64, contentType, `factura-${folio || id}.${formato}`)
    }
    setDescargando(null)
  }

  async function confirmarCancelacion() {
    setCancelError('')
    if (motivo === '01' && !uuidSustituto.trim()) {
      setCancelError('Debes indicar el UUID de la factura que sustituye a esta.')
      return
    }
    const resultado = await cancelarFactura(cancelando.id, motivo as any, uuidSustituto || undefined)
    if (resultado.error) {
      setCancelError(typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error))
      return
    }
    setCancelando(null)
    setMotivo('02')
    setUuidSustituto('')
    cargar()
  }

  async function descargarAcuse(id: string, formato: 'pdf' | 'html') {
    const resultado = await descargarAcuseFactura(id, formato)
    if (resultado.error) {
      alert(`No se pudo descargar el acuse: ${typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error)}`)
    } else if (resultado.base64) {
      const contentType = formato === 'pdf' ? 'application/pdf' : 'text/html'
      descargarBase64(resultado.base64, contentType, `acuse-cancelacion-${id}.${formato}`)
    }
  }

  async function confirmarReenvio() {
    setReenviarError('')
    setReenviarOk(false)
    const resultado = await reenviarFacturaPorCorreo(reenviando.id, correoDestino)
    if (resultado.error) {
      setReenviarError(typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error))
      return
    }
    setReenviarOk(true)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      <h1>Facturas</h1>

           <div style={{ margin: '16px 0', padding: 12, border: '1px solid #444', borderRadius: 6 }}>
        <p style={{ margin: '0 0 8px 0' }}><strong>Diagnostico: consultar una factura por su Id interno</strong> (el campo "Id" del JSON, no el Folio)</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Id de la factura" value={consultaId} onChange={(e) => setConsultaId(e.target.value)} style={{ flex: 1, padding: 6 }} />
          <button onClick={consultarPorId}>Consultar</button>
        </div>
        {consultaError && <p style={{ color: 'crimson' }}>{consultaError}</p>}
        {consultaResultado && (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#1e1e1e', color: '#e5e5e5', padding: 8, marginTop: 8 }}>
            {JSON.stringify(consultaResultado, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
                <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activa</option>
          <option value="canceled">Cancelada</option>
          <option value="pending">Pendiente de cancelacion</option>
        </select>
        <input
          placeholder="Status manual de prueba (anula el de arriba)"
          value={statusFiltro.startsWith('__manual__') ? statusFiltro.replace('__manual__', '') : ''}
          onChange={(e) => setStatusFiltro('__manual__' + e.target.value)}
          style={{ padding: 6, minWidth: 220 }}
        />
        <input
          placeholder="Buscar por folio"
          value={folioFiltro}
          onChange={(e) => setFolioFiltro(e.target.value)}
          style={{ padding: 6 }}
        />
               <button onClick={() => { setPage(0); cargar(0) }}>Buscar</button>
      </div>

      {loading && <p>Cargando facturas...</p>}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {!loading && !error && rows.length === 0 && <p>No se encontraron facturas.</p>}

      {!loading && rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: 8 }}>Folio</th>
              <th style={{ padding: 8 }}>Fecha</th>
              <th style={{ padding: 8 }}>Receptor</th>
              <th style={{ padding: 8 }}>Total</th>
              <th style={{ padding: 8 }}>Estado</th>
              <th style={{ padding: 8 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const id = campo(row, 'Id', 'id', 'CfdiId')
              const folio = campo(row, 'Folio', 'folio') ?? ''
              const fecha = campo(row, 'Date', 'date', 'CreationDate') ?? ''
              const receptor = campo(row, 'Receiver', 'receiver') ?? {}
              const receptorNombre = receptor?.Name ?? receptor?.name ?? campo(row, 'TaxName', 'TaxEntityName', 'rfc') ?? '-'
              const total = campo(row, 'Total', 'total') ?? ''
              const status = campo(row, 'Status', 'status') ?? ''
              return (
                <tr key={id ?? i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>{folio}</td>
                  <td style={{ padding: 8 }}>{fecha}</td>
                  <td style={{ padding: 8 }}>{receptorNombre}</td>
                  <td style={{ padding: 8 }}>{total}</td>
                  <td style={{ padding: 8 }}>{status}</td>
                  <td style={{ padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => verDetalle(id)}>Ver</button>
                    <button disabled={descargando === `${id}-xml`} onClick={() => descargar(id, 'xml', folio)}>XML</button>
                    <button disabled={descargando === `${id}-pdf`} onClick={() => descargar(id, 'pdf', folio)}>PDF</button>
                    <button disabled={descargando === `${id}-html`} onClick={() => descargar(id, 'html', folio)}>HTML</button>
                    {status !== 'canceled' && (
                      <button style={{ color: 'crimson' }} onClick={() => setCancelando({ id, folio })}>Cancelar</button>
                    )}
                    {status === 'canceled' && (
                      <>
                        <button onClick={() => descargarAcuse(id, 'pdf')}>Acuse PDF</button>
                        <button onClick={() => descargarAcuse(id, 'html')}>Acuse HTML</button>
                      </>
                    )}
                    <button onClick={() => { setReenviando({ id, folio }); setCorreoDestino(''); setReenviarError(''); setReenviarOk(false) }}>Reenviar</button>
                    <button onClick={() => setVerCrudo(verCrudo === id ? null : id)}>
                      {verCrudo === id ? 'Ocultar JSON' : 'Ver JSON'}
                    </button>
                  </td>
                </tr>
              )
            }).reduce((acc: any[], el, i) => {
              acc.push(el)
              const row = rows[i]
              const id = campo(row, 'Id', 'id', 'CfdiId')
              if (verCrudo === id) {
                acc.push(
                  <tr key={`${id}-json`}>
                                        <td colSpan={6} style={{ padding: 8, background: '#1e1e1e' }}>
                      <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#e5e5e5' }}>{JSON.stringify(row, null, 2)}</pre>
                    </td>
                  </tr>
                )
              }
              return acc
            }, [])}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <button disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</button>
                <span>Pagina {page + 1}</span>
        <button onClick={() => setPage((p) => p + 1)}>Siguiente</button>
      </div>

      {detalle && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <button style={closeBtn} onClick={() => setDetalle(null)}>✕</button>
            <h2>Detalle de factura</h2>
            {detalleCargando && <p>Cargando...</p>}
            {detalle.error && <p style={{ color: 'crimson' }}>{detalle.error}</p>}
            {detalle.data && (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: '60vh', overflow: 'auto' }}>
                {JSON.stringify(detalle.data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {cancelando && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <button style={closeBtn} onClick={() => setCancelando(null)}>✕</button>
            <h2>Cancelar factura {cancelando.folio}</h2>
            <p>Selecciona el motivo de cancelacion:</p>
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ width: '100%', padding: 6, marginBottom: 12 }}>
              {MOTIVOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            {motivo === '01' && (
              <input
                placeholder="UUID de la factura sustituta"
                value={uuidSustituto}
                onChange={(e) => setUuidSustituto(e.target.value)}
                style={{ width: '100%', padding: 6, marginBottom: 12 }}
              />
            )}
            {cancelError && <p style={{ color: 'crimson' }}>{cancelError}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setCancelando(null)}>Cerrar</button>
              <button style={{ color: 'crimson' }} onClick={confirmarCancelacion}>Confirmar cancelacion</button>
            </div>
          </div>
        </div>
      )}

      {reenviando && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <button style={closeBtn} onClick={() => setReenviando(null)}>✕</button>
            <h2>Reenviar factura {reenviando.folio} por correo</h2>
            <input
              placeholder="correo@destino.com"
              value={correoDestino}
              onChange={(e) => setCorreoDestino(e.target.value)}
              style={{ width: '100%', padding: 6, marginBottom: 12 }}
            />
            {reenviarError && <p style={{ color: 'crimson' }}>{reenviarError}</p>}
            {reenviarOk && <p style={{ color: 'green' }}>Correo enviado correctamente.</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setReenviando(null)}>Cerrar</button>
              <button onClick={confirmarReenvio}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const modalOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}
const modalBox: React.CSSProperties = {
  background: 'white', color: '#111827', padding: 24, borderRadius: 8, width: '90%', maxWidth: 600,
  maxHeight: '85vh', overflow: 'auto', position: 'relative',
}
const closeBtn: React.CSSProperties = {
  position: 'absolute', top: 12, right: 12, border: 'none', background: 'none', fontSize: 18, cursor: 'pointer',
}