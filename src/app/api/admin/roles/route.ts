import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/admin/roles - List all user roles (superadmin only)
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const supabase = await createServerSupabaseClient()

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user?.id)
    .single()

  if (!roleData || roleData.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso denegado. Solo superadmins.' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role, assigned_by, created_at, updated_at')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ roles: data || [] })
}

// POST /api/admin/roles - Assign or update a user role (superadmin only)
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const supabase = await createServerSupabaseClient()

  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user?.id)
    .single()

  if (!roleData || roleData.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso denegado. Solo superadmins.' }, { status: 403 })
  }

  const body = await req.json()
  const { target_user_id, role } = body

  if (!target_user_id || !role) {
    return NextResponse.json({ error: 'target_user_id y role son requeridos.' }, { status: 400 })
  }
  if (!['superadmin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Rol invalido. Use superadmin o user.' }, { status: 400 })
  }
  if (target_user_id === user?.id && role !== 'superadmin') {
    return NextResponse.json({ error: 'No puedes remover tu propio rol de superadmin.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('user_roles')
    .upsert(
      { user_id: target_user_id, role, assigned_by: user?.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ role: data })
}
