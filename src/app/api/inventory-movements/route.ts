import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'
import { apiRateLimit } from '@/lib/rate-limit'

// GET /api/inventory-movements — list movements with filters
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = apiRateLimit(clientIp)
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 })
  }

  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error

  const supabase = await createServerSupabaseClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const movementType = searchParams.get('movement_type')
  const phaseKey = searchParams.get('phase_key')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = parseInt(searchParams.get('limit') || '100')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  let query = supabase
    .from('inventory_movements')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (movementType && movementType !== 'all') {
    query = query.eq('movement_type', movementType)
  }
  if (phaseKey && phaseKey !== 'all') {
    query = query.eq('phase_key', phaseKey)
  }
  if (dateFrom) {
    query = query.gte('created_at', dateFrom)
  }
  if (dateTo) {
    query = query.lte('created_at', dateTo + 'T23:59:59')
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ movements: data || [] })
}

// POST /api/inventory-movements — create a new movement
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error

  const supabase = await createServerSupabaseClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const body = await req.json()

  // Support batch creation
  if (Array.isArray(body.movements)) {
    const items = body.movements.map((m: Record<string, unknown>) => ({
      farm_id: farmId,
      phase_key: m.phase_key,
      movement_type: m.movement_type,
      quantity_kg: parseFloat(m.quantity_kg) || 0,
      unit_price: parseFloat(m.unit_price) || 0,
      supplier: m.supplier || '',
      reference: m.reference || '',
      notes: m.notes || '',
    }))

    const { data, error } = await supabase
      .from('inventory_movements')
      .insert(items)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Also update the feed_inventory stock
    await updateFeedStock(supabase, farmId, items)

    return NextResponse.json({ movements: data })
  }

  // Single movement
  const item = {
    farm_id: farmId,
    phase_key: body.phase_key,
    movement_type: body.movement_type,
    quantity_kg: parseFloat(body.quantity_kg) || 0,
    unit_price: parseFloat(body.unit_price) || 0,
    supplier: body.supplier || '',
    reference: body.reference || '',
    notes: body.notes || '',
  }

  const { data, error } = await supabase
    .from('inventory_movements')
    .insert(item)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update feed_inventory stock
  await updateFeedStock(supabase, farmId, [item])

  return NextResponse.json({ movement: data })
}

// Helper: update feed_inventory stock based on movement
async function updateFeedStock(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  farmId: string,
  movements: Array<{ phase_key: string; movement_type: string; quantity_kg: number }>
) {
  for (const movement of movements) {
    if (!movement.phase_key) continue

    // Get current stock
    const { data: current } = await supabase
      .from('feed_inventory')
      .select('current_stock_kg')
      .eq('farm_id', farmId)
      .eq('phase_key', movement.phase_key)
      .single()

    if (!current) continue

    let newStock = current.current_stock_kg || 0
    if (movement.movement_type === 'entrada') {
      newStock += movement.quantity_kg
    } else if (movement.movement_type === 'salida' || movement.movement_type === 'ajuste') {
      newStock -= movement.quantity_kg
    }
    if (newStock < 0) newStock = 0

    await supabase
      .from('feed_inventory')
      .update({ current_stock_kg: newStock })
      .eq('farm_id', farmId)
      .eq('phase_key', movement.phase_key)
  }
}
