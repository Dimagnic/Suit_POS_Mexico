'use server'

import { createClient } from '@/lib/supabase/server'
import { crearCfdi, descargarXml, descargarPdf } from '@/lib/facturama/client'

type ReceptorInput = {
  rfc: string
  razonSocial: string
  regimenFiscal: string
  usoCfdi: string
}

const RFC_PUBLICO_GENERAL = 'XAXX010101000'

function validarRfc(rfc: string): boolean {
  const rfcRegex = /^([A-ZÑ&]{3,4})\d{6}[A-Z0-9]{3}$/
  return rfcRegex.test(rfc.trim().toUpperCase())
}

export async function generarFactura(saleId: string, receptor?: ReceptorInput) {
  const supabase = await createClient()

  // Receptor por defecto: Público en General
  let receptorFinal = {
    rfc: RFC_PUBLICO_GENERAL,
    razonSocial: 'PUBLICO EN GENERAL',
    regimenFiscal: '616',
    usoCfdi: 'S01',
  }

  if (receptor && receptor.rfc.trim() !== '') {
    const rfcLimpio = receptor.rfc.trim().toUpperCase()

    if (!validarRfc(rfcLimpio)) {
      return { error: 'El RFC no tiene un formato válido. Verifícalo e intenta de nuevo.' }
    }
    if (!receptor.razonSocial.trim()) {
      return { error: 'Falta la razón social del receptor.' }
    }
    if (!receptor.regimenFiscal) {
      return { error: 'Falta el régimen fiscal del receptor.' }
    }
    if (!receptor.usoCfdi) {
      return { error: 'Falta el uso de CFDI.' }
    }

    receptorFinal = {
      rfc: rfcLimpio,
      razonSocial: receptor.razonSocial.trim().toUpperCase(),
      regimenFiscal: receptor.regimenFiscal,
      usoCfdi: receptor.usoCfdi,
    }
  }

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select('id, organization_id, subtotal, tax, total, created_at')
    .eq('id', saleId)
    .single()

  if (saleError || !sale) {
    return { error: 'No se encontró la venta.' }
  }

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select('quantity, unit_price, subtotal, products(name)')
    .eq('sale_id', saleId)

  if (itemsError || !items || items.length === 0) {
    return { error: 'No se encontraron los productos de la venta.' }
  }

  const { data: fiscalProfile, error: fpError } = await supabase
    .from('fiscal_profiles')
    .select('rfc, razon_social, regimen_fiscal, codigo_postal, uso_cfdi_default')
    .eq('organization_id', sale.organization_id)
    .single()

  if (fpError || !fiscalProfile) {
    return { error: 'Tu organización no tiene un perfil fiscal configurado.' }
  }

  const now = new Date(sale.created_at)

  const cfdiItems = items.map((item: any) => {
    const rate = 0.16
    const taxTotal = Number((item.subtotal * rate).toFixed(2))
    return {
      ProductCode: '01010101',
      Description: item.products?.name ?? 'Producto',
      UnitCode: 'H87',
      UnitPrice: item.unit_price,
      Quantity: item.quantity,
      Subtotal: item.subtotal,
      TaxObject: '02',
      Taxes: [
        {
          Total: taxTotal,
          Name: 'IVA',
          Base: item.subtotal,
          Rate: rate,
          IsRetention: false,
        },
      ],
      Total: Number((item.subtotal + taxTotal).toFixed(2)),
    }
  })

  const payload = {
    NameId: '1',
    Currency: 'MXN',
    ExpeditionPlace: fiscalProfile.codigo_postal,
    PaymentConditions: 'Contado',
    CfdiType: 'I',
    PaymentForm: '01',
    PaymentMethod: 'PUE',
    Exportation: '01',
    Receiver: {
      Rfc: receptorFinal.rfc,
      Name: receptorFinal.razonSocial,
      CfdiUse: receptorFinal.usoCfdi,
      FiscalRegime: receptorFinal.regimenFiscal,
      TaxZipCode: fiscalProfile.codigo_postal,
    },
    GlobalInformation: {
      Periodicity: '01',
      Months: String(now.getMonth() + 1).padStart(2, '0'),
      Year: String(now.getFullYear()),
    },
    Items: cfdiItems,
  }

  const result = await crearCfdi(payload)

  if (!result.ok) {
    await supabase.from('invoices').insert({
      organization_id: sale.organization_id,
      sale_id: sale.id,
      receptor_rfc: receptorFinal.rfc,
      receptor_razon_social: receptorFinal.razonSocial,
      uso_cfdi: receptorFinal.usoCfdi,
      total: sale.total,
      status: 'error',
      pac_response: result.error,
    })
    return { error: 'Facturama rechazó el CFDI. Revisa los detalles en Supabase → invoices.' }
  }

  const cfdi = result.data as any
  const cfdiId = cfdi.Id ?? cfdi.Complement?.TaxStamp?.Uuid

  // Intentamos descargar XML y PDF, pero si falla no bloqueamos el timbrado ya exitoso
  const [xmlResult, pdfResult] = await Promise.all([
    descargarXml(cfdiId),
    descargarPdf(cfdiId),
  ])

  const { error: insertError } = await supabase.from('invoices').insert({
    organization_id: sale.organization_id,
    sale_id: sale.id,
    uuid_fiscal: cfdi.Id ?? cfdi.Complement?.TaxStamp?.Uuid ?? null,
    serie: cfdi.Serie ?? 'T',
    folio: cfdi.Folio ?? null,
    receptor_rfc: receptorFinal.rfc,
    receptor_razon_social: receptorFinal.razonSocial,
    uso_cfdi: receptorFinal.usoCfdi,
    total: sale.total,
    status: 'stamped',
    pac_response: cfdi,
    xml_content: xmlResult.ok ? xmlResult.base64 : null,
    pdf_content: pdfResult.ok ? pdfResult.base64 : null,
    issued_at: new Date().toISOString(),
  })

  if (insertError) {
    return { error: 'Se timbró correctamente pero no se pudo guardar en la base de datos: ' + insertError.message }
  }

  return {
    success: true,
    uuid: cfdi.Id ?? cfdi.Complement?.TaxStamp?.Uuid,
    xmlBase64: xmlResult.ok ? xmlResult.base64 : null,
    pdfBase64: pdfResult.ok ? pdfResult.base64 : null,
  }
}