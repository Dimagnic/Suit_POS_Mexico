'use client'

import { useState } from 'react'
import { uploadCsd, consultarCsdRegistrado, guardarPerfilFiscal } from './csd-actions'

type Csd = { id: string; valid_from: string | null; valid_until: string | null; created_at: string } | null
type FiscalProfile = { rfc: string; razon_social: string; regimen_fiscal: string; codigo_postal: string; uso_cfdi_default: string } | null

const REGIMENES = [
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '605', label: '605 - Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { value: '606', label: '606 - Arrendamiento' },
  { value: '608', label: '608 - Demas ingresos' },
  { value: '612', label: '612 - Personas Fisicas con Actividades Empresariales y Profesionales' },
  { value: '616', label: '616 - Sin obligaciones fiscales' },
  { value: '621', label: '621 - Incorporacion Fiscal' },
  { value: '625', label: '625 - Regimen Simplificado de Confianza (Personas Fisicas)' },
  { value: '626', label: '626 - Regimen Simplificado de Confianza (Personas Morales)' },
]

const USOS_CFDI = [
  { value: 'G01', label: 'G01 - Adquisicion de mercancias' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
  { value: 'P01', label: 'P01 - Por definir' },
]

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function CsdClient({ csd, fiscalProfile, role }: { csd: Csd; fiscalProfile: FiscalProfile; role: string }) {
  const [perfil, setPerfil] = useState<FiscalProfile>(fiscalProfile)
  const [rfc, setRfc] = useState(fiscalProfile?.rfc ?? '')
  const [razonSocial, setRazonSocial] = useState(fiscalProfile?.razon_social ?? '')
  const [regimenFiscal, setRegimenFiscal] = useState(fiscalProfile?.regimen_fiscal ?? '')
  const [codigoPostal, setCodigoPostal] = useState(fiscalProfile?.codigo_postal ?? '')
  const [usoCfdiDefault, setUsoCfdiDefault] = useState(fiscalProfile?.uso_cfdi_default ?? '')
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [perfilResult, setPerfilResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; validFrom?: string | null; validUntil?: string | null } | null>(null)
  const [consulta, setConsulta] = useState<any>(null)
  const [consultando, setConsultando] = useState(false)

  const handleConsultar = async () => {
    setConsultando(true)
    const res = await consultarCsdRegistrado()
    setConsultando(false)
    setConsulta(res)
  }

  if (role !== 'owner') {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        Solo el dueño de la organizacion puede configurar el CSD de facturacion.
      </p>
    )
  }

  const handleGuardarPerfil = async () => {
    setGuardandoPerfil(true)
    setPerfilResult(null)
    const res = await guardarPerfilFiscal({ rfc, razonSocial, regimenFiscal, codigoPostal, usoCfdiDefault })
    setGuardandoPerfil(false)
    setPerfilResult(res)
    if (res.success) {
      setPerfil({
        rfc: rfc.trim().toUpperCase(),
        razon_social: razonSocial.trim(),
        regimen_fiscal: regimenFiscal,
        codigo_postal: codigoPostal.trim(),
        uso_cfdi_default: usoCfdiDefault,
      })
    }
  }

  const handleSubmit = async () => {
    if (!cerFile || !keyFile || !password) {
      setResult({ error: 'Debes seleccionar el archivo .cer, el archivo .key y escribir la contraseña.' })
      return
    }
    setSaving(true)
    setResult(null)

    const cerBase64 = await fileToBase64(cerFile)
    const keyBase64 = await fileToBase64(keyFile)

    const res = await uploadCsd(cerBase64, keyBase64, password)
    setSaving(false)
    setResult(res)

    if (res.success) {
      setCerFile(null)
      setKeyFile(null)
      setPassword('')
    }
  }

  if (!perfil) {
    return (
      <div style={{ maxWidth: '480px' }}>
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Antes de subir tu CSD, captura los datos fiscales de tu negocio. Son los datos que aparecen como emisor en cada factura.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <label style={fieldStyle}>
            RFC
            <input value={rfc} onChange={(e) => setRfc(e.target.value)} style={inputStyle} placeholder="Ej. EKU9003173C9" />
          </label>

          <label style={fieldStyle}>
            Razon social
            <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} style={inputStyle} placeholder="Debe coincidir exacto con lo registrado ante el SAT" />
          </label>

          <label style={fieldStyle}>
            Regimen fiscal
            <select value={regimenFiscal} onChange={(e) => setRegimenFiscal(e.target.value)} style={inputStyle}>
              <option value="">Selecciona...</option>
              {REGIMENES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>

          <label style={fieldStyle}>
            Codigo postal (lugar de expedicion)
            <input value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} style={inputStyle} placeholder="Ej. 42501" maxLength={5} />
          </label>

          <label style={fieldStyle}>
            Uso de CFDI por default
            <select value={usoCfdiDefault} onChange={(e) => setUsoCfdiDefault(e.target.value)} style={inputStyle}>
              <option value="">Selecciona...</option>
              {USOS_CFDI.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
          </label>

          <button
            onClick={handleGuardarPerfil}
            disabled={guardandoPerfil}
            style={{
              padding: '0.85rem',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius)',
              color: '#1a1206',
              fontWeight: 600,
              cursor: guardandoPerfil ? 'not-allowed' : 'pointer',
              marginTop: 'var(--space-1)',
            }}
          >
            {guardandoPerfil ? 'Guardando...' : 'Guardar datos fiscales'}
          </button>

          {perfilResult?.error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{perfilResult.error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-3)',
          marginBottom: 'var(--space-3)',
        }}
      >
        <p style={{ margin: '0 0 0.3rem', color: 'var(--success)', fontSize: '0.9rem' }}>
          ✓ Datos fiscales configurados — {perfil.razon_social} ({perfil.rfc})
        </p>
      </div>

      {csd && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <p style={{ margin: '0 0 0.3rem', color: 'var(--success)', fontSize: '0.9rem' }}>
            ✓ CSD configurado
          </p>
          {csd.valid_from && csd.valid_until && (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Vigente del {csd.valid_from} al {csd.valid_until}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label style={fieldStyle}>
          Archivo .cer
          <input
            type="file"
            accept=".cer"
            onChange={(e) => setCerFile(e.target.files?.[0] ?? null)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          Archivo .key
          <input
            type="file"
            accept=".key"
            onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
            style={inputStyle}
          />
        </label>

        <label style={fieldStyle}>
          Contraseña de la llave privada
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </label>

        <button
          onClick={handleSubmit}
          disabled={saving}
          style={{
            padding: '0.85rem',
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 'var(--radius)',
            color: '#1a1206',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            marginTop: 'var(--space-1)',
          }}
        >
          {saving ? 'Guardando...' : csd ? 'Reemplazar CSD' : 'Guardar CSD'}
        </button>

        <button
          type="button"
          onClick={handleConsultar}
          disabled={consultando}
          style={{
            padding: '0.6rem',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-muted)',
            cursor: consultando ? 'not-allowed' : 'pointer',
          }}
        >
          {consultando ? 'Consultando...' : '🔍 Consultar CSD registrado en Facturama'}
        </button>

        {consulta && (
          <pre style={{ fontSize: '0.75rem', background: 'var(--bg)', padding: '0.75rem', borderRadius: 'var(--radius)', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(consulta, null, 2)}
          </pre>
        )}

        {result?.error && (
          <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{result.error}</p>
        )}
        {result?.success && (
          <p style={{ color: 'var(--success)', fontSize: '0.85rem' }}>
            ✓ CSD guardado correctamente (vigente del {result.validFrom} al {result.validUntil})
          </p>
        )}
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  fontSize: '0.85rem',
  color: 'var(--text-muted)',
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
}
