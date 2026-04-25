import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/config - Get farm config
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('farms')
    .select('config, updated_at')
    .eq('id', farmId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ config: data?.config || {} })
}

// PUT /api/config - Update farm config
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const body = await req.json()
  const { config } = body

  const { data, error } = await supabase
    .from('farms')
    .update({ config, updated_at: new Date().toISOString() })
    .eq('id', farmId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ config: data?.config })
}
