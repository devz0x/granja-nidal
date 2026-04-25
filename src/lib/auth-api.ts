import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthResult {
  user: User | null
  error: NextResponse | null
}

/**
 * Verify the current user's session from the request.
 * Uses Supabase's getSession() which reads cookies set by the client.
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: null } // Allow in local-only mode
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()

    if (!session || !session.user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'No autenticado. Inicia sesión para continuar.' },
          { status: 401 }
        ),
      }
    }

    return { user: session.user, error: null }
  } catch {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Error de verificación de autenticación.' },
        { status: 500 }
      ),
    }
  }
}
