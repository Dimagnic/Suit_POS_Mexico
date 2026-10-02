'use client'

import { useState } from 'react'
import { uploadCsd } from './csd-actions'

type Csd = { id: string; valid_from: string | null; valid_until: string | null; created_at: string } | null

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

export default function CsdClient({ csd, role }: { csd: Csd; role: string }) {
  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; error?: string; validFrom?: string | null; validUntil?: string | null } | null>(null)

  if (role !== 'owner') {
    return (
      <p style={{ color: 'var(--text-muted)' }}>
        Solo el dueño de la organizacion puede configurar el CSD de facturacion.
      </p>
    )
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

  return (
    <div style={{ maxWidth: '480px' }}>
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