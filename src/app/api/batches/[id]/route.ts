import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, batchCreateSchema } from '@/lib/validators'

// GET /api/batches/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params

  // First get the batch to find its farm_id, then verify access
  const supabase = createServiceRoleClient()
  const { data: batchData, error: fetchError } = await supabase
    .from('batches')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (fetchError || !batchData) {
    return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
  }

  const { error: authError } = await verifyFarmAccess(batchData.farm_id as string)
  if (authError) return authError

  const { data, error } = await supabase
    .from('batches')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 })
  }

  return NextResponse.json({ batch: data })
}

// PUT /api/batches/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const supabase = createServiceRoleClient()

  // First get the batch to find its farm_id, then verify access
  const { data: existingBatch, error: fetchError } = await supabase
    .from('batches')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (fetchError || !existingBatch) {
    return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
  }

  const { error: authError } = await verifyFarmAccess(existingBatch.farm_id as string)
  if (authError) return authError

  const body = await req.json()

  // SECURITY: Explicit field allowlist to prevent mass assignment
  const validation = validateBody(batchCreateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const allowedFields: Record<string, unknown> = {}
  const fields = ['name', 'hens', 'laying_rate', 'is_laying', 'cycle_month', 'phase', 'sort_order'] as const
  for (const field of fields) {
    if (field in validation.data!) {
      allowedFields[field] = validation.data![field]
    }
  }

  const { data, error } = await supabase
    .from('batches')
    .update({
      ...allowedFields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('farm_id', existingBatch.farm_id as string)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ batch: data })
}

// DELETE /api/batches/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const supabase = createServiceRoleClient()

  // First get the batch to find its farm_id, then verify access
  const { data: existingBatch, error: fetchError } = await supabase
    .from('batches')
    .select('farm_id')
    .eq('id', id)
    .single()

  if (fetchError || !existingBatch) {
    return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
  }

  const { error: authError } = await verifyFarmAccess(existingBatch.farm_id as string)
  if (authError) return authError

  const { error } = await supabase
    .from('batches')
    .delete()
    .eq('id', id)
    .eq('farm_id', existingBatch.farm_id as string)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
