'use server'

import { createClient } from '@/lib/supabase/server'
import { canEditCatalog, type Role } from '@/lib/permissions'
import {
  buscarCfdisMultiemisor,
  consultarCfdiDetalle,
  descargarXml,
  descargarPdf,
  descargarHtml,
  cancelarCfdiMultiemisor,
  descargarAcuseCancelacion,
  enviarCorreoCfdiMultiemisor,
} from '@/lib/facturama/client'

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

async function getRfcOrganizacion(supabase: any, organizationId: string) {
  const { data } = await supabase
    .from('fiscal_profiles')
    .select('rfc, razon_social')
    .eq('organization_id', organizationId)
    .single()
  return data as { rfc: string; razon_social: string } | null
}

export async function listarFacturas(filtros: { page?: number; status?: string; folio?: string; dateStart?: string; dateEnd?: string }) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const fiscal = await getRfcOrganizacion(supabase, current.organization_id)
  if (!fiscal?.rfc) return { error: 'Tu organizacion no tiene un RFC fiscal configurado todavia.' }

  const resultado = await buscarCfdisMultiemisor({ ...filtros, rfcIssuer: fiscal.rfc })
  if (!resultado.ok) return { error: typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error) }

  return { success: true, data: resultado.data, rfc: fiscal.rfc }
}

async function verificarPropiedad(supabase: any, organizationId: string, cfdiId: string) {
  const fiscal = await getRfcOrganizacion(supabase, organizationId)
  if (!fiscal?.rfc) return { ok: false, error: 'Tu organizacion no tiene un RFC fiscal configurado.' }

  const detalle = await consultarCfdiDetalle(cfdiId)
  if (!detalle.ok) return { ok: false, error: typeof detalle.error === 'string' ? detalle.error : JSON.stringify(detalle.error) }

  const issuerRfc = detalle.data?.Issuer?.Rfc ?? detalle.data?.Issuer?.rfc
  if (issuerRfc !== fiscal.rfc) return { ok: false, error: 'Esa factura no pertenece a tu organizacion.' }

  return { ok: true, data: detalle.data }
}

export async function obtenerDetalleFactura(cfdiId: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const check = await verificarPropiedad(supabase, current.organization_id, cfdiId)
  if (!check.ok) return { error: check.error }

  return { success: true, data: check.data }
}

export async function descargarArchivoFactura(cfdiId: string, formato: 'xml' | 'pdf' | 'html') {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const check = await verificarPropiedad(supabase, current.organization_id, cfdiId)
  if (!check.ok) return { error: check.error }

  const resultado =
    formato === 'xml' ? await descargarXml(cfdiId, true) :
    formato === 'pdf' ? await descargarPdf(cfdiId, true) :
    await descargarHtml(cfdiId, true)

  if (!resultado.ok) return { error: resultado.error }
  return { success: true, base64: resultado.base64 }
}

export async function cancelarFactura(cfdiId: string, motive: '01' | '02' | '03' | '04', uuidReplacement?: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para cancelar facturas.' }

  const check = await verificarPropiedad(supabase, current.organization_id, cfdiId)
  if (!check.ok) return { error: check.error }

  if (motive === '01' && !uuidReplacement) {
    return { error: 'El motivo 01 requiere el UUID de la factura que sustituye a esta.' }
  }

  const resultado = await cancelarCfdiMultiemisor(cfdiId, motive, uuidReplacement)
  if (!resultado.ok) return { error: typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error) }

  return { success: true, data: resultado.data }
}

export async function descargarAcuseFactura(cfdiId: string, formato: 'pdf' | 'html') {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const check = await verificarPropiedad(supabase, current.organization_id, cfdiId)
  if (!check.ok) return { error: check.error }

  const resultado = await descargarAcuseCancelacion(cfdiId, formato)
  if (!resultado.ok) return { error: resultado.error }
  return { success: true, base64: resultado.base64 }
}

export async function reenviarFacturaPorCorreo(cfdiId: string, email: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para reenviar facturas.' }

  const check = await verificarPropiedad(supabase, current.organization_id, cfdiId)
  if (!check.ok) return { error: check.error }

  if (!email.trim() || !email.includes('@')) return { error: 'Correo invalido.' }

  const resultado = await enviarCorreoCfdiMultiemisor(cfdiId, email.trim())
  if (!resultado.ok) return { error: typeof resultado.error === 'string' ? resultado.error : JSON.stringify(resultado.error) }

  return { success: true }
}