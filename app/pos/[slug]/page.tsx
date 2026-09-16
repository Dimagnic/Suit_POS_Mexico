import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import PosClient from './pos-client'

export default async function PosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: appUser } = await supabase
    .from('app_users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!appUser) redirect('/login')

  const { data: giro } = await supabase
    .from('giros')
    .select('id, slug, nombre, icono')
    .eq('slug', slug)
    .single()

  if (!giro) notFound()

  const { data: orgGiro } = await supabase
    .from('organization_giros')
    .select('id')
    .eq('organization_id', appUser.organization_id)
    .eq('giro_id', giro.id)
    .eq('status', 'active')
    .single()

  if (!orgGiro) redirect('/')

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, price, stock_quantity, unit, category')
    .eq('organization_id', appUser.organization_id)
    .eq('giro_id', giro.id)
    .eq('is_active', true)
    .order('name')

  const { data: branch } = await supabase
    .from('branches')
    .select('id')
    .eq('organization_id', appUser.organization_id)
    .eq('is_main', true)
    .single()

  return (
    <PosClient
      giro={giro}
      products={products ?? []}
      organizationId={appUser.organization_id}
      branchId={branch?.id ?? ''}
      cashierId={user.id}
    />
  )
}