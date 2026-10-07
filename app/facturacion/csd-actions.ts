'use server'

import { createClient } from '@/lib/supabase/server'
import { X509Certificate } from 'crypto'
import { encryptToBase64, encryptText } from '@/lib/crypto/csd'
import { registrarCsd, consultarCsd } from '@/lib/facturama/client'
import { revalidatePath } from 'next/cache'

async function getCurrentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()
  return appUser
}

export async function getCsdStatus() {
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const supabase = await createClient()
  const { data } = await supabase
    .from('csd_credentials')
    .select('id, valid_from, valid_until, created_at')
    .eq('organization_id', current.organization_id)
    .maybeSingle()

  const { data: fiscalProfile } = await supabase
    .from('fiscal_profiles')
    .select('rfc, razon_social, regimen_fiscal, codigo_postal, uso_cfdi_default')
    .eq('organization_id', current.organization_id)
    .maybeSingle()

  return { csd: data ?? null, fiscalProfile: fiscalProfile ?? null, role: current.role }
}

export async function guardarPerfilFiscal(input: {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  codigoPostal: string
  usoCfdiDefault: string
}) {
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (current.role !== 'owner') return { error: 'Solo el dueño de la organizacion puede configurar los datos fiscales.' }

  const rfc = input.rfc.trim().toUpperCase()
  const razonSocial = input.razonSocial.trim()
  const codigoPostal = input.codigoPostal.trim()

  if (rfc.length < 12 || rfc.length > 13) {
    return { error: 'El RFC debe tener 12 caracteres (persona moral) o 13 (persona fisica).' }
  }
  if (!razonSocial) {
    return { error: 'La razon social es obligatoria.' }
  }
  if (!input.regimenFiscal) {
    return { error: 'Selecciona un regimen fiscal.' }
  }
  if (!/^\d{5}$/.test(codigoPostal)) {
    return { error: 'El codigo postal debe tener 5 digitos.' }
  }
  if (!input.usoCfdiDefault) {
    return { error: 'Selecciona un uso de CFDI por default.' }
  }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('fiscal_profiles')
    .select('id')
    .eq('organization_id', current.organization_id)
    .maybeSingle()

  const payload = {
    rfc,
    razon_social: razonSocial,
    regimen_fiscal: input.regimenFiscal,
    codigo_postal: codigoPostal,
    uso_cfdi_default: input.usoCfdiDefault,
  }

  if (existing) {
    const { error } = await supabase.from('fiscal_profiles').update(payload).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('fiscal_profiles').insert({
      organization_id: current.organization_id,
      ...payload,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/facturacion')
  return { success: true }
}

export async function consultarCsdRegistrado() {
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const supabase = await createClient()
  const { data: fiscalProfile } = await supabase
    .from('fiscal_profiles')
    .select('rfc')
    .eq('organization_id', current.organization_id)
    .single()

  if (!fiscalProfile) return { error: 'No hay perfil fiscal configurado.' }

  const resultado = await consultarCsd(fiscalProfile.rfc)
  return { rfc: fiscalProfile.rfc, resultado }
}

export async function uploadCsd(cerBase64: string, keyBase64: string, password: string) {
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (current.role !== 'owner') return { error: 'Solo el dueño de la organizacion puede configurar el CSD.' }

  if (!cerBase64 || !keyBase64 || !password) {
    return { error: 'Debes subir el archivo .cer, el archivo .key y la contraseña.' }
  }

  let validFrom: string | null = null
  let validUntil: string | null = null

  try {
    const cerBuffer = Buffer.from(cerBase64, 'base64')
    const cert = new X509Certificate(cerBuffer)
    validFrom = new Date(cert.validFrom).toISOString().slice(0, 10)
    validUntil = new Date(cert.validTo).toISOString().slice(0, 10)
  } catch {
    return { error: 'El archivo .cer no es un certificado valido. Verifica que sea el archivo correcto.' }
  }

  const supabase = await createClient()

  const { data: fiscalProfile, error: fpError } = await supabase
    .from('fiscal_profiles')
    .select('rfc')
    .eq('organization_id', current.organization_id)
    .single()

  if (fpError || !fiscalProfile) {
    return { error: 'Tu organizacion no tiene un perfil fiscal configurado (RFC, razon social, etc). Configuralo antes de subir el CSD.' }
  }

  const registro = await registrarCsd(fiscalProfile.rfc, cerBase64, keyBase64, password)

  if (!registro.ok) {
    return { error: 'Facturama rechazo el CSD: ' + JSON.stringify(registro.error) }
  }

  const cerEncrypted = encryptToBase64(cerBase64)
  const keyEncrypted = encryptToBase64(keyBase64)
  const passwordEncrypted = encryptText(password)

  const { data: existing } = await supabase
    .from('csd_credentials')
    .select('id')
    .eq('organization_id', current.organization_id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('csd_credentials')
      .update({
        cer_encrypted: cerEncrypted,
        key_encrypted: keyEncrypted,
        password_encrypted: passwordEncrypted,
        valid_from: validFrom,
        valid_until: validUntil,
      })
      .eq('id', existing.id)

    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('csd_credentials').insert({
      organization_id: current.organization_id,
      cer_encrypted: cerEncrypted,
      key_encrypted: keyEncrypted,
      password_encrypted: passwordEncrypted,
      valid_from: validFrom,
      valid_until: validUntil,
    })

    if (error) return { error: error.message }
  }

  revalidatePath('/facturacion')
  return { success: true, validFrom, validUntil }
}