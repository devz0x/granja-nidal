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

  // Always allow auth routes (login, signup, change-password, callback)
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
  const { supabase, response } = createMiddlewareSupabaseClient(req)

  // Refresh the session to keep it alive
  const { data: { user } } = await supabase.auth.getUser()

  // If no user session, redirect to login (only for the main page)
  if (!user && (pathname === '/' || pathname === '')) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // If user is authenticated, check if they must change their password
  if (user && (pathname === '/' || pathname === '')) {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('must_change_password')
        .eq('user_id', user.id)
        .single()

      if (roleData?.must_change_password) {
        const changePwdUrl = new URL('/auth/change-password', req.url)
        return NextResponse.redirect(changePwdUrl)
      }
    } catch {
      // If user_roles table doesn't exist yet or query fails, let them through
    }
  }

  return response
}

/**
 * Creates a Supabase client for middleware with proper cookie handling.
 * Returns both the client and a NextResponse with any updated cookies.
 */
function createMiddlewareSupabaseClient(req: NextRequest) {
  let cookieModified = false
  const res = NextResponse.next({
    request: { headers: req.headers },
  })

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookieModified = true
        cookiesToSet.forEach(({ name, value }) =>
          req.cookies.set(name, value)
        )
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        )
      },
    },
  })

  return { supabase, response: res }
}

// Cache env reads
const _supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const _supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
function supabaseUrl() { return _supabaseUrl }
function supabaseAnonKey() { return _supabaseAnonKey }

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
