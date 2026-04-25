import { NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

/**
 * POST /api/admin/ensure-role
 *
 * Ensures the authenticated user has a role assigned.
 * If no roles exist at all, assigns superadmin to this user.
 * Otherwise, assigns 'user' role if they don't have one yet.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Supabase not configured' })
  }

  const { user, error: authError } = await verifyAuth()
  if (authError) return authError
  if (!user) return NextResponse.json({ skipped: true, reason: 'Not authenticated' })

  const supabase = await createServerSupabaseClient()

  // Check if this user already has a role
  const { data: existingRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (existingRole) {
    return NextResponse.json({ skipped: true, reason: 'Role already exists', role: existingRole.role })
  }

  // Check if ANY roles exist
  const { count } = await supabase
    .from('user_roles')
    .select('*', { count: 'exact', head: true })

  // First user gets superadmin, others get 'user'
  const role = (count || 0) === 0 ? 'superadmin' : 'user'

  const { error } = await supabase
    .from('user_roles')
    .insert({ user_id: user.id, role, assigned_by: user.id })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, role, email: user.email })
}
