import { NextRequest, NextResponse } from 'next/server'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// POST /api/migrate - Migrate all localStorage data to Supabase
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  const body = await req.json()
  const { farm_id, config, batches, daily_entries, reminders, structural_expenses, monthly_records, feed_inventory, vaccinations } = body

  if (!farm_id) {
    return NextResponse.json({ error: 'farm_id is required' }, { status: 400 })
  }

  const results: Record<string, { success: boolean; count: number; error?: string }> = {}

  // 1. Update farm config
  if (config) {
    const { error } = await supabase
      .from('farms')
      .update({ config, updated_at: new Date().toISOString() })
      .eq('id', farm_id)
    results.config = { success: !error, count: error ? 0 : 1, error: error?.message }
  }

  // 2. Migrate batches
  if (batches && batches.length > 0) {
    const batchRows = batches.map((b: Record<string, unknown>, i: number) => ({
      farm_id,
      batch_key: b.id,
      name: b.name,
      hens: b.hens || 2000,
      laying_rate: b.layingRate || 80,
      is_laying: b.isLaying || false,
      cycle_month: b.cycleMonth || 0,
      phase: b.phase || 'pre_inicio',
      sort_order: i,
    }))
    const { data, error } = await supabase
      .from('batches')
      .upsert(batchRows, { onConflict: 'farm_id,batch_key' })
      .select()
    results.batches = { success: !error, count: data?.length || 0, error: error?.message }
  }

  // 3. Migrate daily entries (need batch_id mapping)
  if (daily_entries && daily_entries.length > 0) {
    // First get the batch_key -> batch_uuid mapping
    const { data: existingBatches } = await supabase
      .from('batches')
      .select('id, batch_key')
      .eq('farm_id', farm_id)

    const batchKeyToId: Record<string, string> = {}
    if (existingBatches) {
      existingBatches.forEach((b: { id: string; batch_key: string }) => {
        batchKeyToId[b.batch_key] = b.id
      })
    }

    const entryRows = daily_entries
      .filter((e: Record<string, unknown>) => batchKeyToId[e.batchId as string])
      .map((e: Record<string, unknown>) => ({
        farm_id,
        batch_id: batchKeyToId[e.batchId as string],
        date: e.date,
        eggs_collected: e.eggsCollected || 0,
        eggs_broken: e.eggsBroken || 0,
        mortality: e.mortality || 0,
        feed_kg: e.feedKg || 0,
        water_liters: e.waterLiters || 0,
        notes: e.notes || '',
      }))

    if (entryRows.length > 0) {
      const { data, error } = await supabase
        .from('daily_entries')
        .upsert(entryRows, { onConflict: 'farm_id,batch_id,date' })
        .select()
      results.daily_entries = { success: !error, count: data?.length || 0, error: error?.message }
    } else {
      results.daily_entries = { success: true, count: 0 }
    }
  }

  // 4. Migrate reminders
  if (reminders && reminders.length > 0) {
    const reminderRows = reminders.map((r: Record<string, unknown>) => ({
      farm_id,
      batch_id: null, // Will need mapping, skip for now
      title: r.title,
      description: r.description || '',
      category: r.category || 'otros',
      priority: r.priority || 'media',
      status: r.status || 'pendiente',
      due_date: r.dueDate || null,
      due_time: r.dueTime || '08:00',
      recurrence: r.recurrence || 'unica',
      recurrence_end: r.recurrenceEnd || null,
      completed_at: r.completedAt || null,
      notes: r.notes || '',
      estimated_cost: r.estimatedCost || 0,
      assigned_to: r.assignedTo || '',
      auto_source: r.autoSource || null,
    }))
    const { data, error } = await supabase
      .from('reminders')
      .insert(reminderRows)
      .select()
    results.reminders = { success: !error, count: data?.length || 0, error: error?.message }
  }

  // 5. Migrate structural expenses
  if (structural_expenses && structural_expenses.length > 0) {
    const expenseRows = structural_expenses.map((e: Record<string, unknown>, i: number) => ({
      farm_id,
      description: e.description || '',
      amount: e.amount || 0,
      frequency: e.frequency || 'unico',
      is_active: e.isActive !== undefined ? e.isActive : true,
      sort_order: i,
    }))
    const { data, error } = await supabase
      .from('structural_expenses')
      .insert(expenseRows)
      .select()
    results.structural_expenses = { success: !error, count: data?.length || 0, error: error?.message }
  }

  // 6. Migrate monthly records
  if (monthly_records && monthly_records.length > 0) {
    const recordRows = monthly_records.map((r: Record<string, unknown>) => ({
      farm_id,
      month: r.month,
      record_date: r.date,
      batches_snapshot: r.batches || [],
      config_snapshot: r.config || {},
      notes: r.notes || '',
      revenue: r.revenue || 0,
      expenses: r.expenses || 0,
      net: r.net || 0,
    }))
    const { data, error } = await supabase
      .from('monthly_records')
      .insert(recordRows)
      .select()
    results.monthly_records = { success: !error, count: data?.length || 0, error: error?.message }
  }

  // 7. Migrate feed inventory
  if (feed_inventory && feed_inventory.length > 0) {
    const feedRows = feed_inventory.map((f: Record<string, unknown>) => ({
      farm_id,
      phase_key: f.phaseKey,
      phase: f.phase,
      current_stock_kg: f.currentStockKg || 0,
      reorder_level_kg: f.reorderLevelKg || 0,
      last_purchase: f.lastPurchase || null,
      supplier: f.supplier || '',
      price_per_quintal: f.pricePerQuintal || 0,
    }))
    const { data, error } = await supabase
      .from('feed_inventory')
      .upsert(feedRows, { onConflict: 'farm_id,phase_key' })
      .select()
    results.feed_inventory = { success: !error, count: data?.length || 0, error: error?.message }
  }

  // 8. Migrate vaccinations
  if (vaccinations && vaccinations.length > 0) {
    const vacRows = vaccinations.map((v: Record<string, unknown>) => ({
      farm_id,
      batch_id: null, // Need mapping
      shed_id: v.shedId || '',
      cycle_number: v.cycleNumber || 1,
      vaccine_name: v.vaccineName,
      date_applied: v.dateApplied || null,
      age_weeks: v.ageWeeks || 0,
      next_dose: v.nextDose || null,
      applied_by: v.appliedBy || '',
      via: v.via || 'Ocular',
      dosage: v.dosage || '',
      lot_number: v.lotNumber || '',
      status: v.status || 'programada',
      notes: v.notes || '',
    }))
    const { data, error } = await supabase
      .from('vaccinations')
      .insert(vacRows)
      .select()
    results.vaccinations = { success: !error, count: data?.length || 0, error: error?.message }
  }

  return NextResponse.json({ success: true, results })
}
