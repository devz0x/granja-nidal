import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess, verifyAuth } from '@/lib/auth-api'
import { validateBody, shedLogSchema } from '@/lib/validators'

// GET /api/shed-logs?farm_id=xxx&batch_id=xxx&activity_type=xxx&date_from=xxx&date_to=xxx
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const batchId = searchParams.get('batch_id')
  const activityType = searchParams.get('activity_type')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  let query = supabase
    .from('shed_logs')
    .select('*, batches!shed_logs_batch_id_fkey(name)')
    .eq('farm_id', farmId)
    .order('performed_at', { ascending: false })
    .limit(limit)

  if (batchId) query = query.eq('batch_id', batchId)
  if (activityType) query = query.eq('activity_type', activityType)
  if (dateFrom) query = query.gte('performed_at', dateFrom)
  if (dateTo) query = query.lte('performed_at', dateTo)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const mapped = (data || []).map((row: Record<string, unknown>) => ({
    id: row.id,
    farm_id: row.farm_id,
    batch_id: row.batch_id,
    batch_name: (row.batches as Record<string, unknown>)?.name || '',
    activity_type: row.activity_type,
    description: row.description,
    cost: Number(row.cost),
    performed_by: row.performed_by,
    performed_at: row.performed_at,
    notes: row.notes,
    photos: row.photos || [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  }))

  return NextResponse.json({ shed_logs: mapped })
}

// POST /api/shed-logs?farm_id=xxx
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()
  const validation = validateBody(shedLogSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const logData = validation.data!
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('shed_logs')
    .insert({
      farm_id: farmId,
      batch_id: logData.batch_id || null,
      activity_type: logData.activity_type,
      description: logData.description,
      cost: logData.cost,
      performed_by: logData.performed_by,
      performed_at: logData.performed_at,
      notes: logData.notes || '',
      photos: logData.photos || [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shed_log: data }, { status: 201 })
}
