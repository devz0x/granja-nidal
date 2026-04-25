import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { verifyAuth } from '@/lib/auth-api'

// PUT /api/reminders/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { id } = await params
  const body = await req.json()

  const { data, error } = await supabase
    .from('reminders')
    .update({
      ...body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reminder: data })
}

// DELETE /api/reminders/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { id } = await params

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
