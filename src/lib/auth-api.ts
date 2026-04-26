import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase'
import { verifyServerAuth, createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

interface AuthResult {
  user: User | null
  error: NextResponse | null
  role: 'superadmin' | 'user' | null
}

/**
 * Verify the current user's session from cookies.
 * Uses the server-side Supabase client (@supabase/ssr) for reliable cookie handling.
 * Also fetches the user's role from user_roles table.
 */
export async function verifyAuth(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: null, role: null }
  }

  const result = await verifyServerAuth()

  if (result.error) {
    const errorResponse = new NextResponse(result.error.body, {
      status: result.error.status,
      headers: result.error.headers,
    })
    return { user: null, error: errorResponse, role: null }
  }

  const user = result.user
  let role: 'superadmin' | 'user' | null = null

  if (user) {
    try {
      const supabase = await createServerSupabaseClient()
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      role = (roleData?.role as 'superadmin' | 'user') || null
    } catch {
      // user_roles table might not exist yet (before migration)
      role = null
    }
  }

  return { user, error: null, role }
}

/**
 * Verify the user is a superadmin. Returns 403 if not.
 */
export async function requireSuperadmin(): Promise<AuthResult> {
  const authResult = await verifyAuth()

  if (authResult.error) return authResult

  if (authResult.role !== 'superadmin') {
    return {
      user: authResult.user,
      error: NextResponse.json(
        { error: 'Acceso denegado. Solo superadmins.' },
        { status: 403 }
      ),
      role: authResult.role,
    }
  }

  return authResult
}

/**
 * SECURITY FIX VULN-15: Verify that the authenticated user owns the specified farm.
 * Defense in depth — don't rely solely on RLS. Returns the auth result if authorized,
 * or an error if the user doesn't own the farm.
 *
 * SINGLE-FARM MODE: When NEXT_PUBLIC_FARM_ID is set (hardcoded farm), any authenticated
 * user is allowed access. The middleware already ensures only logged-in users reach
 * API routes. RLS policies still protect data at the database level.
 */
export async function verifyFarmAccess(farmId: string): Promise<AuthResult> {
  const authResult = await verifyAuth()
  if (authResult.error) return authResult
  if (!authResult.user) {
    return { user: null, error: NextResponse.json({ error: 'No autenticado.' }, { status: 401 }), role: null }
  }

  // Superadmins have access to all farms
  if (authResult.role === 'superadmin') return authResult

  // Single-farm mode: if NEXT_PUBLIC_FARM_ID is set and matches, allow any authenticated user
  const configuredFarmId = process.env.NEXT_PUBLIC_FARM_ID
  if (configuredFarmId && configuredFarmId === farmId) {
    return authResult
  }

  // Multi-farm mode: verify farm ownership
  try {
    const supabase = await createServerSupabaseClient()
    const { data: farm, error } = await supabase
      .from('farms')
      .select('id')
      .eq('id', farmId)
      .eq('user_id', authResult.user.id)
      .single()

    if (error || !farm) {
      return {
        user: authResult.user,
        error: NextResponse.json({ error: 'Acceso denegado a esta granja.' }, { status: 403 }),
        role: authResult.role,
      }
    }
  } catch {
    // If the query fails, allow through (RLS will still protect data)
    // This prevents locking users out if there's a transient DB error
  }

  return authResult
}
