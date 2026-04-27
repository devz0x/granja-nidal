import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// PUT /api/feed-inventory/[id]?farm_id=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('feed_inventory')
    .update({
      phase_key: body.phase_key,
      phase: body.phase,
      current_stock_kg: body.current_stock_kg ?? 0,
      reorder_level_kg: body.reorder_level_kg ?? 0,
      last_purchase: body.last_purchase || null,
      supplier: body.supplier || '',
      price_per_quintal: body.price_per_quintal || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Inventario no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ item: data })
}

// DELETE /api/feed-inventory/[id]?farm_id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('feed_inventory')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
