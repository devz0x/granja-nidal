import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyFarmAccess, requireSuperadmin } from '@/lib/auth-api'

// Tables to export/import
const DATA_TABLES = [
  'farms', 'batches', 'daily_entries', 'reminders', 'structural_expenses',
  'monthly_records', 'feed_inventory', 'vaccinations', 'cash_flow_entries',
  'invoices', 'shed_logs',
] as const

// GET /api/backup?farm_id=xxx - Export all farm data as JSON
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

  // Fetch farm config specifically
  const { data: farmData } = await supabase
    .from('farms')
    .select('id, name, slug, config, cash_flow_balances')
    .eq('id', farmId)
    .single()

  const backup: Record<string, unknown> = {
    _meta: {
      version: 'v3',
      farm_id: farmId,
      farm_name: farmData?.name || '',
      exported_at: new Date().toISOString(),
      tables: [...DATA_TABLES],
    },
    config: farmData?.config || {},
    cash_flow_balances: farmData?.cash_flow_balances || {},
  }

  // Fetch all data from each table
  for (const table of DATA_TABLES) {
    try {
      let query = supabase.from(table).select('*')

      // For tables with farm_id, filter by farm
      if (table !== 'farms') {
        query = query.eq('farm_id', farmId)
      } else {
        query = query.eq('id', farmId)
      }

      // Limit large tables to prevent memory issues
      if (table === 'daily_entries') {
        query = query.limit(5000)
      }

      const { data, error } = await query
      if (error) {
        // Table might not exist yet - that's ok for backup
        backup[table] = []
        continue
      }
      backup[table] = data || []
    } catch {
      backup[table] = []
    }
  }

  // Calculate approximate size
  const jsonStr = JSON.stringify(backup)
  const sizeBytes = new TextEncoder().encode(jsonStr).length
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2)

  return NextResponse.json({
    backup,
    _stats: {
      size_bytes: sizeBytes,
      size_mb: sizeMB,
      tables: DATA_TABLES.length,
      records: Object.entries(backup)
        .filter(([k]) => !k.startsWith('_'))
        .reduce((sum, [, v]) => sum + (Array.isArray(v) ? v.length : 0), 0),
    },
  })
}

// POST /api/backup?farm_id=xxx - Import/restore data from backup JSON
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  // Only superadmins can import data
  const authResult = await requireSuperadmin()
  if (authResult.error) return authResult.error

  const { searchParams } = new URL(req.url)
  const farmId = searchParams.get('farm_id')
  if (!farmId) {
    return NextResponse.json({ error: 'farm_id es requerido' }, { status: 400 })
  }

  const supabase = createServiceRoleClient()
  const body = await req.json()

  const backupData = body.backup
  if (!backupData || typeof backupData !== 'object') {
    return NextResponse.json({ error: 'Formato de backup invalido' }, { status: 400 })
  }

  // Validate structure
  const meta = backupData._meta
  if (!meta || !meta.version) {
    return NextResponse.json({ error: 'Backup no contiene metadatos validos' }, { status: 400 })
  }

  const results: Record<string, { inserted: number; errors: number }> = {}
  const importMode = body.mode || 'merge' // 'merge' or 'replace'

  for (const table of DATA_TABLES) {
    const records = backupData[table]
    if (!Array.isArray(records) || records.length === 0) {
      results[table] = { inserted: 0, errors: 0 }
      continue
    }

    // Skip farm table - don't overwrite farm metadata
    if (table === 'farms') {
      results[table] = { inserted: 0, errors: 0 }
      continue
    }

    let inserted = 0
    let errors = 0

    if (importMode === 'replace') {
      // Clear existing data first (farms already skipped above)
      await supabase.from(table).delete().eq('farm_id', farmId)
    }

    // Insert records
    for (const record of records) {
      // Ensure farm_id matches current farm
      const recordWithFarm = { ...record, farm_id: farmId }

      // Remove id for insert (let DB generate new UUID to avoid conflicts)
      // unless merging, in which case we upsert
      if (importMode === 'merge') {
        const { error } = await supabase
          .from(table)
          .upsert(recordWithFarm, { onConflict: table === 'daily_entries' ? 'farm_id,batch_id,date' : 'id' })
          .select()
        if (error) {
          errors++
          // Try without the conflict column
          delete (recordWithFarm as Record<string, unknown>).id
          const retryError = await supabase.from(table).insert(recordWithFarm)
          if (retryError.error) errors++
          else inserted++
        } else {
          inserted++
        }
      } else {
        // Replace mode - insert fresh
        delete (recordWithFarm as Record<string, unknown>).id
        delete (recordWithFarm as Record<string, unknown>).created_at
        delete (recordWithFarm as Record<string, unknown>).updated_at
        const { error } = await supabase.from(table).insert(recordWithFarm)
        if (error) {
          errors++
        } else {
          inserted++
        }
      }
    }

    results[table] = { inserted, errors }
  }

  // Restore config if present
  if (backupData.config && typeof backupData.config === 'object') {
    await supabase
      .from('farms')
      .update({ config: backupData.config })
      .eq('id', farmId)
  }

  return NextResponse.json({
    success: true,
    message: 'Restauracion completada',
    mode: importMode,
    results,
  })
}
