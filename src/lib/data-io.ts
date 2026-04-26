// ================================================================
// DATA I/O - Export/Import via Supabase API (no localStorage)
// Granja Nidal
// ================================================================

const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || ''

// ================================================================
// TYPES
// ================================================================
export interface ExportData {
  version: number
  app: 'granja-nidal'
  exportDate: string
  data: Record<string, unknown>
}

export interface ImportResult {
  success: boolean
  message: string
  stats?: {
    config: boolean
    batches: number
    records: number
    structural: number
    dailyEntries: number
    reminders: number
    vaccinations: number
    feedInventory: number
  }
}

// ================================================================
// FETCH ALL FARM DATA FROM SUPABASE
// ================================================================
async function fetchAllFarmData(): Promise<Record<string, unknown> | null> {
  if (!FARM_ID) return null
  try {
    const res = await fetch(`/api/backup?farm_id=${FARM_ID}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.backup || null
  } catch {
    return null
  }
}

// ================================================================
// EXPORT ALL DATA AS JSON (Supabase)
// ================================================================
export async function exportAllDataAsJSON(): Promise<string> {
  const backup = await fetchAllFarmData()
  const data: ExportData = {
    version: 2,
    app: 'granja-nidal',
    exportDate: new Date().toISOString(),
    data: backup || {},
  }
  return JSON.stringify(data, null, 2)
}

// ================================================================
// EXPORT DAILY PRODUCTION AS CSV (Supabase)
// ================================================================
export async function exportDailyEntriesAsCSV(): Promise<string> {
  const backup = await fetchAllFarmData()
  if (!backup) return ''

  const entries = (backup.daily_entries || []) as Array<Record<string, unknown>>
  if (entries.length === 0) return ''

  const batches = (backup.batches || []) as Array<{ id: string; name: string }>
  const batchNames: Record<string, string> = {}
  batches.forEach(b => { batchNames[b.id] = b.name })

  const headers = ['Fecha', 'Lote', 'Huevos Recogidos', 'Huevos Rotos', 'Mortalidad', 'Feed (kg)', 'Agua (L)', 'Notas']

  const rows = entries.map(e => {
    return [
      String(e.date || ''),
      String(batchNames[e.batch_id as string] || e.batch_id || ''),
      String(e.eggs_collected || 0),
      String(e.eggs_broken || 0),
      String(e.mortality || 0),
      String(e.feed_kg || 0),
      String(e.water_liters || 0),
      `"${String(e.notes || '').replace(/"/g, '""')}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

// ================================================================
// IMPORT ALL DATA FROM JSON (via Supabase backup API)
// ================================================================
export async function importAllDataFromJSON(jsonString: string): Promise<ImportResult> {
  try {
    const parsed = JSON.parse(jsonString)

    // Validate basic structure
    if (parsed.app && parsed.app === 'granja-nidal') {
      // New format — use the backup API
      if (!FARM_ID) {
        return { success: false, message: 'No hay granja configurada.' }
      }

      const res = await fetch(`/api/backup?farm_id=${FARM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: parsed.data || parsed, mode: 'merge' }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        return { success: false, message: `Error al importar: ${errData.error || 'Error del servidor.'}` }
      }

      const result = await res.json()
      const totalInserted = Object.values(result.results as Record<string, { inserted: number }>)
        .reduce((sum: number, r) => sum + r.inserted, 0)

      return {
        success: true,
        message: `Importacion exitosa. ${totalInserted} registros restaurados desde Supabase.`,
        stats: {
          config: true,
          batches: (result.results?.batches?.inserted) || 0,
          records: (result.results?.monthly_records?.inserted) || 0,
          structural: (result.results?.structural_expenses?.inserted) || 0,
          dailyEntries: (result.results?.daily_entries?.inserted) || 0,
          reminders: (result.results?.reminders?.inserted) || 0,
          vaccinations: (result.results?.vaccinations?.inserted) || 0,
          feedInventory: (result.results?.feed_inventory?.inserted) || 0,
        },
      }
    }

    // Legacy or unknown format — try sending to backup API as-is
    if (!FARM_ID) {
      return { success: false, message: 'No hay granja configurada.' }
    }

    const res = await fetch(`/api/backup?farm_id=${FARM_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backup: parsed, mode: 'merge' }),
    })

    if (!res.ok) {
      return { success: false, message: 'Error al importar datos.' }
    }

    return { success: true, message: 'Importacion completada. Recarga la pagina para ver los cambios.' }
  } catch (e) {
    return { success: false, message: `Error al importar: ${e instanceof Error ? e.message : 'Formato invalido.'}` }
  }
}

