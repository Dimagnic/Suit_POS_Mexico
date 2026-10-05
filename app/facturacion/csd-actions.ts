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

  return { csd: data ?? null, role: current.role }
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