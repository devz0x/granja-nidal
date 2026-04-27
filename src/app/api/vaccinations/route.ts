import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// GET /api/vaccinations
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const batchId = searchParams.get('batch_id')
  const status = searchParams.get('status')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  // SECURITY: Verify farm access
  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  let query = supabase
    .from('vaccinations')
    .select('*')
    .eq('farm_id', farmId)
    .order('age_weeks', { ascending: true })

  if (batchId) {
    query = query.eq('batch_id', batchId)
  }
  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vaccinations: data || [] })
}

// POST /api/vaccinations
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  // SECURITY: Verify farm access
  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const body = await req.json()

  // Support batch insert
  if (Array.isArray(body.vaccinations)) {
    const vaccinations = body.vaccinations.map((v: Record<string, unknown>) => ({
      farm_id: farmId,
      batch_id: v.batch_id,
      shed_id: v.shed_id || '',
      cycle_number: v.cycle_number || 1,
      vaccine_name: v.vaccine_name,
      date_applied: v.date_applied || null,
      age_weeks: v.age_weeks || 0,
      next_dose: v.next_dose || null,
      applied_by: v.applied_by || '',
      via: v.via || 'Ocular',
      dosage: v.dosage || '',
      lot_number: v.lot_number || '',
      status: v.status || 'programada',
      notes: v.notes || '',
    }))

    const { data, error } = await supabase
      .from('vaccinations')
      .insert(vaccinations)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ vaccinations: data })
  }

  const { data, error } = await supabase
    .from('vaccinations')
    .insert({
      farm_id: farmId,
      batch_id: body.batch_id,
      shed_id: body.shed_id || '',
      cycle_number: body.cycle_number || 1,
      vaccine_name: body.vaccine_name,
      date_applied: body.date_applied || null,
      age_weeks: body.age_weeks || 0,
      next_dose: body.next_dose || null,
      applied_by: body.applied_by || '',
      via: body.via || 'Ocular',
      dosage: body.dosage || '',
      lot_number: body.lot_number || '',
      status: body.status || 'programada',
      notes: body.notes || '',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vaccination: data })
}
