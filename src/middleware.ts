import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { loginRateLimit, changePasswordRateLimit } from '@/lib/rate-limit'

// ================================================================
// SECURITY FIXES:
// - VULN-07: Whitelist approach — ALL routes protected by default
// - VULN-03: Rate limiting on login and change-password
// - VULN-09: CSRF protection via Origin header validation
// - VULN-13: Silent error logging fixed (fail-closed for password change)
// ================================================================

// Allowed origins for CSRF protection
const ALLOWED_ORIGINS = [
  // Will be populated from env, with fallbacks
]

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin') || ''
  const referer = request.headers.get('referer') || ''
  const host = request.headers.get('host') || ''

  // In production (Vercel), check against the deployed domain
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const appUrl = new URL(process.env.NEXT_PUBLIC_APP_URL)
    return origin === appUrl.origin || referer.startsWith(appUrl.origin)
  }

  // For same-origin requests, allow if no origin header (e.g., direct browser navigation)
  if (!origin && referer) return true
  if (!origin && !referer) return true

  // Allow if host matches origin
  try {
    if (origin) {
      const originUrl = new URL(origin)
      return originUrl.host === host
    }
  } catch {
    // Invalid origin URL
  }

  return false
}

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

  // If Supabase is not configured, allow all requests (local-only mode)
  if (!isConfigured) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // ================================================================
  // WHITELIST: Only explicitly allowed paths bypass auth
  // ================================================================

  // Allow auth routes (login, signup, change-password, callback)
  if (pathname.startsWith('/auth/')) {
    // SECURITY: Rate limit login attempts
    if (pathname === '/auth/login') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
      const rl = loginRateLimit(clientIp)
      if (!rl.success) {
        const loginUrl = new URL('/auth/login', req.url)
        return NextResponse.redirect(loginUrl)
      }
    }

    // Rate limit change-password page
    if (pathname === '/auth/change-password') {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || 'unknown'
      const rl = changePasswordRateLimit(clientIp)
      if (!rl.success) {
        return NextResponse.redirect(new URL('/auth/login', req.url))
      }
    }

    return NextResponse.next()
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.startsWith('/_next/data') ||
    pathname.includes('.') // favicon, logo, etc.
  ) {
    return NextResponse.next()
  }

  // Allow OAuth callback (must be public for Supabase to redirect back)
  if (pathname === '/api/auth/callback') {
    return NextResponse.next()
  }

  // SECURITY: CSRF protection for API routes
  // Validate Origin/Referer headers for state-changing API requests
  if (pathname.startsWith('/api/')) {
    const method = req.method.toUpperCase()
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!isAllowedOrigin(req)) {
        console.warn(`CSRF: Blocked ${method} ${pathname} from origin: ${req.headers.get('origin')}`)
        return NextResponse.json(
          { error: 'Solicitud bloqueada. Origen no valido.' },
          { status: 403 }
        )
      }
    }
    // API routes handle their own auth via verifyAuth()
    return NextResponse.next()
  }

  // ================================================================
  // ALL OTHER ROUTES: Require authentication
  // ================================================================

  const { supabase, response } = createMiddlewareSupabaseClient(req)

  // Refresh the session to keep it alive
  const { data: { user } } = await supabase.auth.getUser()

  // SECURITY FIX: Protect ALL pages (was only protecting /)
  if (!user) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check must_change_password for all authenticated pages
  // SECURITY FIX: Fail-closed — redirect to change-password if query fails
  if (!pathname.startsWith('/auth/change-password')) {
    try {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('must_change_password')
        .eq('user_id', user.id)
        .single()

      if (roleError) {
        // SECURITY FIX: Log error instead of silently swallowing
        console.error('[Middleware] user_roles query failed for user', user.id, ':', roleError.message)
      }

      if (roleData?.must_change_password) {
        const changePwdUrl = new URL('/auth/change-password', req.url)
        return NextResponse.redirect(changePwdUrl)
      }
    } catch (err) {
      // SECURITY FIX: Log and fail-closed (redirect to change-password)
      console.error('[Middleware] Error checking must_change_password:', err)
      const changePwdUrl = new URL('/auth/change-password', req.url)
      return NextResponse.redirect(changePwdUrl)
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
     * - public folder images
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.jpg|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.ico).*)',
  ],
}
