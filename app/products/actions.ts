'use server'

import { createClient } from '@/lib/supabase/server'
import { canEditCatalog, type Role } from '@/lib/permissions'
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
async function existeProductoDuplicado(
  supabase: any,
  organizationId: string,
  giroId: string,
  name: string,
  sku: string | null,
  excludeProductId?: string
) {
  let query = supabase
    .from('products')
    .select('id, name, sku')
    .eq('organization_id', organizationId)
    .eq('giro_id', giroId)

  if (excludeProductId) {
    query = query.neq('id', excludeProductId)
  }

  const { data: candidatos } = await query

  if (!candidatos) return null

  const nameNormalizado = name.trim().toLowerCase()
  const skuNormalizado = sku?.trim().toLowerCase()

  const duplicadoPorNombre = candidatos.find(
    (p: any) => p.name.trim().toLowerCase() === nameNormalizado
  )
  if (duplicadoPorNombre) {
    return { tipo: 'nombre' as const, producto: duplicadoPorNombre }
  }

  if (skuNormalizado) {
    const duplicadoPorSku = candidatos.find(
      (p: any) => p.sku && p.sku.trim().toLowerCase() === skuNormalizado
    )
    if (duplicadoPorSku) {
      return { tipo: 'sku' as const, producto: duplicadoPorSku }
    }
  }

  return null
}
export async function getGirosConProductos() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const { data: activos } = await supabase
    .from('organization_giros')
    .select('giro_id, giros(slug, nombre, icono)')
    .eq('organization_id', current.organization_id)
    .eq('status', 'active')

  const { data: counts } = await supabase
    .from('products')
    .select('giro_id')
    .eq('organization_id', current.organization_id)
    .eq('is_active', true)

  const countMap = new Map<string, number>()
  counts?.forEach((p) => countMap.set(p.giro_id, (countMap.get(p.giro_id) ?? 0) + 1))

  const giros = (activos ?? []).map((a: any) => ({
    giroId: a.giro_id,
    slug: a.giros.slug,
    nombre: a.giros.nombre,
    icono: a.giros.icono,
    count: countMap.get(a.giro_id) ?? 0,
  }))

  return { giros, currentRole: current.role as Role }
}

export async function getProductsForGiro(giroSlug: string) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const { data: giro } = await supabase.from('giros').select('id, slug, nombre, icono').eq('slug', giroSlug).single()
  if (!giro) return { error: 'Giro no encontrado' }

  const { data: products, error } = await supabase
    .from('products')
    .select('id, sku, name, price, cost, stock_quantity, unit, category, duration_minutes, is_active')
    .eq('organization_id', current.organization_id)
    .eq('giro_id', giro.id)
    .order('name')

  if (error) return { error: error.message }

  return { giro, products, currentRole: current.role as Role, organizationId: current.organization_id }
}

type ProductInput = {
  sku: string
  name: string
  price: number
  cost: number
  stockQuantity: number
  unit: string
  category: string
  durationMinutes: number | null
}

export async function createProduct(giroId: string, input: ProductInput) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar el catálogo.' }

  if (!input.name.trim()) return { error: 'El nombre es obligatorio.' }

  const duplicado = await existeProductoDuplicado(
    supabase,
    current.organization_id,
    giroId,
    input.name,
    input.sku
  )
  if (duplicado) {
    if (duplicado.tipo === 'nombre') {
      return { error: `Ya existe un producto llamado "${duplicado.producto.name}" en este giro.` }
    }
    return { error: `El SKU "${duplicado.producto.sku}" ya está en uso por "${duplicado.producto.name}".` }
  }

  const { data, error } = await supabase
    .from('products')
    .insert({
      organization_id: current.organization_id,
      giro_id: giroId,
      sku: input.sku.trim() || null,
      name: input.name.trim(),
      price: input.price,
      cost: input.cost,
      stock_quantity: input.stockQuantity,
      unit: input.unit.trim() || 'pza',
      category: input.category.trim() || null,
      duration_minutes: input.durationMinutes,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/products')
  return { success: true, id: data.id }
}

export async function updateProduct(productId: string, input: ProductInput) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar el catálogo.' }

  const { data: target } = await supabase.from('products').select('organization_id, giro_id').eq('id', productId).single()
  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese producto no pertenece a tu organización.' }
  }

  const duplicado = await existeProductoDuplicado(
    supabase,
    current.organization_id,
    target.giro_id,
    input.name,
    input.sku,
    productId
  )
  if (duplicado) {
    if (duplicado.tipo === 'nombre') {
      return { error: `Ya existe un producto llamado "${duplicado.producto.name}" en este giro.` }
    }
    return { error: `El SKU "${duplicado.producto.sku}" ya está en uso por "${duplicado.producto.name}".` }
  }

  const { error } = await supabase
    .from('products')
    .update({
      sku: input.sku.trim() || null,
      name: input.name.trim(),
      price: input.price,
      cost: input.cost,
      stock_quantity: input.stockQuantity,
      unit: input.unit.trim() || 'pza',
      category: input.category.trim() || null,
      duration_minutes: input.durationMinutes,
    })
    .eq('id', productId)

  if (error) return { error: error.message }
  revalidatePath('/products')
  return { success: true }
}
export async function toggleProductActive(productId: string, active: boolean) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar el catálogo.' }

  const { data: target } = await supabase.from('products').select('organization_id').eq('id', productId).single()
  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese producto no pertenece a tu organización.' }
  }

  const { error } = await supabase.from('products').update({ is_active: active }).eq('id', productId)
  if (error) return { error: error.message }
  revalidatePath('/products')
  return { success: true }
}
