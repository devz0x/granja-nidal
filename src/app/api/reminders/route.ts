import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/reminders - with filters
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  // Verify authentication
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const batchId = searchParams.get('batch_id')
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const priority = searchParams.get('priority')
  const autoSource = searchParams.get('auto_source')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('reminders')
    .select('*')
    .eq('farm_id', farmId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (batchId) {
    query = query.eq('batch_id', batchId)
  }
  if (status) {
    query = query.eq('status', status)
  }
  if (category) {
    query = query.eq('category', category)
  }
  if (priority) {
    query = query.eq('priority', priority)
  }
  if (autoSource === 'null') {
    query = query.is('auto_source', null)
  } else if (autoSource) {
    query = query.eq('auto_source', autoSource)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reminders: data || [] })
}

// POST /api/reminders
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  // Verify authentication
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

  // Support batch insert
  if (Array.isArray(body.reminders)) {
    const reminders = body.reminders.map((r: Record<string, unknown>) => ({
      farm_id: farmId,
      batch_id: r.batch_id || null,
      title: r.title,
      description: r.description || '',
      category: r.category || 'otros',
      priority: r.priority || 'media',
      status: r.status || 'pendiente',
      due_date: r.due_date || null,
      due_time: r.due_time || '08:00',
      recurrence: r.recurrence || 'unica',
      recurrence_end: r.recurrence_end || null,
      completed_at: r.completed_at || null,
      notes: r.notes || '',
      estimated_cost: r.estimated_cost || 0,
      assigned_to: r.assigned_to || '',
      auto_source: r.auto_source || null,
    }))

    const { data, error } = await supabase
      .from('reminders')
      .insert(reminders)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reminders: data })
  }

  // Single reminder
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      farm_id: farmId,
      batch_id: body.batch_id || null,
      title: body.title,
      description: body.description || '',
      category: body.category || 'otros',
      priority: body.priority || 'media',
      status: body.status || 'pendiente',
      due_date: body.due_date || null,
      due_time: body.due_time || '08:00',
      recurrence: body.recurrence || 'unica',
      recurrence_end: body.recurrence_end || null,
      completed_at: body.completed_at || null,
      notes: body.notes || '',
      estimated_cost: body.estimated_cost || 0,
      assigned_to: body.assigned_to || '',
      auto_source: body.auto_source || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reminder: data })
}
