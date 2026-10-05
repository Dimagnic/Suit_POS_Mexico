const FACTURAMA_URL = 'https://apisandbox.facturama.mx'

function getAuthHeader() {
  const user = process.env.FACTURAMA_API_USER!
  const pass = process.env.FACTURAMA_API_PASSWORD!
  const token = Buffer.from(`${user}:${pass}`).toString('base64')
  return `Basic ${token}`
}

export async function crearCfdi(payload: unknown) {
  const response = await fetch(`${FACTURAMA_URL}/3/cfdis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    return { ok: false as const, error: data }
  }

  return { ok: true as const, data }
}

export async function registrarCsd(rfc: string, certificateBase64: string, privateKeyBase64: string, privateKeyPassword: string) {
  const response = await fetch(`${FACTURAMA_URL}/api-lite/csds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify({
      Rfc: rfc,
      Certificate: certificateBase64,
      PrivateKey: privateKeyBase64,
      PrivateKeyPassword: privateKeyPassword,
    }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false as const, error: data ?? `Error ${response.status} al registrar el CSD` }
  }

  return { ok: true as const, data }
}

export async function crearCfdiMultiemisor(payload: unknown) {
  const response = await fetch(`${FACTURAMA_URL}/api-lite/3/cfdis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    return { ok: false as const, error: data }
  }

  return { ok: true as const, data }
}

// Descarga el XML o PDF de un CFDI ya timbrado.
async function descargarArchivo(format: 'xml' | 'pdf', cfdiId: string) {
  const response = await fetch(`${FACTURAMA_URL}/Cfdi/${format}/issued/${cfdiId}`, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
  })

  const rawText = await response.text()

  if (!response.ok) {
    return { ok: false as const, error: `Error ${response.status} al descargar ${format}` }
  }

  let data: any
  try {
    data = JSON.parse(rawText)
  } catch {
    return { ok: false as const, error: `Respuesta de ${format} no es JSON valido` }
  }

  const base64Content = data.Content ?? data.content ?? null

  if (!base64Content) {
    return { ok: false as const, error: `Respuesta de Facturama sin contenido de ${format}` }
  }

  return { ok: true as const, base64: base64Content as string }
}

export async function descargarXml(cfdiId: string) {
  return descargarArchivo('xml', cfdiId)
}

export async function descargarPdf(cfdiId: string) {
  return descargarArchivo('pdf', cfdiId)
}

export async function consultarCsd(rfc: string) {
  const response = await fetch(`${FACTURAMA_URL}/api-lite/csds/${rfc}`, {
    method: 'GET',
    headers: { Authorization: getAuthHeader() },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false as const, error: data ?? `Error ${response.status} al consultar el CSD` }
  }
  return { ok: true as const, data }
}