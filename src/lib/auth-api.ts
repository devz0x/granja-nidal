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
