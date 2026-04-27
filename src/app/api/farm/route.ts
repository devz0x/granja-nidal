import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

// GET /api/farm - Get farm by ID or check connection
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado', configured: false }, { status: 200 })
  }

  const supabase = createServiceRoleClient()

  // Verify authentication
  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido', configured: true }, { status: 400 })
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
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  // Verify authentication
  const { user, error: authError } = await verifyAuth()
  if (authError) return authError

  const body = await req.json()
  const { name, slug, config } = body

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 })
  }

  // Use authenticated user's ID (ignore user_id from request body for security)
  const ownerId = user?.id

  // Clean up the slug
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  // Check if slug already exists
  const { data: existingFarm } = await supabase
    .from('farms')
    .select('id, slug')
    .eq('slug', cleanSlug)
    .single()

  if (existingFarm) {
    return NextResponse.json(
      {
        error: 'Ya existe una granja con ese slug. Intenta con un nombre diferente.',
        code: 'SLUG_EXISTS',
        existingSlug: cleanSlug,
      },
      { status: 409 }
    )
  }

  const { data, error } = await supabase
    .from('farms')
    .insert({ name, slug: cleanSlug, config: config || {}, user_id: ownerId })
    .select()
    .single()

  if (error) {
    // Handle specific database errors with user-friendly messages
    if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
      return NextResponse.json(
        {
          error: 'Ya existe una granja con ese slug. Intenta con un nombre diferente.',
          code: 'SLUG_EXISTS',
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ farm: data })
}
