import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// GET /api/invoices/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('farm_id', farmId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ invoice: data })
}

// DELETE /api/invoices/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = createServiceRoleClient()
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id)
    .eq('farm_id', farmId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
