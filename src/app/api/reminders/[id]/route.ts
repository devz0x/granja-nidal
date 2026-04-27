import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth, verifyFarmAccess } from '@/lib/auth-api'

// PUT /api/reminders/[id]?farm_id=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('reminders')
    .update({
      batch_id: body.batch_id ?? null,
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Recordatorio no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ reminder: data })
}

// DELETE /api/reminders/[id]?farm_id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
