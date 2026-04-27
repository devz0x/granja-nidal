import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// GET /api/structural-expenses
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  // SECURITY: Verify farm access
  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const { data, error } = await supabase
    .from('structural_expenses')
    .select('*')
    .eq('farm_id', farmId)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expenses: data || [] })
}

// POST /api/structural-expenses
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  // SECURITY: Verify farm access
  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const body = await req.json()

  // Support batch insert
  if (Array.isArray(body.expenses)) {
    const expenses = body.expenses.map((e: Record<string, unknown>, i: number) => ({
      farm_id: farmId,
      description: e.description || '',
      amount: e.amount || 0,
      frequency: e.frequency || 'unico',
      is_active: e.is_active !== undefined ? e.is_active : true,
      sort_order: e.sort_order || i,
    }))

    const { data, error } = await supabase
      .from('structural_expenses')
      .insert(expenses)
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ expenses: data })
  }

  const { data, error } = await supabase
    .from('structural_expenses')
    .insert({
      farm_id: farmId,
      description: body.description || '',
      amount: body.amount || 0,
      frequency: body.frequency || 'unico',
      is_active: body.is_active !== undefined ? body.is_active : true,
      sort_order: body.sort_order || 0,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ expense: data })
}
