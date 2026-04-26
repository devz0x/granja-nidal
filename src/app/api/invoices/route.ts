import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess, verifyAuth } from '@/lib/auth-api'
import { validateBody, invoiceCreateSchema } from '@/lib/validators'

// GET /api/invoices?farm_id=xxx&status=xxx
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = await createServerSupabaseClient()
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  let query = supabase
    .from('invoices')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }
  if (search) {
    query = query.or(`client_name.ilike.%${search}%,number.ilike.%${search}%,client_rnc.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoices: data || [] })
}

// POST /api/invoices?farm_id=xxx
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = await createServerSupabaseClient()
  const body = await req.json()

  const validation = validateBody(invoiceCreateSchema, body)
  if (validation.error) {
    return NextResponse.json({ error: validation.error.message, details: validation.error.details }, { status: 400 })
  }

  const invoiceData = validation.data!

  // Calculate amounts for each item
  const itemsWithAmounts = invoiceData.items.map(item => ({
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount || (item.quantity * item.unit_price),
  }))

  const subtotal = itemsWithAmounts.reduce((sum, item) => sum + item.amount, 0)
  const itbis = Math.round(subtotal * 0.18 * 100) / 100
  const total = Math.round((subtotal + itbis) * 100) / 100

  // Generate sequential invoice number
  const { data: lastInvoice } = await supabase
    .from('invoices')
    .select('number')
    .eq('farm_id', farmId)
    .order('number', { ascending: false })
    .limit(1)

  let nextNum = 1
  if (lastInvoice && lastInvoice.length > 0) {
    const lastNum = parseInt((lastInvoice[0].number as string).replace('GN-', ''), 10)
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1
    }
  }
  const invoiceNumber = `GN-${String(nextNum).padStart(4, '0')}`

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      farm_id: farmId,
      number: invoiceNumber,
      client_name: invoiceData.client_name,
      client_rnc: invoiceData.client_rnc || '',
      client_address: invoiceData.client_address || '',
      client_phone: invoiceData.client_phone || '',
      items: itemsWithAmounts,
      subtotal,
      itbis,
      total,
      status: invoiceData.status || 'borrador',
      notes: invoiceData.notes || '',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ invoice: data }, { status: 201 })
}
