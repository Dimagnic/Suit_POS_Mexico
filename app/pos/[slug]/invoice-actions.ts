'use server'

import { createClient } from '@/lib/supabase/server'
import { crearCfdi } from '@/lib/facturama/client'

export async function generarFactura(saleId: string) {
  const supabase = await createClient()

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
      Rfc: 'XAXX010101000',
      Name: 'PUBLICO EN GENERAL',
      CfdiUse: 'S01',
      FiscalRegime: '616',
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
      receptor_rfc: 'XAXX010101000',
      receptor_razon_social: 'PUBLICO EN GENERAL',
      uso_cfdi: 'S01',
      total: sale.total,
      status: 'error',
      pac_response: result.error,
    })
    return { error: 'Facturama rechazó el CFDI. Revisa los detalles en Supabase → invoices.' }
  }

  const cfdi = result.data as any

  await supabase.from('invoices').insert({
    organization_id: sale.organization_id,
    sale_id: sale.id,
    uuid_fiscal: cfdi.Id ?? cfdi.Complement?.TaxStamp?.Uuid ?? null,
    serie: cfdi.Serie ?? 'T',
    folio: cfdi.Folio ?? null,
    receptor_rfc: 'XAXX010101000',
    receptor_razon_social: 'PUBLICO EN GENERAL',
    uso_cfdi: 'S01',
    total: sale.total,
    status: 'stamped',
    pac_response: cfdi,
    issued_at: new Date().toISOString(),
  })

  return { success: true, uuid: cfdi.Id ?? cfdi.Complement?.TaxStamp?.Uuid }
}