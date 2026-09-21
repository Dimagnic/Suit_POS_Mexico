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
    return { ok: false as const, error: `Respuesta de ${format} no es JSON válido` }
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