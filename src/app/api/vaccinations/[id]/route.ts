import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// PUT /api/vaccinations/[id]?farm_id=xxx
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
    .from('vaccinations')
    .update({
      batch_id: body.batch_id ?? null,
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Vacunacion no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ vaccination: data })
}

// DELETE /api/vaccinations/[id]?farm_id=xxx
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
    .from('vaccinations')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
