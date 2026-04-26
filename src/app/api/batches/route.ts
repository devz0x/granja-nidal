import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth, verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, batchCreateSchema } from '@/lib/validators'

// GET /api/batches - Get all batches for a farm
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  // SECURITY FIX VULN-15: Verify farm access
  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('farm_id', farmId)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ batches: data || [] })
}

// PUT /api/batches - Upsert a batch by batch_key (create or update in one call)
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()

  // verifyFarmAccess already calls verifyAuth internally, so no need for double check
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()

  const validation = validateBody(batchCreateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('batches')
    .upsert({
      farm_id: farmId,
      batch_key: validation.data!.batch_key || `batch-${Date.now()}`,
      name: validation.data!.name,
      hens: validation.data!.hens,
      laying_rate: validation.data!.laying_rate,
      is_laying: validation.data!.is_laying,
      cycle_month: validation.data!.cycle_month,
      phase: validation.data!.phase,
      sort_order: validation.data!.sort_order,
    }, { onConflict: 'farm_id,batch_key' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ batch: data })
}

// POST /api/batches - Create a new batch
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()

  // Verify authentication
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  // SECURITY FIX VULN-15: Verify farm access
  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()

  // SECURITY FIX VULN-06: Zod validation
  const validation = validateBody(batchCreateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('batches')
    .insert({
      farm_id: farmId,
      batch_key: validation.data!.batch_key || `batch-${Date.now()}`,
      name: validation.data!.name,
      hens: validation.data!.hens,
      laying_rate: validation.data!.laying_rate,
      is_laying: validation.data!.is_laying,
      cycle_month: validation.data!.cycle_month,
      phase: validation.data!.phase,
      sort_order: validation.data!.sort_order,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ batch: data })
}
