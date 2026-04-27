import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess, verifyAuth } from '@/lib/auth-api'
import { validateBody, shedLogSchema } from '@/lib/validators'

// PUT /api/shed-logs/[id]?farm_id=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()
  const validation = validateBody(shedLogSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const logData = validation.data!
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('shed_logs')
    .update({
      batch_id: logData.batch_id || null,
      activity_type: logData.activity_type,
      description: logData.description,
      cost: logData.cost,
      performed_by: logData.performed_by,
      performed_at: logData.performed_at,
      notes: logData.notes || '',
      photos: logData.photos || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', farmId)
    .select()
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
  }

  return NextResponse.json({ shed_log: data })
}

// DELETE /api/shed-logs/[id]?farm_id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { error: authError } = await verifyAuth()
  if (authError) return authError

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
    .from('shed_logs')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
