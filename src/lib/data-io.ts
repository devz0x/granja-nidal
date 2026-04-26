// ================================================================
// DATA I/O - Export/Import para respaldo y migracion de datos
// Granja Nidal
// ================================================================

// ================================================================
// LOCALSTORAGE KEYS (centralizados)
// ================================================================
const LS_KEYS = {
  config: 'granja-wd80-config',
  configVersion: 'granja-wd80-config-version',
  batches: 'granja-wd80-batches',
  records: 'granja-wd80-records',
  structural: 'granja-wd80-structural',
  dailyEntries: 'granja-wd80-daily-entries',
  reminders: 'granja-wd80-reminders',
  vaccinations: 'granja-wd80-vaccinations',
  feedInventory: 'granja-wd80-feed-inventory',
} as const

// ================================================================
// TYPES
// ================================================================
export interface ExportData {
  version: number
  app: 'granja-nidal'
  exportDate: string
  data: {
    config: unknown
    batches: unknown
    records: unknown
    structuralExpenses: unknown
    dailyEntries: unknown
    reminders: unknown[]
    vaccinations: unknown[]
    feedInventory: unknown[]
  }
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
// EXPORT ALL DATA AS JSON
// ================================================================
export function exportAllDataAsJSON(): string {
  const data: ExportData = {
    version: 2,
    app: 'granja-nidal',
    exportDate: new Date().toISOString(),
    data: {
      config: readLS(LS_KEYS.config),
      batches: readLS(LS_KEYS.batches),
      records: readLS(LS_KEYS.records),
      structuralExpenses: readLS(LS_KEYS.structural),
      dailyEntries: readLS(LS_KEYS.dailyEntries),
      reminders: parseLSArray(LS_KEYS.reminders),
      vaccinations: parseLSArray(LS_KEYS.vaccinations),
      feedInventory: parseLSArray(LS_KEYS.feedInventory),
    },
  }
  return JSON.stringify(data, null, 2)
}

// ================================================================
// IMPORT ALL DATA FROM JSON
// ================================================================
export function importAllDataFromJSON(jsonString: string): ImportResult {
  try {
    const parsed = JSON.parse(jsonString) as ExportData

    // Validacion basica
    if (!parsed.app || parsed.app !== 'granja-nidal') {
      return { success: false, message: 'Archivo invalido: no es un respaldo de Granja Nidal.' }
    }

    if (!parsed.data) {
      return { success: false, message: 'Archivo corrupto: no contiene datos.' }
    }

    const stats: ImportResult['stats'] = {
      config: false,
      batches: 0,
      records: 0,
      structural: 0,
      dailyEntries: 0,
      reminders: 0,
      vaccinations: 0,
      feedInventory: 0,
    }

    // Importar cada seccion
    if (parsed.data.config) {
      writeLS(LS_KEYS.config, parsed.data.config)
      writeLS(LS_KEYS.configVersion, String(parsed.version || 2))
      stats.config = true
    }

    if (parsed.data.batches) {
      const arr = ensureArray(parsed.data.batches)
      writeLS(LS_KEYS.batches, arr)
      stats.batches = arr.length
    }

    if (parsed.data.records) {
      const arr = ensureArray(parsed.data.records)
      writeLS(LS_KEYS.records, arr)
      stats.records = arr.length
    }

    if (parsed.data.structuralExpenses) {
      const arr = ensureArray(parsed.data.structuralExpenses)
      writeLS(LS_KEYS.structural, arr)
      stats.structural = arr.length
    }

    if (parsed.data.dailyEntries) {
      const arr = ensureArray(parsed.data.dailyEntries)
      writeLS(LS_KEYS.dailyEntries, arr)
      stats.dailyEntries = arr.length
    }

    if (parsed.data.reminders) {
      const arr = ensureArray(parsed.data.reminders)
      writeLS(LS_KEYS.reminders, arr)
      stats.reminders = arr.length
    }

    if (parsed.data.vaccinations) {
      const arr = ensureArray(parsed.data.vaccinations)
      writeLS(LS_KEYS.vaccinations, arr)
      stats.vaccinations = arr.length
    }

    if (parsed.data.feedInventory) {
      const arr = ensureArray(parsed.data.feedInventory)
      writeLS(LS_KEYS.feedInventory, arr)
      stats.feedInventory = arr.length
    }

    return {
      success: true,
      message: `Importacion exitosa. Lotes: ${stats.batches}, Registros: ${stats.records}, Produccion diaria: ${stats.dailyEntries}, Alertas: ${stats.reminders}, Vacunas: ${stats.vaccinations}.`,
      stats,
    }
  } catch (e) {
    return { success: false, message: `Error al importar: ${e instanceof Error ? e.message : 'Formato invalido.'}` }
  }
}

// ================================================================
// EXPORT DAILY PRODUCTION AS CSV
// ================================================================
export function exportDailyEntriesAsCSV(): string {
  const entries = parseLSArray(LS_KEYS.dailyEntries)
  if (entries.length === 0) return ''

  const batches = parseLSArray(LS_KEYS.batches) as Array<{ id: string; name: string }>
  const batchNames: Record<string, string> = {}
  batches.forEach(b => { batchNames[b.id] = b.name })

  const headers = ['Fecha', 'Lote', 'Huevos Recogidos', 'Huevos Rotos', 'Mortalidad', 'Feed (kg)', 'Agua (L)', 'Notas']

  const rows = entries.map(e => {
    const entry = e as Record<string, unknown>
    return [
      String(entry.date || ''),
      String(batchNames[entry.batchId as string] || entry.batchId || ''),
      String(entry.eggsCollected || 0),
      String(entry.eggsBroken || 0),
      String(entry.mortality || 0),
      String(entry.feedKg || 0),
      String(entry.waterLiters || 0),
      `"${String(entry.notes || '').replace(/"/g, '""')}"`,
    ].join(',')
  })

  return [headers.join(','), ...rows].join('\n')
}

// ================================================================
// IMPORT DAILY ENTRIES FROM CSV (APPEND)
// ================================================================
export function importDailyEntriesFromCSV(csvString: string): ImportResult {
  try {
    const lines = csvString.trim().split('\n')
    if (lines.length < 2) {
      return { success: false, message: 'CSV vacio o sin datos.' }
    }

    // Parse header to detect column order
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

    const existing = parseLSArray(LS_KEYS.dailyEntries)
    const existingDates = new Set(
      (existing as Array<Record<string, unknown>>).map(e => `${e.date}-${e.batchId}`)
    )

    let imported = 0
    let skipped = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Simple CSV parse (handles quoted fields)
      const values = parseCSVLine(line)
      if (values.length < 2) continue

      const date = values[dateIdx]?.trim() || ''
      const batchId = values[batchIdx]?.trim() || ''
      const eggs = parseInt(values[eggsIdx]?.trim()) || 0
      const broken = brokenIdx >= 0 ? parseInt(values[brokenIdx]?.trim()) || 0 : 0
      const mortality = mortIdx >= 0 ? parseInt(values[mortIdx]?.trim()) || 0 : 0
      const feedKg = feedIdx >= 0 ? parseFloat(values[feedIdx]?.trim()) || 0 : 0
      const waterL = waterIdx >= 0 ? parseFloat(values[waterIdx]?.trim()) || 0 : 0
      const notes = notesIdx >= 0 ? values[notesIdx]?.trim() || '' : ''

      if (!date || !batchId || eggs < 0) {
        skipped++
        continue
      }

      // Skip duplicates
      const key = `${date}-${batchId}`
      if (existingDates.has(key)) {
        skipped++
        continue
      }

      existing.push({
        id: `de-${Date.now()}-${i}`,
        date,
        batchId,
        eggsCollected: Math.max(0, eggs),
        eggsBroken: Math.max(0, broken),
        mortality: Math.max(0, mortality),
        feedKg: Math.max(0, feedKg),
        waterLiters: Math.max(0, waterL),
        notes,
      })
      imported++
    }

    if (imported > 0) {
      writeLS(LS_KEYS.dailyEntries, existing)
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
function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeLS(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or unavailable
  }
}

function parseLSArray(key: string): unknown[] {
  try {
    const saved = localStorage.getItem(key)
    if (!saved) return []
    const parsed = JSON.parse(saved)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function ensureArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val
  return []
}

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

// ================================================================
// GET DATA SUMMARY (for the UI)
// ================================================================
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
    hasConfig: !!readLS(LS_KEYS.config),
    batchCount: parseLSArray(LS_KEYS.batches).length,
    recordCount: parseLSArray(LS_KEYS.records).length,
    structuralCount: parseLSArray(LS_KEYS.structural).length,
    dailyEntryCount: parseLSArray(LS_KEYS.dailyEntries).length,
    reminderCount: parseLSArray(LS_KEYS.reminders).length,
    vaccineCount: parseLSArray(LS_KEYS.vaccinations).length,
    feedInventoryCount: parseLSArray(LS_KEYS.feedInventory).length,
  }
}
