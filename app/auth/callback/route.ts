import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: appUser } = await supabase
          .from('app_users')
          .select('organization_id')
          .eq('id', user.id)
          .single()

        if (appUser?.organization_id) {
          const { data: fiscalProfile } = await supabase
            .from('fiscal_profiles')
            .select('rfc')
            .eq('organization_id', appUser.organization_id)
            .maybeSingle()

          if (!fiscalProfile) {
            return NextResponse.redirect(`${origin}/bienvenida`)
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}