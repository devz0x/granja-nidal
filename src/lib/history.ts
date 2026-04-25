// ================================================================
// HISTORIAL - Agregacion y utilidades para registros diarios
// Granja Nidal
// ================================================================

// ================================================================
// TYPES
// ================================================================
export interface DailyEntry {
  id: string
  date: string          // YYYY-MM-DD
  batchId: string
  batchName: string
  eggsCollected: number
  eggsBroken: number
  mortality: number
  feedKg: number
  waterLiters: number
  notes: string
}

export interface WeekSummary {
  weekStart: string     // YYYY-MM-DD (Monday)
  weekEnd: string       // YYYY-MM-DD (Sunday)
  totalEggs: number
  avgEggsPerDay: number
  totalMortality: number
  avgMortalityPerDay: number
  totalFeedKg: number
  avgFeedPerDay: number
  totalWaterL: number
  entryCount: number
  batchSummaries: { batchId: string; batchName: string; totalEggs: number; avgEggs: number }[]
}

export interface MonthSummary {
  month: string         // "YYYY-MM"
  monthLabel: string    // "enero 2025"
  totalEggs: number
  avgEggsPerDay: number
  totalMortality: number
  avgMortalityPerDay: number
  totalFeedKg: number
  avgFeedPerDay: number
  totalWaterL: number
  entryCount: number
  daysRecorded: number
  batchSummaries: { batchId: string; batchName: string; totalEggs: number; avgEggs: number }[]
}

// ================================================================
// CONSTANTES
// ================================================================
const LS_DAILY_ENTRIES = 'granja-wd80-daily-entries'
const LS_BATCHES = 'granja-wd80-batches'

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ================================================================
// OBTENER ENTRADAS DIARIAS DESDE localStorage
// Enriquece con nombre de lote buscandolo en batches
// ================================================================
export function getDailyEntries(): DailyEntry[] {
  if (typeof window === 'undefined') return []

  const saved = localStorage.getItem(LS_DAILY_ENTRIES)
  if (!saved) return []

  try {
    const raw = JSON.parse(saved) as Array<{
      id: string; date: string; batchId: string;
      eggsCollected: number; eggsBroken: number; mortality: number;
      feedKg: number; waterLiters: number; notes: string;
    }>

    // Buscar nombres de lote en batches guardados
    let batchNames: Record<string, string> = {}
    const batchesSaved = localStorage.getItem(LS_BATCHES)
    if (batchesSaved) {
      try {
        const batches = JSON.parse(batchesSaved) as Array<{ id: string; name: string }>
        batches.forEach(b => { batchNames[b.id] = b.name })
      } catch { /* ignore */ }
    }

    return raw.map(entry => ({
      ...entry,
      batchName: batchNames[entry.batchId] || entry.batchId,
    }))
  } catch {
    return []
  }
}

// ================================================================
// ELIMINAR ENTRADA DIARIA
// ================================================================
export function deleteDailyEntry(id: string): DailyEntry[] {
  const entries = getDailyEntries()
  const filtered = entries.filter(e => e.id !== id)
  localStorage.setItem(LS_DAILY_ENTRIES, JSON.stringify(filtered))
  return filtered
}

// ================================================================
// ELIMINAR ENTRADAS DIARIAS DE UN LOTE (para cuando se borra un lote)
// ================================================================
export function deleteEntriesForBatch(batchId: string): DailyEntry[] {
  const entries = getDailyEntries()
  const filtered = entries.filter(e => e.batchId !== batchId)
  localStorage.setItem(LS_DAILY_ENTRIES, JSON.stringify(filtered))
  return filtered
}

// ================================================================
// FILTRAR POR LOTE
// ================================================================
export function getEntriesForBatch(entries: DailyEntry[], batchId: string): DailyEntry[] {
  return entries.filter(e => e.batchId === batchId)
}

// ================================================================
// FILTRAR POR RANGO DE FECHAS
// ================================================================
export function getEntriesForDateRange(entries: DailyEntry[], start: string, end: string): DailyEntry[] {
  return entries.filter(e => e.date >= start && e.date <= end)
}

// ================================================================
// HELPERS DE FECHA
// ================================================================

// Obtener lunes de la semana que contiene la fecha
function getMonday(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// Obtener domingo de la semana que contiene la fecha
function getSunday(date: string): string {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const diff = d.getDate() + (7 - day)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

// Obtener mes en formato "YYYY-MM"
function getMonthKey(date: string): string {
  return date.substring(0, 7)
}

// Obtener etiqueta legible del mes
function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const monthIndex = parseInt(month, 10) - 1
  return `${MESES_ES[monthIndex]} ${year}`
}

// Obtener dias unicos en un conjunto de entradas
function getUniqueDays(entries: DailyEntry[]): number {
  const days = new Set(entries.map(e => e.date))
  return days.size
}

// Calcular numero de dias en un mes
function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0).getDate()
}

