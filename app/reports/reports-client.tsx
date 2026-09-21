'use client'

import { useState, useTransition } from 'react'
import { getReportData } from './actions'

type ReportData = {
  resumen: { totalVentas: number; totalIva: number; numVentas: number }
  porGiro: { nombre: string; total: number; count: number }[]
  ventas: { id: string; total: number; createdAt: string; giro: string; branch: string }[]
  branches: { id: string; name: string }[]
  giros: { id: string; nombre: string }[]
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.85rem',
}

const cardStat: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)',
  borderRadius: 'var(--radius)', padding: 'var(--space-3)', flex: '1 1 180px',
}

export default function ReportsClient({
  initial,
  initialFrom,
  initialTo,
}: {
  initial: ReportData
  initialFrom: string
  initialTo: string
}) {
  const [data, setData] = useState(initial)
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [branchId, setBranchId] = useState('')
  const [giroId, setGiroId] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleFilter() {
    startTransition(async () => {
      const result = await getReportData({ from, to, branchId: branchId || undefined, giroId: giroId || undefined })
      if (!('error' in result)) setData(result as ReportData)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Del</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>al</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />

        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={inputStyle}>
          <option value="">Todas las sucursales</option>
          {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select value={giroId} onChange={(e) => setGiroId(e.target.value)} style={inputStyle}>
          <option value="">Todos los giros</option>
          {data.giros.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
        </select>

        <button onClick={handleFilter} disabled={isPending} style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 'var(--radius)', padding: '0.5rem 1rem', fontWeight: 600, cursor: 'pointer' }}>
          {isPending ? 'Cargando...' : 'Filtrar'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <div style={cardStat}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total ventas</span>
          <p className="mono" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0', color: 'var(--accent)' }}>${data.resumen.totalVentas.toFixed(2)}</p>
        </div>
        <div style={cardStat}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>IVA recaudado</span>
          <p className="mono" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0' }}>${data.resumen.totalIva.toFixed(2)}</p>
        </div>
        <div style={cardStat}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Número de ventas</span>
          <p className="mono" style={{ fontSize: '1.5rem', margin: '0.25rem 0 0' }}>{data.resumen.numVentas}</p>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Por giro</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {data.porGiro.length === 0 && <p style={{ padding: 'var(--space-2)', color: 'var(--text-muted)' }}>Sin ventas en este rango.</p>}
          {data.porGiro.map((g, idx) => (
            <div key={g.nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem var(--space-2)', borderTop: idx === 0 ? 'none' : '1px solid var(--border)' }}>
              <span>{g.nombre} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({g.count} ventas)</span></span>
              <span className="mono" style={{ color: 'var(--accent)' }}>${g.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: 'var(--space-2)' }}>Últimas ventas (máx. 50)</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxHeight: '400px', overflowY: 'auto' }}>
          {data.ventas.map((v, idx) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem var(--space-2)', borderTop: idx === 0 ? 'none' : '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{new Date(v.createdAt).toLocaleString('es-MX')}</span>
              <span>{v.giro} · {v.branch}</span>
              <span className="mono">${v.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
