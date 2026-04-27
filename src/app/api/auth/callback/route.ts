import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  const supabase = await createServerSupabaseClient()

  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // SECURITY: Only allow relative paths to prevent open redirect
      const safePath = next.startsWith('/') && !next.startsWith('//') ? next : '/'
      return NextResponse.redirect(`${origin}${safePath}`)
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
