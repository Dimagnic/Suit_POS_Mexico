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

export async function getSuppliers() {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }

  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, contact_name, phone, email, notes, is_active')
    .eq('organization_id', current.organization_id)
    .order('name')

  if (error) return { error: error.message }
  return { suppliers: data, currentRole: current.role as Role }
}

type SupplierInput = {
  name: string
  contactName: string
  phone: string
  email: string
  notes: string
}

export async function createSupplier(input: SupplierInput) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar proveedores.' }

  if (!input.name.trim()) return { error: 'El nombre es obligatorio.' }

  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      organization_id: current.organization_id,
      name: input.name.trim(),
      contact_name: input.contactName.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      notes: input.notes.trim() || null,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true, id: data.id }
}

export async function updateSupplier(supplierId: string, input: SupplierInput) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar proveedores.' }

  const { data: target } = await supabase.from('suppliers').select('organization_id').eq('id', supplierId).single()
  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese proveedor no pertenece a tu organización.' }
  }

  const { error } = await supabase
    .from('suppliers')
    .update({
      name: input.name.trim(),
      contact_name: input.contactName.trim() || null,
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      notes: input.notes.trim() || null,
    })
    .eq('id', supplierId)

  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true }
}

export async function toggleSupplierActive(supplierId: string, active: boolean) {
  const supabase = await createClient()
  const current = await getCurrentUser()
  if (!current) return { error: 'No autenticado' }
  if (!canEditCatalog(current.role as Role)) return { error: 'No tienes permiso para editar proveedores.' }

  const { data: target } = await supabase.from('suppliers').select('organization_id').eq('id', supplierId).single()
  if (!target || target.organization_id !== current.organization_id) {
    return { error: 'Ese proveedor no pertenece a tu organización.' }
  }

  const { error } = await supabase.from('suppliers').update({ is_active: active }).eq('id', supplierId)
  if (error) return { error: error.message }
  revalidatePath('/suppliers')
  return { success: true }
}
