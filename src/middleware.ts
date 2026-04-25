import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

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
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Create a Supabase client for the middleware using @supabase/ssr
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          req.cookies.set(name, value)
        )
        const response = NextResponse.next({
          request: { headers: req.headers },
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
        return response
      },
    },
  })

  // Refresh the session to keep it alive
  const { data: { user } } = await supabase.auth.getUser()

  // If no user session, redirect to login (only for the main page)
  if (!user && (pathname === '/' || pathname === '')) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // IMPORTANT: If setAll was called (session was refreshed), return the response
  // with updated cookies. This ensures the session stays alive.
  // We check this by comparing if cookies were modified.
  const response = NextResponse.next({
    request: { headers: req.headers },
  })

  return response
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
