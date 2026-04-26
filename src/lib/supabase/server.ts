import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const _isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

export const isSupabaseConfigured = (): boolean => _isConfigured

/** The canonical farm ID for Granja Nidal (single-farm mode) */
const GRANJA_NIDAL_FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || '51872fc1-ef45-4a7a-a79c-596c987318ff'

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

/**
 * Ensure the canonical Granja Nidal farm exists in the `farms` table.
 * If it doesn't exist, create it. If it exists but has no owner, set the owner.
 * Uses the service_role client to bypass RLS.
 * This is called before data operations to avoid foreign key constraint errors.
 */
export const ensureFarmExists = async (userId?: string): Promise<void> => {
  const supabase = createServiceRoleClient()
  const farmId = GRANJA_NIDAL_FARM_ID

  // Check if farm exists
  const { data: existingFarm } = await supabase
    .from('farms')
    .select('id')
    .eq('id', farmId)
    .single()

  if (existingFarm) {
    // Farm exists — update owner if userId provided and farm has no owner
    if (userId) {
      await supabase
        .from('farms')
        .update({ user_id: userId })
        .eq('id', farmId)
        .is('user_id', null)
    }
    return
  }

  // Farm doesn't exist — create it
  await supabase.from('farms').insert({
    id: farmId,
    name: 'Granja Nidal',
    slug: 'granja-nidal',
    user_id: userId || null,
    config: {},
  })
  console.log(`[ensureFarm] Created farm ${farmId}`)
}
