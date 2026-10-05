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

// --- Descarga de XML/PDF/HTML ---
// Documentacion oficial: https://facturama.elevio.help/es/articles/107
// API Web:        GET /Cfdi/{format}/issued/{id}
// API Multiemisor: GET /cfdi/{format}/issuedLite/{id}
async function descargarArchivo(format: 'xml' | 'pdf', cfdiId: string, multiemisor: boolean) {
  const url = multiemisor
    ? `${FACTURAMA_URL}/cfdi/${format}/issuedLite/${cfdiId}`
    : `${FACTURAMA_URL}/Cfdi/${format}/issued/${cfdiId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: getAuthHeader() },
  })

  const rawText = await response.text()

  if (!response.ok) {
    return { ok: false as const, error: `Error ${response.status} al descargar ${format}: ${rawText.slice(0, 200)}` }
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

export async function descargarXml(cfdiId: string, multiemisor = false) {
  return descargarArchivo('xml', cfdiId, multiemisor)
}

export async function descargarPdf(cfdiId: string, multiemisor = false) {
  return descargarArchivo('pdf', cfdiId, multiemisor)
}

// --- Cancelacion (API Multiemisor) ---
// DELETE /api-lite/cfdis/{cfdiId}?motive={motive}&uuidReplacement={uuidReplacement}
export async function cancelarCfdiMultiemisor(cfdiId: string, motive: '01' | '02' | '03' | '04' = '02', uuidReplacement?: string) {
  const params = new URLSearchParams({ motive })
  if (uuidReplacement) params.set('uuidReplacement', uuidReplacement)

  const response = await fetch(`${FACTURAMA_URL}/api-lite/cfdis/${cfdiId}?${params.toString()}`, {
    method: 'DELETE',
    headers: { Authorization: getAuthHeader() },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false as const, error: data ?? `Error ${response.status} al cancelar` }
  }

  return { ok: true as const, data }
}

// --- Envio por correo (API Multiemisor) ---
// POST /cfdi?CfdiType=issuedLite&CfdiId={id}&Email={email}&Subject={subject}&Comments={comments}&IssuerEmail={issuerEmail}
export async function enviarCorreoCfdiMultiemisor(cfdiId: string, email: string, opciones?: { subject?: string; comments?: string; issuerEmail?: string }) {
  const params = new URLSearchParams({
    CfdiType: 'issuedLite',
    CfdiId: cfdiId,
    Email: email,
  })
  if (opciones?.subject) params.set('Subject', opciones.subject)
  if (opciones?.comments) params.set('Comments', opciones.comments)
  if (opciones?.issuerEmail) params.set('IssuerEmail', opciones.issuerEmail)

  const response = await fetch(`${FACTURAMA_URL}/cfdi?${params.toString()}`, {
    method: 'POST',
    headers: { Authorization: getAuthHeader() },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false as const, error: data ?? `Error ${response.status} al enviar correo` }
  }

  return { ok: true as const, data }
}

// --- Busqueda filtrada (API Multiemisor) ---
// GET /cfdi?type=issuedLite&...filtros
export async function buscarCfdisMultiemisor(filtros: { page?: number; status?: string; rfcIssuer?: string; rfc?: string; folio?: string }) {
  const params = new URLSearchParams({ type: 'issuedLite' })
  if (filtros.page !== undefined) params.set('page', String(filtros.page))
  if (filtros.status) params.set('status', filtros.status)
  if (filtros.rfcIssuer) params.set('rfcIssuer', filtros.rfcIssuer)
  if (filtros.rfc) params.set('rfc', filtros.rfc)
  if (filtros.folio) params.set('folio', filtros.folio)

  const response = await fetch(`${FACTURAMA_URL}/cfdi?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: getAuthHeader() },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    return { ok: false as const, error: data ?? `Error ${response.status} al buscar facturas` }
  }

  return { ok: true as const, data }
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