// Calcular batch summaries para un subconjunto de entradas
function computeBatchSummaries(entries: DailyEntry[]): WeekSummary['batchSummaries'] {
  const map = new Map<string, { name: string; totalEggs: number; count: number }>()
  entries.forEach(e => {
    const existing = map.get(e.batchId)
    if (existing) {
      existing.totalEggs += e.eggsCollected
      existing.count += 1
    } else {
      map.set(e.batchId, { name: e.batchName, totalEggs: e.eggsCollected, count: 1 })
    }
  })
  return Array.from(map.entries()).map(([id, data]) => ({
    batchId: id,
    batchName: data.name,
    totalEggs: data.totalEggs,
    avgEggs: data.count > 0 ? Math.round(data.totalEggs / data.count) : 0,
  }))
}

// ================================================================
// AGREGACION SEMANAL
// ================================================================
export function getWeekSummaries(entries: DailyEntry[], weeksBack: number = 8): WeekSummary[] {
  if (entries.length === 0) return []

  // Calcular la fecha limite: weeksBack semanas atras desde hoy
  const today = new Date()
  const cutoffDate = new Date(today)
  cutoffDate.setDate(cutoffDate.getDate() - (weeksBack * 7))
  const cutoff = cutoffDate.toISOString().split('T')[0]

  // Filtrar entradas dentro del rango
  const filtered = entries.filter(e => e.date >= cutoff)

  // Agrupar por semana (clave = lunes)
  const weekMap = new Map<string, DailyEntry[]>()
  filtered.forEach(entry => {
    const monday = getMonday(entry.date)
    const existing = weekMap.get(monday)
    if (existing) {
      existing.push(entry)
    } else {
      weekMap.set(monday, [entry])
    }
  })

  // Convertir a WeekSummary
  const summaries: WeekSummary[] = Array.from(weekMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monday, weekEntries]) => {
      const sunday = getSunday(monday)
      const totalEggs = weekEntries.reduce((s, e) => s + e.eggsCollected, 0)
      const totalMortality = weekEntries.reduce((s, e) => s + e.mortality, 0)
      const totalFeedKg = weekEntries.reduce((s, e) => s + e.feedKg, 0)
      const totalWaterL = weekEntries.reduce((s, e) => s + e.waterLiters, 0)
      const uniqueDays = getUniqueDays(weekEntries)
      const entryCount = weekEntries.length

      return {
        weekStart: monday,
        weekEnd: sunday,
        totalEggs,
        avgEggsPerDay: uniqueDays > 0 ? Math.round(totalEggs / uniqueDays) : 0,
        totalMortality,
        avgMortalityPerDay: uniqueDays > 0 ? parseFloat((totalMortality / uniqueDays).toFixed(1)) : 0,
        totalFeedKg: parseFloat(totalFeedKg.toFixed(1)),
        avgFeedPerDay: uniqueDays > 0 ? parseFloat((totalFeedKg / uniqueDays).toFixed(1)) : 0,
        totalWaterL: parseFloat(totalWaterL.toFixed(1)),
        entryCount,
        batchSummaries: computeBatchSummaries(weekEntries),
      }
    })

  return summaries
}

// ================================================================
// AGREGACION MENSUAL
// ================================================================
export function getMonthSummaries(entries: DailyEntry[], monthsBack: number = 12): MonthSummary[] {
  if (entries.length === 0) return []

  // Calcular la fecha limite
  const today = new Date()
  const cutoffDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  // Filtrar entradas dentro del rango
  const filtered = entries.filter(e => e.date >= cutoff)

  // Agrupar por mes
  const monthMap = new Map<string, DailyEntry[]>()
  filtered.forEach(entry => {
    const monthKey = getMonthKey(entry.date)
    const existing = monthMap.get(monthKey)
    if (existing) {
      existing.push(entry)
    } else {
      monthMap.set(monthKey, [entry])
    }
  })

  // Convertir a MonthSummary
  const summaries: MonthSummary[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, monthEntries]) => {
      const totalEggs = monthEntries.reduce((s, e) => s + e.eggsCollected, 0)
      const totalMortality = monthEntries.reduce((s, e) => s + e.mortality, 0)
      const totalFeedKg = monthEntries.reduce((s, e) => s + e.feedKg, 0)
      const totalWaterL = monthEntries.reduce((s, e) => s + e.waterLiters, 0)
      const daysRecorded = getUniqueDays(monthEntries)
      const entryCount = monthEntries.length
      const totalDays = daysInMonth(monthKey)

      return {
        month: monthKey,
        monthLabel: getMonthLabel(monthKey),
        totalEggs,
        avgEggsPerDay: daysRecorded > 0 ? Math.round(totalEggs / daysRecorded) : 0,
        totalMortality,
        avgMortalityPerDay: daysRecorded > 0 ? parseFloat((totalMortality / daysRecorded).toFixed(1)) : 0,
        totalFeedKg: parseFloat(totalFeedKg.toFixed(1)),
        avgFeedPerDay: daysRecorded > 0 ? parseFloat((totalFeedKg / daysRecorded).toFixed(1)) : 0,
        totalWaterL: parseFloat(totalWaterL.toFixed(1)),
        entryCount,
        daysRecorded,
        batchSummaries: computeBatchSummaries(monthEntries),
      }
    })

  return summaries
}
