import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/daily-entries - with filters
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const batchId = searchParams.get('batch_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = parseInt(searchParams.get('limit') || '100')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  let query = supabase
    .from('daily_entries')
    .select('*')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .limit(limit)

  if (batchId) {
    query = query.eq('batch_id', batchId)
  }
  if (dateFrom) {
    query = query.gte('date', dateFrom)
  }
  if (dateTo) {
    query = query.lte('date', dateTo)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entries: data || [] })
}

// POST /api/daily-entries
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

  // Support batch insert (array of entries)
  if (Array.isArray(body.entries)) {
    const entries = body.entries.map((e: Record<string, unknown>) => ({
      farm_id: farmId,
      batch_id: e.batch_id,
      date: e.date,
      eggs_collected: e.eggs_collected || 0,
      eggs_broken: e.eggs_broken || 0,
      mortality: e.mortality || 0,
      feed_kg: e.feed_kg || 0,
      water_liters: e.water_liters || 0,
      notes: e.notes || '',
    }))

    const { data, error } = await supabase
      .from('daily_entries')
      .upsert(entries, { onConflict: 'farm_id,batch_id,date' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ entries: data })
  }

  // Single entry
  const { data, error } = await supabase
    .from('daily_entries')
    .upsert({
      farm_id: farmId,
      batch_id: body.batch_id,
      date: body.date,
      eggs_collected: body.eggs_collected || 0,
      eggs_broken: body.eggs_broken || 0,
      mortality: body.mortality || 0,
      feed_kg: body.feed_kg || 0,
      water_liters: body.water_liters || 0,
      notes: body.notes || '',
    }, { onConflict: 'farm_id,batch_id,date' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}
