import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth, verifyFarmAccess } from '@/lib/auth-api'
import { validateBody, monthSchema } from '@/lib/validators'

/**
 * GET /api/cash-flow/sync?farm_id=xxx&month=YYYY-MM
 * Aggregates daily production entries for a given month and returns
 * suggested cash flow entries based on actual operational data.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  const { error: authError } = await verifyFarmAccess(req.nextUrl.searchParams.get('farm_id') || '')
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const month = searchParams.get('month') // YYYY-MM format

  if (!farmId || !month) {
    return NextResponse.json({ error: 'farm_id and month are required' }, { status: 400 })
  }

  // SECURITY FIX VULN-06: Validate month format
  const monthValidation = monthSchema.safeParse(month)
  if (!monthValidation.success) {
    return NextResponse.json({ error: 'Formato de mes invalido. Use YYYY-MM.' }, { status: 400 })
  }

  // Build date range for the month
  const [year, mon] = month.split('-').map(Number)
  const dateFrom = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const dateTo = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Fetch daily entries for this farm and month
  const { data: dailyEntries, error: dailyError } = await supabase
    .from('daily_entries')
    .select('*')
    .eq('farm_id', farmId)
    .gte('date', dateFrom)
    .lte('date', dateTo)

  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 })
  }

  // Fetch farm config for prices
  const { data: farmData, error: farmError } = await supabase
    .from('farms')
    .select('config')
    .eq('id', farmId)
    .single()

  if (farmError) {
    return NextResponse.json({ error: farmError.message }, { status: 500 })
  }

  const farmConfig = (farmData?.config || {}) as Record<string, unknown>
  const eggPrice = Number(farmConfig.eggPrice) || 0
  const henSalePrice = Number(farmConfig.henSalePrice) || 0
  const feedPhases = (farmConfig.feedPhases || {}) as Record<string, { price?: number; consumption?: number; label?: string }>

  // Get default feed price (postura phase as fallback)
  const defaultFeedPricePerQuintal = Number(feedPhases.postura?.price) || 0

  // Fetch batch data to determine which phase each batch is in
  const { data: batches } = await supabase
    .from('batches')
    .select('batch_key, phase')
    .eq('farm_id', farmId)

  const batchPhaseMap: Record<string, string> = {}
  if (batches) {
    for (const b of batches) {
      batchPhaseMap[(b as Record<string, unknown>).batch_key as string] = (b as Record<string, unknown>).phase as string || 'postura'
    }
  }

  // Aggregate daily entries
  let totalEggsCollected = 0
  let totalEggsBroken = 0
  let totalMortality = 0
  let totalFeedKg = 0
  let entryCount = 0
  const eggsByBatch: Record<string, number> = {}
  const feedByBatch: Record<string, number> = {}

  for (const entry of (dailyEntries || []) as Record<string, unknown>[]) {
    totalEggsCollected += Number(entry.eggs_collected) || 0
    totalEggsBroken += Number(entry.eggs_broken) || 0
    totalMortality += Number(entry.mortality) || 0
    totalFeedKg += Number(entry.feed_kg) || 0
    entryCount++

    const batchId = entry.batch_id as string
    if (batchId) {
      eggsByBatch[batchId] = (eggsByBatch[batchId] || 0) + (Number(entry.eggs_collected) || 0)
      feedByBatch[batchId] = (feedByBatch[batchId] || 0) + (Number(entry.feed_kg) || 0)
    }
  }

  // Calculate financial values
  const eggsSold = totalEggsCollected - totalEggsBroken
  const eggRevenue = Math.round(eggsSold * eggPrice)

  // Calculate feed cost per phase
  let feedCost = 0
  for (const [batchId, kg] of Object.entries(feedByBatch)) {
    const phase = batchPhaseMap[batchId] || 'postura'
    const phasePrice = Number(feedPhases[phase]?.price) || defaultFeedPricePerQuintal
    feedCost += Math.round(kg * (phasePrice / 100))
  }
  feedCost = Math.round(feedCost)

  // Mortality financial loss
  const mortalityLoss = Math.round(totalMortality * henSalePrice)

  // Check if there are existing auto-sync entries for this month
  const { data: existingSync } = await supabase
    .from('cash_flow_entries')
    .select('id, entry_key, category, amount')
    .eq('farm_id', farmId)
    .like('reference', `auto-sync-%`)
    .gte('date', dateFrom)
    .lte('date', dateTo)

  const existingSyncMap: Record<string, { id: string; entryKey: string; amount: number }> = {}
  for (const e of (existingSync || []) as Record<string, unknown>[]) {
    const cat = e.category as string
    existingSyncMap[cat] = {
      id: e.id as string,
      entryKey: (e.entry_key || e.id) as string,
      amount: Number(e.amount),
    }
  }

  // Build suggested entries
  const suggestions: Array<{
    category: string
    description: string
    amount: number
    type: 'inflow' | 'outflow'
    source: string
    existingAmount?: number
  }> = []

  if (eggsSold > 0 && eggRevenue > 0) {
    suggestions.push({
      category: 'venta_huevos',
      description: `Venta de huevos (${eggsSold.toLocaleString()} unidades) - ${entryCount} registros operativos`,
      amount: eggRevenue,
      type: 'inflow',
      source: `${totalEggsCollected} huevos recogidos, ${totalEggsBroken} rotos`,
      existingAmount: existingSyncMap['venta_huevos']?.amount,
    })
  }

  if (totalFeedKg > 0 && feedCost > 0) {
    suggestions.push({
      category: 'alimento',
      description: `Alimento balanceado consumido (${totalFeedKg.toLocaleString()} kg) - ${entryCount} registros operativos`,
      amount: feedCost,
      type: 'outflow',
      source: `Consumo de alimento en operaciones`,
      existingAmount: existingSyncMap['alimento']?.amount,
    })
  }

  if (totalMortality > 0 && mortalityLoss > 0) {
    suggestions.push({
      category: 'venta_aves',
      description: `Perdida por mortalidad (${totalMortality} aves) - ${entryCount} registros operativos`,
      amount: mortalityLoss,
      type: 'outflow',
      source: `Bajas registradas en operaciones`,
      existingAmount: existingSyncMap['venta_aves']?.amount,
    })
  }

  // Also fetch structural expenses to suggest nomina and other fixed costs
  const { data: structuralExpenses } = await supabase
    .from('structural_expenses')
    .select('*')
    .eq('farm_id', farmId)
    .eq('is_active', true)

  let structuralTotal = 0
  const structuralItems: string[] = []
  if (structuralExpenses) {
    for (const se of structuralExpenses as Record<string, unknown>[]) {
      const amount = Number(se.amount) || 0
      const frequency = se.frequency as string
      let monthlyAmount = 0
      if (frequency === 'mensual') monthlyAmount = amount
      else if (frequency === 'trimestral') monthlyAmount = Math.round(amount / 3)
      else if (frequency === 'semestral') monthlyAmount = Math.round(amount / 6)
      else if (frequency === 'anual') monthlyAmount = Math.round(amount / 12)
      else monthlyAmount = amount // unico
      structuralTotal += monthlyAmount
      structuralItems.push(se.description as string || 'Gasto estructural')
    }
  }

  const fixedCostsMonthly = Number(farmConfig.fixedCostsMonthly) || 0

  if (fixedCostsMonthly > 0) {
    suggestions.push({
      category: 'nomina',
      description: `Nomina y salarios (costo fijo mensual)`,
      amount: fixedCostsMonthly,
      type: 'outflow',
      source: 'Costo fijo configurado',
      existingAmount: existingSyncMap['nomina']?.amount,
    })
  }

  if (structuralTotal > 0) {
    suggestions.push({
      category: 'mantenimiento',
      description: `Gastos estructurales (${structuralItems.length} conceptos) - mensual`,
      amount: structuralTotal,
      type: 'outflow',
      source: structuralItems.slice(0, 3).join(', '),
      existingAmount: existingSyncMap['mantenimiento']?.amount,
    })
  }

  const hasChanges = suggestions.some(s => s.existingAmount === undefined || s.existingAmount !== s.amount)

  return NextResponse.json({
    month,
    entryCount,
    totals: {
      eggsCollected: totalEggsCollected,
      eggsSold,
      eggsBroken: totalEggsBroken,
      mortality: totalMortality,
      feedKg: totalFeedKg,
    },
    financial: {
      eggRevenue,
      feedCost,
      mortalityLoss,
      fixedCostsMonthly,
      structuralTotal,
    },
    suggestions,
    hasChanges,
    existingSyncCategories: Object.keys(existingSyncMap),
  })
}

/**
 * POST /api/cash-flow/sync?farm_id=xxx&month=YYYY-MM
 * SECURITY FIX VULN-12: Now uses atomic RPC function (sync_cash_flow_entries)
 * instead of separate DELETE+INSERT that could leave data in inconsistent state.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const supabase = createServiceRoleClient()
  const { error: authError } = await verifyAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  const month = searchParams.get('month')

  if (!farmId || !month) {
    return NextResponse.json({ error: 'farm_id and month are required' }, { status: 400 })
  }

  // Validate month format
  const monthValidation = monthSchema.safeParse(month)
  if (!monthValidation.success) {
    return NextResponse.json({ error: 'Formato de mes invalido. Use YYYY-MM.' }, { status: 400 })
  }

  // SECURITY FIX VULN-15: Verify farm access
  const farmAuth = await verifyFarmAccess(farmId)
  if (farmAuth.error) return farmAuth.error

  const body = await req.json()
  const entries = body.entries as Array<{
    category: string
    description: string
    amount: number
    type: 'inflow' | 'outflow'
  }>

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: 'No entries provided' }, { status: 400 })
  }

  // Build date range
  const [year, mon] = month.split('-').map(Number)
  const dateFrom = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const dateTo = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // SECURITY FIX VULN-12: Use atomic RPC function instead of separate DELETE+INSERT
  const newEntries = entries.map((entry, idx) => ({
    entry_key: `auto-sync-${month}-${entry.category}-${idx}`,
    category: entry.category,
    description: entry.description,
    amount: entry.amount,
    type: entry.type,
    reference: `auto-sync-${month}`,
  }))

  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'sync_cash_flow_entries',
      {
        p_farm_id: farmId,
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_entries: newEntries,
      }
    )

    if (rpcError) {
      // Fallback to separate operations if RPC doesn't exist yet
      console.warn('[cash-flow sync] RPC not available, using fallback:', rpcError.message)

      // Fallback: separate delete + insert (with error handling)
      const { error: deleteError } = await supabase
        .from('cash_flow_entries')
        .delete()
        .eq('farm_id', farmId)
        .like('reference', 'auto-sync-%')
        .gte('date', dateFrom)
        .lte('date', dateTo)

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 })
      }

      const insertRows = entries.map((entry, idx) => ({
        farm_id: farmId,
        entry_key: `auto-sync-${month}-${entry.category}-${idx}`,
        date: dateTo,
        category: entry.category,
        description: entry.description,
        amount: entry.amount,
        type: entry.type,
        reference: `auto-sync-${month}`,
      }))

      const { data, error: insertError } = await supabase
        .from('cash_flow_entries')
        .insert(insertRows)
        .select()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        entriesCreated: (data || []).length,
        entries: data,
      })
    }

    // Fetch the newly created entries to return them
    const { data: createdEntries, error: fetchError } = await supabase
      .from('cash_flow_entries')
      .select('*')
      .eq('farm_id', farmId)
      .like('reference', `auto-sync-${month}`)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      entriesCreated: rpcData || 0,
      entries: createdEntries || [],
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