// ================================================================
// IMPORT DAILY ENTRIES FROM CSV (via Supabase daily-entries API)
// ================================================================
export async function importDailyEntriesFromCSV(csvString: string): Promise<ImportResult> {
  try {
    const lines = csvString.trim().split('\n')
    if (lines.length < 2) {
      return { success: false, message: 'CSV vacio o sin datos.' }
    }

    // Parse header
    const headerLine = lines[0].toLowerCase()
    const cols = headerLine.split(',').map(h => h.trim().replace(/"/g, ''))

    const dateIdx = cols.findIndex(c => c.includes('fecha'))
    const batchIdx = cols.findIndex(c => c.includes('lote'))
    const eggsIdx = cols.findIndex(c => c.includes('huevos') && !c.includes('rotos'))
    const brokenIdx = cols.findIndex(c => c.includes('rotos'))
    const mortIdx = cols.findIndex(c => c.includes('mort'))
    const feedIdx = cols.findIndex(c => c.includes('feed'))
    const waterIdx = cols.findIndex(c => c.includes('agua'))
    const notesIdx = cols.findIndex(c => c.includes('nota'))

    if (dateIdx === -1 || eggsIdx === -1) {
      return { success: false, message: 'CSV debe tener al menos las columnas "Fecha" y "Huevos".' }
    }

    if (!FARM_ID) {
      return { success: false, message: 'No hay granja configurada.' }
    }

    // First, fetch existing batch IDs to resolve names
    const batchRes = await fetch(`/api/batches?farm_id=${FARM_ID}`)
    const batchData = await batchRes.json()
    const batchMap: Record<string, string> = {}
    for (const b of (batchData.batches || [])) {
      batchMap[(b.name as string).toLowerCase()] = b.id as string
    }

    let imported = 0
    let skipped = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = parseCSVLine(line)
      if (values.length < 2) continue

      const date = values[dateIdx]?.trim() || ''
      const batchName = values[batchIdx]?.trim() || ''
      const eggs = parseInt(values[eggsIdx]?.trim()) || 0
      const broken = brokenIdx >= 0 ? parseInt(values[brokenIdx]?.trim()) || 0 : 0
      const mortality = mortIdx >= 0 ? parseInt(values[mortIdx]?.trim()) || 0 : 0
      const feedKg = feedIdx >= 0 ? parseFloat(values[feedIdx]?.trim()) || 0 : 0
      const waterL = waterIdx >= 0 ? parseFloat(values[waterIdx]?.trim()) || 0 : 0
      const notes = notesIdx >= 0 ? values[notesIdx]?.trim() || '' : ''

      if (!date || !batchName || eggs < 0) {
        skipped++
        continue
      }

      // Resolve batch name to ID
      const batchId = batchMap[batchName.toLowerCase()]
      if (!batchId) {
        skipped++
        continue
      }

      // Push to Supabase
      try {
        const res = await fetch(`/api/daily-entries?farm_id=${FARM_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            batch_id: batchId,
            date,
            eggs_collected: Math.max(0, eggs),
            eggs_broken: Math.max(0, broken),
            mortality: Math.max(0, mortality),
            feed_kg: Math.max(0, feedKg),
            water_liters: Math.max(0, waterL),
            notes,
          }),
        })
        if (res.ok) imported++
        else skipped++
      } catch {
        skipped++
      }
    }

    return {
      success: true,
      message: `CSV importado: ${imported} registros nuevos. ${skipped} omitidos (duplicados o invalidos).`,
      stats: { config: false, batches: 0, records: 0, structural: 0, dailyEntries: imported, reminders: 0, vaccinations: 0, feedInventory: 0 },
    }
  } catch (e) {
    return { success: false, message: `Error al importar CSV: ${e instanceof Error ? e.message : 'Formato invalido.'}` }
  }
}

// ================================================================
// GET DATA SUMMARY (from Supabase)
// ================================================================
export async function getDataSummaryAsync(): Promise<{
  hasConfig: boolean
  batchCount: number
  recordCount: number
  structuralCount: number
  dailyEntryCount: number
  reminderCount: number
  vaccineCount: number
  feedInventoryCount: number
} | null> {
  const backup = await fetchAllFarmData()
  if (!backup) return null

  return {
    hasConfig: !!(backup.config),
    batchCount: ((backup.batches || []) as unknown[]).length,
    recordCount: ((backup.monthly_records || []) as unknown[]).length,
    structuralCount: ((backup.structural_expenses || []) as unknown[]).length,
    dailyEntryCount: ((backup.daily_entries || []) as unknown[]).length,
    reminderCount: ((backup.reminders || []) as unknown[]).length,
    vaccineCount: ((backup.vaccinations || []) as unknown[]).length,
    feedInventoryCount: ((backup.feed_inventory || []) as unknown[]).length,
  }
}

// Synchronous stub returning empty data (for initial render)
export function getDataSummary(): {
  hasConfig: boolean
  batchCount: number
  recordCount: number
  structuralCount: number
  dailyEntryCount: number
  reminderCount: number
  vaccineCount: number
  feedInventoryCount: number
} {
  return {
    hasConfig: false,
    batchCount: 0,
    recordCount: 0,
    structuralCount: 0,
    dailyEntryCount: 0,
    reminderCount: 0,
    vaccineCount: 0,
    feedInventoryCount: 0,
  }
}

// ================================================================
// DOWNLOAD HELPERS
// ================================================================
export function downloadJSON(data: string, filename?: string) {
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `granja-nidal-backup-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function downloadCSV(csv: string, filename?: string) {
  if (!csv) return
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }) // BOM for Excel
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename || `granja-nidal-produccion-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ================================================================
// INTERNAL HELPERS
// ================================================================
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current)
  return result
}
