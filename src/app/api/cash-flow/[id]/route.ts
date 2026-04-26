import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth, verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, cashFlowUpdateSchema } from '@/lib/validators'

// PUT /api/cash-flow/[id] - Update a single cash flow entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { id } = await params
  const body = await req.json()

  // SECURITY FIX VULN-06: Zod validation
  const validation = validateBody(cashFlowUpdateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  // Sanitize: ensure id is safe
  if (!/^[a-zA-Z0-9_\-:]+$/.test(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 })
  }

  // Delete by entry_key or by UUID id
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query
  if (isUUID) {
    query = supabase.from('cash_flow_entries').update({
      date: validation.data!.date,
      category: validation.data!.category,
      description: validation.data!.description,
      amount: validation.data!.amount,
      type: validation.data!.type,
      reference: validation.data!.reference,
    }).eq('id', id)
  } else {
    query = supabase.from('cash_flow_entries').update({
      date: validation.data!.date,
      category: validation.data!.category,
      description: validation.data!.description,
      amount: validation.data!.amount,
      type: validation.data!.type,
      reference: validation.data!.reference,
    }).eq('entry_key', id)
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
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = await createServerSupabaseClient()
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { id } = await params

  // Sanitize: ensure id is safe
  if (!/^[a-zA-Z0-9_\-:]+$/.test(id)) {
    return NextResponse.json({ error: 'ID invalido' }, { status: 400 })
  }

  // Delete by entry_key or by UUID id
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  let query
  if (isUUID) {
    query = supabase.from('cash_flow_entries').delete().eq('id', id)
  } else {
    query = supabase.from('cash_flow_entries').delete().eq('entry_key', id)
  }

  const { error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
