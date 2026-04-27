import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, cashFlowUpdateSchema } from '@/lib/validators'

// PUT /api/cash-flow/[id] - Update a single cash flow entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { id } = await params

  // Verify farm access by looking up farm_id from the entry
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  // Sanitize: ensure id is safe
  if (!/^[a-zA-Z0-9_\-:]+$/.test(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 })
  }

  const lookupQuery = isUUID
    ? supabase.from('cash_flow_entries').select('farm_id').eq('id', id).single()
    : supabase.from('cash_flow_entries').select('farm_id').eq('entry_key', id).single()
  const { data: entryData, error: lookupError } = await lookupQuery
  if (lookupError || !entryData) {
    return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
  }

  const { error: authError } = await verifyFarmAccess(entryData.farm_id as string)
  if (authError) return authError

  const body = await req.json()

  // SECURITY FIX VULN-06: Zod validation
  const validation = validateBody(cashFlowUpdateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  let query
  if (isUUID) {
    query = supabase.from('cash_flow_entries').update({
      date: validation.data!.date,
      category: validation.data!.category,
      description: validation.data!.description,
      amount: validation.data!.amount,
      type: validation.data!.type,
      reference: validation.data!.reference,
    }).eq('id', id).eq('farm_id', entryData.farm_id as string)
  } else {
    query = supabase.from('cash_flow_entries').update({
      date: validation.data!.date,
      category: validation.data!.category,
      description: validation.data!.description,
      amount: validation.data!.amount,
      type: validation.data!.type,
      reference: validation.data!.reference,
    }).eq('entry_key', id).eq('farm_id', entryData.farm_id as string)
  }

  const { data, error } = await query.select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry: data })
}

// DELETE /api/cash-flow/[id] - Delete a single cash flow entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { id } = await params

  // Sanitize: ensure id is safe
  if (!/^[a-zA-Z0-9_\-:]+$/.test(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 })
  }

  // Delete by entry_key or by UUID id — first verify farm access
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let lookupQuery = isUUID
    ? supabase.from('cash_flow_entries').select('farm_id').eq('id', id).single()
    : supabase.from('cash_flow_entries').select('farm_id').eq('entry_key', id).single()
  const { data: entryData, error: lookupError } = await lookupQuery
  if (lookupError || !entryData) {
    return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 })
  }

  const { error: authError } = await verifyFarmAccess(entryData.farm_id as string)
  if (authError) return authError

  let query
  if (isUUID) {
    query = supabase.from('cash_flow_entries').delete().eq('id', id).eq('farm_id', entryData.farm_id as string)
  } else {
    query = supabase.from('cash_flow_entries').delete().eq('entry_key', id).eq('farm_id', entryData.farm_id as string)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
