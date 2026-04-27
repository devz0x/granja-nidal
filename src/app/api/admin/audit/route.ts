import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/admin/audit - Query audit log (superadmin only)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const supabase = createServiceRoleClient()

  // Only superadmins can view audit log
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user?.id)
    .single()

  if (!roleData || roleData.role !== 'superadmin') {
    return NextResponse.json({ error: 'Acceso denegado. Solo superadmins.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const operation = searchParams.get('operation')
  const userId = searchParams.get('user_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 1000)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')

  let query = supabase
    .from('audit_log')
    .select('id, table_name, operation, record_id, old_data, new_data, changed_fields, user_id, user_email, user_role, created_at')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (table) query = query.eq('table_name', table)
  if (operation) query = query.eq('operation', operation)
  if (userId) query = query.eq('user_id', userId)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo) query = query.lte('created_at', dateTo)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    entries: data || [],
    count,
    limit,
    offset,
  })
}
