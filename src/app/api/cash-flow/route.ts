import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/cash-flow?farm_id=xxx - Get all cash flow entries for a farm
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyAuth()
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

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

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
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

  // Update balances
  if (body.balances !== undefined) {
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
  const { error: authError } = await verifyAuth()
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
