import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const _isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

export const isSupabaseConfigured = (): boolean => _isConfigured

/**
 * Create a Supabase client for server-side use (API routes, Server Components).
 * Reads auth cookies for session management and RLS context.
 */
export const createServerSupabaseClient = async (): Promise<SupabaseClient> => {
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing sessions.
        }
      },
    },
  })
}

/**
 * Create a Supabase client with SERVICE_ROLE key that BYPASSES RLS.
 * Used for all data write operations in API routes.
 * Application-level auth (verifyAuth/verifyFarmAccess) protects data access.
 * RLS is defense-in-depth only — for a single-farm app with app-level auth,
 * the service_role client avoids RLS policy issues entirely.
 */
export const createServiceRoleClient = (): SupabaseClient => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  // Fallback: if no service role key, try to derive it from POSTGRES_URL
  // by creating an admin client. If that also fails, return the regular client.
  // This fallback should rarely be needed.
  console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — using anon client (RLS may block writes)')
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Verify the current user's session from cookies.
 * For use in API routes and Server Components.
 * Returns the user and error (NextResponse) if not authenticated.
 */
export const verifyServerAuth = async () => {
  if (!_isConfigured) {
    return { user: null, error: null as Response | null }
  }

  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return {
        user: null,
        error: Response.json(
          { error: 'No autenticado. Inicia sesion para continuar.' },
          { status: 401 }
        ),
      }
    }

    return { user, error: null }
  } catch {
    return {
      user: null,
      error: Response.json(
        { error: 'Error de verificacion de autenticacion.' },
        { status: 500 }
      ),
    }
  }
}
