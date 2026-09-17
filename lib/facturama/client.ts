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