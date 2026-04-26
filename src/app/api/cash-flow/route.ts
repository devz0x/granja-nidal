import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth, verifyFarmAccess } from '@/lib/auth-api'
import { apiRateLimit } from '@/lib/rate-limit'
import { validateBody, cashFlowEntrySchema, cashFlowBatchSchema } from '@/lib/validators'

// GET /api/cash-flow?farm_id=xxx - Get all cash flow entries for a farm
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyFarmAccess(req.nextUrl.searchParams.get('farm_id') || '')
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cash_flow_entries')
    .select('*')
    .eq('farm_id', farmId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also fetch cash_flow_balances from the farms table
  const { data: farmData, error: farmError } = await supabase
    .from('farms')
    .select('cash_flow_balances')
    .eq('id', farmId)
    .single()

  const balances = (farmData?.cash_flow_balances as Record<string, number>) || {}

  return NextResponse.json({
    entries: (data || []).map((e: Record<string, unknown>) => ({
      id: e.entry_key || e.id,
      date: e.date,
      category: e.category,
      description: e.description,
      amount: Number(e.amount),
      type: e.type,
      reference: e.reference || '',
      createdAt: e.created_at,
    })),
    balances,
  })
}

// POST /api/cash-flow?farm_id=xxx - Create a new cash flow entry
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // SECURITY: Rate limiting
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = apiRateLimit(clientIp)
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const supabase = await createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const body = await req.json()

  // SECURITY FIX VULN-06: Zod validation
  if (Array.isArray(body)) {
    const validation = validateBody(cashFlowBatchSchema, body)
    if (validation.error) {
      return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
    }
  } else {
    const validation = validateBody(cashFlowEntrySchema, body)
    if (validation.error) {
      return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
    }
  }

  // Support both single entry and array of entries
  const entries = Array.isArray(body) ? body : [body]
  const results = []

  for (const entry of entries) {
    const { data, error } = await supabase
      .from('cash_flow_entries')
      .insert({
        farm_id: farmId,
        entry_key: entry.entry_key || entry.id || `cf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        date: entry.date,
        category: entry.category,
        description: entry.description || '',
        amount: entry.amount,
        type: entry.type,
        reference: entry.reference || '',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    results.push(data)
  }

  return NextResponse.json({ entries: results })
}

// PUT /api/cash-flow?farm_id=xxx - Update cash flow balances
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyFarmAccess(
    new URL(req.url).searchParams.get('farm_id') || ''
  )
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

  // Update balances
  if (body.balances !== undefined) {
    if (typeof body.balances !== 'object' || body.balances === null) {
      return NextResponse.json({ error: 'balances must be an object' }, { status: 400 })
    }
    const { error } = await supabase
      .from('farms')
      .update({ cash_flow_balances: body.balances })
      .eq('id', farmId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, balances: body.balances })
  }

  return NextResponse.json({ error: 'No valid update data provided' }, { status: 400 })
}

// DELETE /api/cash-flow?farm_id=xxx - Delete all cash flow entries for a farm
export async function DELETE(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyFarmAccess(
    new URL(req.url).searchParams.get('farm_id') || ''
  )
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('cash_flow_entries')
    .delete()
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also clear balances
  await supabase
    .from('farms')
    .update({ cash_flow_balances: {} })
    .eq('id', farmId)

  return NextResponse.json({ success: true })
}
