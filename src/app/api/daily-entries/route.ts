import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, dailyEntrySchema, dailyEntryBatchSchema } from '@/lib/validators'

// GET /api/daily-entries - with filters
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  // SECURITY FIX VULN-15: Verify farm access
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const { error: authError } = await verifyFarmAccess(farmId || '')
  if (authError) return authError

  const batchId = searchParams.get('batch_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000) // Cap at 1000

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
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
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  // Verify authentication and farm access
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()

  // SECURITY FIX VULN-06: Zod validation
  // Support batch insert (array of entries)
  if (Array.isArray(body.entries)) {
    const validation = validateBody(dailyEntryBatchSchema, body)
    if (validation.error) {
      return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
    }

    const entries = validation.data!.entries.map((e) => ({
      farm_id: farmId,
      batch_id: e.batch_id,
      date: e.date,
      eggs_collected: e.eggs_collected,
      eggs_broken: e.eggs_broken,
      mortality: e.mortality,
      feed_kg: e.feed_kg,
      water_liters: e.water_liters,
      notes: e.notes,
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

  // Single entry validation
  const validation = validateBody(dailyEntrySchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const entry = validation.data!
  const { data, error } = await supabase
    .from('daily_entries')
    .upsert({
      farm_id: farmId,
      batch_id: entry.batch_id,
      date: entry.date,
      eggs_collected: entry.eggs_collected,
      eggs_broken: entry.eggs_broken,
      mortality: entry.mortality,
      feed_kg: entry.feed_kg,
      water_liters: entry.water_liters,
      notes: entry.notes,
    }, { onConflict: 'farm_id,batch_id,date' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}
