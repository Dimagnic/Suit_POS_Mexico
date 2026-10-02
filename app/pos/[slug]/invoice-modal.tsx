'use client'

import { useEffect, useState } from 'react'

export type Receptor = {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  usoCfdi: string
}

export default function InvoiceModal({
  open,
  onCancel,
  onSubmit,
  loading,
  error,
}: {
  open: boolean
  onCancel: () => void
  onSubmit: (receptor?: Receptor) => void
  loading: boolean
  error?: string | null
}) {
  const [esPublicoGeneral, setEsPublicoGeneral] = useState(true)
  const [rfc, setRfc] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [regimenFiscal, setRegimenFiscal] = useState('601')
  const [usoCfdi, setUsoCfdi] = useState('G03')

  useEffect(() => {
    if (open) {
      setEsPublicoGeneral(true)
      setRfc('')
      setRazonSocial('')
      setRegimenFiscal('601')
      setUsoCfdi('G03')
    }
  }, [open])

  if (!open) return null

  return (
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
          border: '1px solid var(--border)',
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

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>✕ {error}</p>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'var(--space-2)' }}>
          <button
            onClick={onCancel}
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
            onClick={() => onSubmit(esPublicoGeneral ? undefined : { rfc, razonSocial, regimenFiscal, usoCfdi })}
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.6rem',
              background: 'var(--accent)',
              color: '#1a1206',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Generando...' : 'Timbrar'}
          </button>
        </div>
      </div>
    </div>
  )
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