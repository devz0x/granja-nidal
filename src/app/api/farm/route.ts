import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/farm - Get farm by ID or check connection
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured', configured: false }, { status: 200 })
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required', configured: true }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('id', farmId)
    .eq('user_id', user?.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ farm: data, configured: true })
}

// POST /api/farm - Create a new farm
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  // Verify authentication
  const { user, error: authError } = await verifyAuth(req)
  if (authError) return authError

  const body = await req.json()
  const { name, slug, config, user_id } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  // Use authenticated user's ID (ignore user_id from request body for security)
  const ownerId = user?.id

  const { data, error } = await supabase
    .from('farms')
    .insert({ name, slug, config: config || {}, user_id: ownerId })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ farm: data })
}
