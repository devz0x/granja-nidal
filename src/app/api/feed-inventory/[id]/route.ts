import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// PUT /api/feed-inventory/[id]
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

  const { data, error } = await supabase
    .from('feed_inventory')
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

  return NextResponse.json({ item: data })
}

// DELETE /api/feed-inventory/[id]
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

  const { error } = await supabase
    .from('feed_inventory')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
