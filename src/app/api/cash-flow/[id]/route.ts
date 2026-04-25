import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

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
