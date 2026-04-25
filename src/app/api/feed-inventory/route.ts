import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// GET /api/feed-inventory
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('feed_inventory')
    .select('*')
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ inventory: data || [] })
}

// POST /api/feed-inventory
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()

  // Support batch upsert
  if (Array.isArray(body.items)) {
    const items = body.items.map((item: Record<string, unknown>) => ({
      farm_id: farmId,
      phase_key: item.phase_key,
      phase: item.phase,
      current_stock_kg: item.current_stock_kg || 0,
      reorder_level_kg: item.reorder_level_kg || 0,
      last_purchase: item.last_purchase || null,
      supplier: item.supplier || '',
      price_per_quintal: item.price_per_quintal || 0,
    }))

    const { data, error } = await supabase
      .from('feed_inventory')
      .upsert(items, { onConflict: 'farm_id,phase_key' })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ inventory: data })
  }

  const { data, error } = await supabase
    .from('feed_inventory')
    .upsert({
      farm_id: farmId,
      phase_key: body.phase_key,
      phase: body.phase,
      current_stock_kg: body.current_stock_kg || 0,
      reorder_level_kg: body.reorder_level_kg || 0,
      last_purchase: body.last_purchase || null,
      supplier: body.supplier || '',
      price_per_quintal: body.price_per_quintal || 0,
    }, { onConflict: 'farm_id,phase_key' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}
