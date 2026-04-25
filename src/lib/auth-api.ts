import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase'
import { verifyServerAuth } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

interface AuthResult {
  user: User | null
  error: NextResponse | null
}

/**
 * Verify the current user's session from cookies.
 * Uses the server-side Supabase client (@supabase/ssr) for reliable cookie handling.
 * Compatible with existing API route signatures.
 */
export async function verifyAuth(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: null } // Allow in local-only mode
  }

  const result = await verifyServerAuth()

  // Convert Response to NextResponse for compatibility
  if (result.error) {
    const errorResponse = new NextResponse(result.error.body, {
      status: result.error.status,
      headers: result.error.headers,
    })
    return { user: null, error: errorResponse }
  }

  return { user: result.user, error: null }
}
