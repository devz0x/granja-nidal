import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

  // If Supabase is not configured, allow all requests (local-only mode)
  if (!isConfigured) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Always allow auth routes
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Always allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') // static files
  ) {
    return NextResponse.next()
  }

  // For protected routes, check for a valid session
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Get the access token from the request
  const authHeader = req.headers.get('authorization')
  let accessToken = authHeader?.replace('Bearer ', '')

  // For page navigation, check cookies
  if (!accessToken) {
    // Try to get session from cookie
    const { data } = await supabase.auth.getSession()
    accessToken = data.session?.access_token
  }

  // If no session, redirect to login (but only for the main page)
  if (!accessToken && (pathname === '/' || pathname === '')) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico).*)',
  ],
}
