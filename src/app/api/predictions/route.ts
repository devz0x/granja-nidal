import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess } from '@/lib/auth-api'

// GET /api/predictions?farm_id=xxx - Calculate predictions based on historical data
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')

  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const { error: authError } = await verifyFarmAccess(farmId)
  if (authError) return authError

  const supabase = createServiceRoleClient()

  // Fetch daily entries (last 90 days for moving averages)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

  const { data: entries, error: entriesError } = await supabase
    .from('daily_entries')
    .select('date, eggs_collected, mortality, feed_kg, batch_id')
    .eq('farm_id', farmId)
    .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  if (entriesError) {
    return NextResponse.json({ error: entriesError.message }, { status: 500 })
  }

  // Fetch batches for context
  const { data: batches } = await supabase
    .from('batches')
    .select('id, name, hens, laying_rate, is_laying, cycle_month, phase')
    .eq('farm_id', farmId)

  // Fetch config for prices
  const { data: farmData } = await supabase
    .from('farms')
    .select('config')
    .eq('id', farmId)
    .single()

  const config = (farmData?.config as Record<string, unknown>) || {}

  // ================================================================
  // PREDICTION ALGORITHMS
  // ================================================================

  // 1. Aggregate daily data by date (sum across all batches)
  const dailyAgg = new Map<string, { eggs: number; mortality: number; feed: number }>()
  for (const e of entries || []) {
    const date = e.date as string
    const prev = dailyAgg.get(date) || { eggs: 0, mortality: 0, feed: 0 }
    prev.eggs += (e.eggs_collected || 0) as number
    prev.mortality += (e.mortality || 0) as number
    prev.feed += Number(e.feed_kg || 0)
    dailyAgg.set(date, prev)
  }

  const sortedDates = Array.from(dailyAgg.keys()).sort()
  const dailyData = sortedDates.map(d => ({ date: d, ...dailyAgg.get(d)! }))

  // 2. Moving averages (7-day and 30-day)
  function calcMovingAvg(data: number[], window: number): number[] {
    const result: number[] = []
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1)
      const slice = data.slice(start, i + 1)
      result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
    }
    return result
  }

  const eggValues = dailyData.map(d => d.eggs)
  const ma7 = calcMovingAvg(eggValues, 7)
  const ma30 = calcMovingAvg(eggValues, 30)

  // 3. Linear regression for trend
  function linearRegression(data: number[]): { slope: number; intercept: number } {
    const n = data.length
    if (n < 2) return { slope: 0, intercept: data[0] || 0 }
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
    for (let i = 0; i < n; i++) {
      sumX += i
      sumY += data[i]
      sumXY += i * data[i]
      sumXX += i * i
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    return { slope, intercept }
  }

  const regression = linearRegression(eggValues)
  const feedRegression = linearRegression(dailyData.map(d => d.feed))
  const mortalityRegression = linearRegression(dailyData.map(d => d.mortality))

  // 4. Predict next 30 days
  const today = new Date()
  const predictions: Array<{
    date: string
    predicted_eggs: number
    predicted_feed: number
    predicted_mortality: number
    lower_conf: number
    upper_conf: number
  }> = []

  const lastN = eggValues.length
  const residualVariance = eggValues.length > 1
    ? eggValues.reduce((sum, v, i) => sum + Math.pow(v - (regression.intercept + regression.slope * i), 2), 0) / (lastN - 1)
    : 0
  const stdError = Math.sqrt(residualVariance) || 50

  for (let day = 1; day <= 30; day++) {
    const futureDate = new Date(today)
    futureDate.setDate(futureDate.getDate() + day)
    const dateStr = futureDate.toISOString().split('T')[0]
    const idx = lastN + day - 1
    const predEggs = Math.max(0, Math.round(regression.intercept + regression.slope * idx))
    const predFeed = Math.max(0, Math.round((feedRegression.intercept + feedRegression.slope * idx) * 100) / 100)
    const predMort = Math.max(0, Math.round((mortalityRegression.intercept + mortalityRegression.slope * idx) * 100) / 100)

    // Confidence interval widens over time
    const ciWidth = 1.96 * stdError * Math.sqrt(1 + 1 / lastN + Math.pow(day, 2) / (lastN * lastN))

    predictions.push({
      date: dateStr,
      predicted_eggs: predEggs,
      predicted_feed: predFeed,
      predicted_mortality: predMort,
      lower_conf: Math.max(0, Math.round(predEggs - ciWidth)),
      upper_conf: Math.round(predEggs + ciWidth),
    })
  }

  // 5. Batch-level analysis (mortality risk + optimal sale timing)
  const batchAnalysis = (batches || []).map((b: Record<string, unknown>) => {
    const batchId = b.id as string
    const batchEntries = (entries || []).filter((e: Record<string, unknown>) => e.batch_id === batchId)
    const batchDaily = batchEntries.map((e: Record<string, unknown>) => ({
      eggs: (e.eggs_collected || 0) as number,
      mortality: (e.mortality || 0) as number,
      feed: Number(e.feed_kg || 0),
    }))

    const avgEggs = batchDaily.length > 0
      ? batchDaily.reduce((s: number, d: { eggs: number }) => s + d.eggs, 0) / batchDaily.length
      : 0
    const avgMort = batchDaily.length > 0
      ? batchDaily.reduce((s: number, d: { mortality: number }) => s + d.mortality, 0) / batchDaily.length
      : 0

    const cycleMonth = (b.cycle_month || 0) as number
    const isLaying = b.is_laying as boolean
    const layingRate = (b.laying_rate || 0) as number

    // Mortality risk assessment based on cycle month and phase
    let mortalityRisk: 'bajo' | 'moderado' | 'alto' = 'bajo'
    if (cycleMonth < 1) mortalityRisk = 'alto'
    else if (cycleMonth < 4 && avgMort > 3) mortalityRisk = 'alto'
    else if (avgMort > 2) mortalityRisk = 'moderado'

    // Optimal sale timing: recommend sale when laying rate drops below threshold
    // or cycle month approaches end of typical laying cycle (18-20 months)
    const optimalCycleEnd = 18
    let saleRecommendation = ''
    if (!isLaying) {
      saleRecommendation = 'No esta en postura - evaluar si iniciar produccion'
    } else if (cycleMonth >= optimalCycleEnd) {
      saleRecommendation = `Recomendado vender - ciclo de ${cycleMonth} meses excede el optimo de ${optimalCycleEnd}`
    } else if (layingRate < 60) {
      saleRecommendation = `Considerar venta - tasa de postura baja (${layingRate}%)`
    } else if (cycleMonth >= optimalCycleEnd - 2) {
      saleRecommendation = `Acercandose al final optimo - ${optimalCycleEnd - cycleMonth} meses restantes`
    } else {
      saleRecommendation = `Produccion optima - ${optimalCycleEnd - cycleMonth} meses hasta fin recomendado`
    }

    return {
      batch_id: batchId,
      batch_name: b.name,
      hens: b.hens,
      cycle_month: cycleMonth,
      laying_rate: layingRate,
      is_laying: isLaying,
      avg_daily_eggs: Math.round(avgEggs),
      avg_daily_mortality: Math.round(avgMort * 100) / 100,
      mortality_risk: mortalityRisk,
      sale_recommendation: saleRecommendation,
    }
  })

  // 6. Revenue forecast for next 3 months
  const eggPrice = Number((config.eggPrice as number) || 5.5)
  const lastMA7 = ma7.length > 0 ? ma7[ma7.length - 1] : 0
  const lastMA30 = ma30.length > 0 ? ma30[ma30.length - 1] : 0

  const avgDailyEggs = lastMA7 || lastMA30 || (eggValues.length > 0 ? eggValues[eggValues.length - 1] : 0)
  const avgDailyFeed = dailyData.length > 0
    ? dailyData.slice(-7).reduce((s, d) => s + d.feed, 0) / Math.min(7, dailyData.length)
    : 0

  const months: Array<{ month: string; eggs: number; revenue: number; feed_cost: number; net: number; trend: 'up' | 'down' | 'stable' }> = []
  for (let m = 0; m < 3; m++) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() + m, 1)
    const monthLabel = monthDate.toLocaleString('es-DO', { month: 'long', year: 'numeric' })
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()

    // Factor in trend and seasonal decline
    const trendFactor = 1 + (regression.slope * 30 / (avgDailyEggs || 1)) * (m + 1) * 0.3
    const cycleDecline = 1 - (m * 0.02) // ~2% monthly decline
    const adjustedEggs = Math.max(0, Math.round(avgDailyEggs * trendFactor * cycleDecline * daysInMonth))

    const revenue = adjustedEggs * eggPrice
    const feedCostPerKg = Number((config as Record<string, unknown>).feedPhases
      ? (((config.feedPhases as Record<string, Record<string, unknown>>).postura?.price as number) || 1300) / 100
      : 13)
    const feedCost = avgDailyFeed * daysInMonth * feedCostPerKg
    const net = revenue - feedCost

    const trend: 'up' | 'down' | 'stable' = regression.slope > 5 ? 'up' : regression.slope < -5 ? 'down' : 'stable'

    months.push({
      month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      eggs: adjustedEggs,
      revenue: Math.round(revenue),
      feed_cost: Math.round(feedCost),
      net: Math.round(net),
      trend,
    })
  }

  // 7. Current stats summary
  const currentMA7Eggs = ma7.length > 0 ? Math.round(ma7[ma7.length - 1]) : 0
  const currentMA30Eggs = ma30.length > 0 ? Math.round(ma30[ma30.length - 1]) : 0
  const currentMA7Feed = dailyData.length >= 7
    ? Math.round(dailyData.slice(-7).reduce((s, d) => s + d.feed, 0) / 7 * 100) / 100
    : 0
  const currentMA30Feed = dailyData.length >= 30
    ? Math.round(dailyData.slice(-30).reduce((s, d) => s + d.feed, 0) / 30 * 100) / 100
    : 0

  return NextResponse.json({
    summary: {
      data_points: dailyData.length,
      trend_direction: regression.slope > 5 ? 'ascendente' : regression.slope < -5 ? 'descendente' : 'estable',
      trend_slope: Math.round(regression.slope * 100) / 100,
      current_avg_7day: currentMA7Eggs,
      current_avg_30day: currentMA30Eggs,
      current_feed_7day: currentMA7Feed,
      current_feed_30day: currentMA30Feed,
    },
    moving_averages: dailyData.map((d, i) => ({
      date: d.date,
      eggs: d.eggs,
      ma7: Math.round(ma7[i] || 0),
      ma30: Math.round(ma30[i] || 0),
    })),
    predictions_30days: predictions,
    batch_analysis: batchAnalysis,
    revenue_forecast: months,
    regression: {
      egg_slope: Math.round(regression.slope * 100) / 100,
      egg_intercept: Math.round(regression.intercept * 100) / 100,
      feed_slope: Math.round(feedRegression.slope * 100) / 100,
      mortality_slope: Math.round(mortalityRegression.slope * 100) / 100,
    },
  })
}
