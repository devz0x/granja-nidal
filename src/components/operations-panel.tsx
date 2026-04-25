'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Droplets, TrendingDown, Egg, Wheat, ClipboardCheck, AlertTriangle, CheckCircle2, Info, Plus, Trash2,
  Edit3, Save, X, Syringe, Heart, Calendar, Shield, Clipboard, ChevronDown, ChevronUp,
} from 'lucide-react'
import { getFarmId } from '@/lib/supabase'

// ================================================================
// TYPES
// ================================================================
interface DailyProductionEntry {
  id: string
  date: string
  batchId: string
  eggsCollected: number
  eggsBroken: number
  mortality: number
  feedKg: number
  waterLiters: number
  notes: string
}

interface VaccinationRecord {
  id: string
  batchId: string
  shedId: string
  cycleNumber: number
  vaccineName: string
  dateApplied: string
  ageWeeks: number
  nextDose: string
  appliedBy: string
  via: string
  dosage: string
  lotNumber: string
  status: 'aplicada' | 'programada' | 'vencida'
  notes: string
}

interface FeedInventory {
  id: string
  phaseKey: string
  phase: string
  currentStockKg: number
  reorderLevelKg: number
  lastPurchase: string
  supplier: string
  pricePerQuintal: number
}

// ================================================================
// SUPABASE MAPPING HELPERS
// ================================================================
function mapDailyEntryFromDB(r: Record<string, unknown>): DailyProductionEntry {
  return {
    id: r.id as string,
    date: (r.date || '') as string,
    batchId: (r.batch_id || '') as string,
    eggsCollected: (r.eggs_collected || 0) as number,
    eggsBroken: (r.eggs_broken || 0) as number,
    mortality: (r.mortality || 0) as number,
    feedKg: (r.feed_kg || 0) as number,
    waterLiters: (r.water_liters || 0) as number,
    notes: (r.notes || '') as string,
  }
}

function mapVaccinationFromDB(r: Record<string, unknown>): VaccinationRecord {
  return {
    id: r.id as string,
    batchId: (r.batch_id || '') as string,
    shedId: (r.shed_id || '') as string,
    cycleNumber: (r.cycle_number || 1) as number,
    vaccineName: (r.vaccine_name || '') as string,
    dateApplied: (r.date_applied || '') as string,
    ageWeeks: (r.age_weeks || 0) as number,
    nextDose: (r.next_dose || '') as string,
    appliedBy: (r.applied_by || '') as string,
    via: (r.via || 'Ocular') as string,
    dosage: (r.dosage || '') as string,
    lotNumber: (r.lot_number || '') as string,
    status: (r.status || 'programada') as 'aplicada' | 'programada' | 'vencida',
    notes: (r.notes || '') as string,
  }
}

function mapFeedInventoryFromDB(r: Record<string, unknown>, configFeedPhases: Record<string, { price: number }>): FeedInventory {
  return {
    id: r.id as string,
    phaseKey: (r.phase_key || '') as string,
    phase: (r.phase || '') as string,
    currentStockKg: (r.current_stock_kg || 0) as number,
    reorderLevelKg: (r.reorder_level_kg || 0) as number,
    lastPurchase: (r.last_purchase || '') as string,
    supplier: (r.supplier || '') as string,
    pricePerQuintal: (r.price_per_quintal || configFeedPhases[(r.phase_key as string) || 'postura']?.price || 0) as number,
  }
}

// ================================================================
// OPERATIONS COMPONENT
// ================================================================
interface OperationsProps {
  batches: { id: string; name: string; hens: number; phase: string; layingRate: number; isLaying: boolean; cycleMonth: number }[]
  config: {
    feedPhases: Record<string, { label: string; consumption: number; price: number; weeks: string }>
    hensPerBatch: number
    baseLayingRate: number
  }
  fmtRD: (v: number) => string
  fmtNum: (v: number) => string
  batchId?: string | null
}

const ALL_FEED_PHASES = [
  { key: 'pre_inicio', label: 'Pre-Inicio', defaultStock: 300, defaultReorder: 200 },
  { key: 'inicio', label: 'Inicio', defaultStock: 500, defaultReorder: 300 },
  { key: 'crecimiento', label: 'Crecimiento', defaultStock: 1500, defaultReorder: 800 },
  { key: 'pre_postura', label: 'Pre-Postura', defaultStock: 800, defaultReorder: 400 },
  { key: 'postura', label: 'Postura', defaultStock: 5000, defaultReorder: 2000 },
]

function getDefaultVaccineSchedule(batchId: string, shedId: string, cycleNumber: number): VaccinationRecord[] {
  return [
    { id: `${batchId}-vac-1`, batchId, shedId, cycleNumber, vaccineName: 'Newcastle (B1)', dateApplied: '', ageWeeks: 1, nextDose: '', appliedBy: '', via: 'Ocular', dosage: '1 gota', lotNumber: '', status: 'programada', notes: 'Primera dosis Newcastle' },
    { id: `${batchId}-vac-2`, batchId, shedId, cycleNumber, vaccineName: 'Gumboro', dateApplied: '', ageWeeks: 1, nextDose: '', appliedBy: '', via: 'Agua bebida', dosage: 'Segun fabricante', lotNumber: '', status: 'programada', notes: 'Primera dosis Gumboro' },
    { id: `${batchId}-vac-3`, batchId, shedId, cycleNumber, vaccineName: 'Bronquitis Infecciosa', dateApplied: '', ageWeeks: 2, nextDose: '', appliedBy: '', via: 'Ocular', dosage: '1 gota', lotNumber: '', status: 'programada', notes: '' },
    { id: `${batchId}-vac-4`, batchId, shedId, cycleNumber, vaccineName: 'Newcastle (B1 refuerzo)', dateApplied: '', ageWeeks: 3, nextDose: '', appliedBy: '', via: 'Ocular', dosage: '1 gota', lotNumber: '', status: 'programada', notes: 'Refuerzo' },
    { id: `${batchId}-vac-5`, batchId, shedId, cycleNumber, vaccineName: 'Gumboro (refuerzo)', dateApplied: '', ageWeeks: 3, nextDose: '', appliedBy: '', via: 'Agua bebida', dosage: 'Segun fabricante', lotNumber: '', status: 'programada', notes: '' },
    { id: `${batchId}-vac-6`, batchId, shedId, cycleNumber, vaccineName: 'Newcastle (Lasota)', dateApplied: '', ageWeeks: 6, nextDose: '', appliedBy: '', via: 'Agua bebida', dosage: 'Segun fabricante', lotNumber: '', status: 'programada', notes: '' },
    { id: `${batchId}-vac-7`, batchId, shedId, cycleNumber, vaccineName: 'Coriza Infecciosa', dateApplied: '', ageWeeks: 5, nextDose: '', appliedBy: '', via: 'Inyectable', dosage: '0.5 ml', lotNumber: '', status: 'programada', notes: '' },
    { id: `${batchId}-vac-8`, batchId, shedId, cycleNumber, vaccineName: 'Encefalomielitis', dateApplied: '', ageWeeks: 8, nextDose: '', appliedBy: '', via: 'Ala', dosage: '0.5 ml', lotNumber: '', status: 'programada', notes: '' },
    { id: `${batchId}-vac-9`, batchId, shedId, cycleNumber, vaccineName: 'Gumboro (refuerzo final)', dateApplied: '', ageWeeks: 14, nextDose: '', appliedBy: '', via: 'Agua bebida', dosage: 'Segun fabricante', lotNumber: '', status: 'programada', notes: '' },
  ]
}

export default function OperationsPanel({ batches, config, fmtRD, fmtNum, batchId: propBatchId }: OperationsProps) {
  const today = new Date().toISOString().split('T')[0]
  const farmId = getFarmId()
  const [loading, setLoading] = useState(true)

  // --- State ---
  const [dailyEntries, setDailyEntries] = useState<DailyProductionEntry[]>([])
  const [newEntry, setNewEntry] = useState<Partial<DailyProductionEntry>>({})

  const [feedInventory, setFeedInventory] = useState<FeedInventory[]>([])

  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([])

  // Vaccination UI state
  const [editingVaccine, setEditingVaccine] = useState<string | null>(null)
  const [editVaccineData, setEditVaccineData] = useState<Partial<VaccinationRecord>>({})
  const [vaccineFilterBatch, setVaccineFilterBatch] = useState<string>('all')
  const [vaccineFilterStatus, setVaccineFilterStatus] = useState<string>('all')
  const [vaccineFilterShed, setVaccineFilterShed] = useState<string>('all')
  const [showVaccineForm, setShowVaccineForm] = useState(false)
  const [newVaccine, setNewVaccine] = useState<Partial<VaccinationRecord>>({
    status: 'programada', via: 'Ocular', dosage: '', lotNumber: '', cycleNumber: 1, shedId: '',
  })

  // ================================================================
  // FETCH FROM SUPABASE
  // ================================================================
  const fetchAllData = useCallback(async () => {
    if (!farmId) return
    try {
      const filterBatch = propBatchId || undefined
      const [dailyUrl, vacUrl] = [
        `/api/daily-entries?farm_id=${farmId}&limit=500${filterBatch ? `&batch_id=${filterBatch}` : ''}`,
        `/api/vaccinations?farm_id=${farmId}${filterBatch ? `&batch_id=${filterBatch}` : ''}`,
      ]
      const [dailyRes, vacRes, feedRes] = await Promise.all([
        fetch(dailyUrl).then(r => r.ok ? r.json() : null),
        fetch(vacUrl).then(r => r.ok ? r.json() : null),
        fetch(`/api/feed-inventory?farm_id=${farmId}`).then(r => r.ok ? r.json() : null),
      ])

      if (dailyRes?.entries) {
        const mapped = dailyRes.entries.map((e: Record<string, unknown>) => {
          const entry = mapDailyEntryFromDB(e)
          const batch = batches.find(b => b.id === entry.batchId)
          return { ...entry, batchId: entry.batchId, notes: entry.notes }
        })
        setDailyEntries(mapped)
      }

      if (vacRes?.vaccinations) {
        setVaccinationRecords(vacRes.vaccinations.map((v: Record<string, unknown>) => mapVaccinationFromDB(v)))
      }

      if (feedRes?.inventory) {
        const mapped = feedRes.inventory.map((f: Record<string, unknown>) => mapFeedInventoryFromDB(f, config.feedPhases))
        // Ensure all 5 phases exist
        const merged = ALL_FEED_PHASES.map(phase => {
          const existing = mapped.find(fi => fi.phaseKey === phase.key)
          if (existing) return { ...existing, phase: phase.label, phaseKey: phase.key }
          return {
            id: `fi-${phase.key}`, phaseKey: phase.key, phase: phase.label,
            currentStockKg: phase.defaultStock, reorderLevelKg: phase.defaultReorder,
            lastPurchase: '', supplier: 'Nutriovo Sanut',
            pricePerQuintal: config.feedPhases[phase.key]?.price || 0,
          }
        })
        setFeedInventory(merged)
      } else {
        // No data in DB yet — use defaults
        setFeedInventory(ALL_FEED_PHASES.map(phase => ({
          id: `fi-${phase.key}`, phaseKey: phase.key, phase: phase.label,
          currentStockKg: phase.defaultStock, reorderLevelKg: phase.defaultReorder,
          lastPurchase: '', supplier: 'Nutriovo Sanut',
          pricePerQuintal: config.feedPhases[phase.key]?.price || 0,
        })))
      }
    } catch (err) {
      console.error('Failed to fetch operations data:', err)
    } finally {
      setLoading(false)
    }
  }, [farmId, propBatchId, batches, config.feedPhases])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // Auto-update feed inventory prices from config
  useEffect(() => {
    setFeedInventory(prev => prev.map(fi => ({
      ...fi,
      pricePerQuintal: config.feedPhases[fi.phaseKey]?.price || fi.pricePerQuintal,
    })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.feedPhases])

  // --- Derived calculations ---
  const layingBatches = batches.filter(b => b.isLaying)
  const expectedDailyEggs = layingBatches.reduce((s, b) => s + Math.round(b.hens * (b.layingRate / 100)), 0)
  const expectedDailyFeed = batches.reduce((s, b) => {
    const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
    if (!feed) return s
    return s + (b.hens * feed.consumption * 30 / 1000 / 30)
  }, 0)
  const totalHens = batches.reduce((s, b) => s + b.hens, 0)
  const expectedWaterLiters = totalHens * 0.25

  const feedAlerts = feedInventory.filter(fi => fi.currentStockKg <= fi.reorderLevelKg)
  const avgProduction = useMemo(() => {
    if (dailyEntries.length === 0) return null
    const total = dailyEntries.reduce((s, e) => s + e.eggsCollected, 0)
    return Math.round(total / dailyEntries.length)
  }, [dailyEntries])
  const avgMortality = useMemo(() => {
    if (dailyEntries.length === 0) return null
    const total = dailyEntries.reduce((s, e) => s + e.mortality, 0)
    return (total / dailyEntries.length).toFixed(1)
  }, [dailyEntries])

  // Vaccination stats
  const vacStats = useMemo(() => {
    const applied = vaccinationRecords.filter(v => v.status === 'aplicada').length
    const programmed = vaccinationRecords.filter(v => v.status === 'programada').length
    const overdueDoses = vaccinationRecords.filter(v => {
      if (v.nextDose && v.status === 'aplicada') {
        return new Date(v.nextDose) < new Date() && new Date(v.nextDose) > new Date(v.dateApplied)
      }
      return false
    }).length
    return { applied, programmed, overdue: overdueDoses, total: vaccinationRecords.length }
  }, [vaccinationRecords])

  const filteredVaccines = useMemo(() => {
    return vaccinationRecords.filter(v => {
      if (vaccineFilterBatch !== 'all' && v.batchId !== vaccineFilterBatch) return false
      if (vaccineFilterStatus !== 'all' && v.status !== vaccineFilterStatus) return false
      if (vaccineFilterShed !== 'all' && v.shedId !== vaccineFilterShed) return false
      return true
    })
  }, [vaccinationRecords, vaccineFilterBatch, vaccineFilterStatus, vaccineFilterShed])

  const vaccinesByBatch = useMemo(() => {
    const grouped: Record<string, VaccinationRecord[]> = {}
    vaccinationRecords.forEach(v => {
      if (!grouped[v.batchId]) grouped[v.batchId] = []
      grouped[v.batchId].push(v)
    })
    return grouped
  }, [vaccinationRecords])

  // ================================================================
  // CRUD: Daily Entries (Supabase API)
  // ================================================================
  const addDailyEntry = async () => {
    if (!newEntry.batchId) { alert('Selecciona un lote para registrar la produccion.'); return }
    if (!newEntry.eggsCollected && newEntry.eggsCollected !== 0) { alert('Ingresa la cantidad de huevos recogidos.'); return }
    if (newEntry.eggsCollected < 0) { alert('Los huevos recogidos no pueden ser negativos.'); return }
    if (newEntry.eggsBroken && newEntry.eggsBroken < 0) { alert('Los huevos rotos no pueden ser negativos.'); return }
    if (newEntry.mortality && newEntry.mortality < 0) { alert('La mortalidad no puede ser negativa.'); return }
    if (newEntry.eggsBroken && newEntry.eggsCollected && newEntry.eggsBroken > newEntry.eggsCollected) { alert('Los huevos rotos no pueden superar los huevos recogidos.'); return }

    if (!farmId) return
    try {
      const res = await fetch(`/api/daily-entries?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: newEntry.batchId,
          date: newEntry.date || today,
          eggs_collected: newEntry.eggsCollected || 0,
          eggs_broken: newEntry.eggsBroken || 0,
          mortality: newEntry.mortality || 0,
          feed_kg: newEntry.feedKg || 0,
          water_liters: newEntry.waterLiters || 0,
          notes: newEntry.notes || '',
        }),
      })
      if (res.ok) {
        setNewEntry({})
        fetchAllData()
      }
    } catch { /* ignore */ }
  }

  const removeDailyEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/daily-entries/${id}`, { method: 'DELETE' })
      if (res.ok) fetchAllData()
    } catch { /* ignore */ }
  }

  // ================================================================
  // CRUD: Feed Inventory (Supabase API)
  // ================================================================
  const updateFeedInventory = async (fi: FeedInventory) => {
    if (!farmId) return
    try {
      await fetch(`/api/feed-inventory?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_key: fi.phaseKey,
          phase: fi.phase,
          current_stock_kg: fi.currentStockKg,
          reorder_level_kg: fi.reorderLevelKg,
          last_purchase: fi.lastPurchase || null,
          supplier: fi.supplier,
          price_per_quintal: fi.pricePerQuintal,
        }),
      })
      fetchAllData()
    } catch { /* ignore */ }
  }

  // ================================================================
  // CRUD: Vaccinations (Supabase API)
  // ================================================================
  const addVaccination = async () => {
    if (!newVaccine.batchId) { alert('Selecciona un lote para la vacuna.'); return }
    if (!newVaccine.vaccineName || !newVaccine.vaccineName.trim()) { alert('Ingresa el nombre de la vacuna.'); return }
    if (!farmId) return

    try {
      const res = await fetch(`/api/vaccinations?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: newVaccine.batchId || '',
          shed_id: newVaccine.shedId || batches.find(b => b.id === newVaccine.batchId)?.name || '',
          cycle_number: newVaccine.cycleNumber || 1,
          vaccine_name: newVaccine.vaccineName || '',
          date_applied: newVaccine.dateApplied || null,
          age_weeks: newVaccine.ageWeeks || 0,
          next_dose: newVaccine.nextDose || null,
          applied_by: newVaccine.appliedBy || '',
          via: newVaccine.via || 'Ocular',
          dosage: newVaccine.dosage || '',
          lot_number: newVaccine.lotNumber || '',
          status: newVaccine.status || 'programada',
          notes: newVaccine.notes || '',
        }),
      })
      if (res.ok) {
        setNewVaccine({ status: 'programada', via: 'Ocular', dosage: '', lotNumber: '', cycleNumber: 1, shedId: '' })
        setShowVaccineForm(false)
        fetchAllData()
      }
    } catch { /* ignore */ }
  }

  const startEditVaccine = (id: string) => {
    const vac = vaccinationRecords.find(v => v.id === id)
    if (!vac) return
    setEditingVaccine(id)
    setEditVaccineData({ ...vac })
  }

  const saveEditVaccine = async () => {
    if (!editingVaccine || !farmId) return
    try {
      const res = await fetch(`/api/vaccinations/${editingVaccine}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: editVaccineData.batchId,
          shed_id: editVaccineData.shedId,
          cycle_number: editVaccineData.cycleNumber,
          vaccine_name: editVaccineData.vaccineName,
          date_applied: editVaccineData.dateApplied || null,
          age_weeks: editVaccineData.ageWeeks,
          next_dose: editVaccineData.nextDose || null,
          applied_by: editVaccineData.appliedBy,
          via: editVaccineData.via,
          dosage: editVaccineData.dosage,
          lot_number: editVaccineData.lotNumber,
          status: editVaccineData.status,
          notes: editVaccineData.notes,
        }),
      })
      if (res.ok) {
        setEditingVaccine(null)
        setEditVaccineData({})
        fetchAllData()
      }
    } catch { /* ignore */ }
  }

  const cancelEditVaccine = () => {
    setEditingVaccine(null)
    setEditVaccineData({})
  }

  const removeVaccination = async (id: string) => {
    try {
      const res = await fetch(`/api/vaccinations/${id}`, { method: 'DELETE' })
      if (res.ok) {
        if (editingVaccine === id) cancelEditVaccine()
        fetchAllData()
      }
    } catch { /* ignore */ }
  }

  const markAsApplied = async (id: string) => {
    if (!farmId) return
    const vac = vaccinationRecords.find(v => v.id === id)
    if (!vac) return
    try {
      const res = await fetch(`/api/vaccinations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...mapVaccinationToDB(vac),
          status: 'aplicada',
          date_applied: vac.dateApplied || today,
        }),
      })
      if (res.ok) fetchAllData()
    } catch { /* ignore */ }
  }

  const generateScheduleForBatch = async (targetBatchId: string) => {
    const batch = batches.find(b => b.id === targetBatchId)
    if (!batch || !farmId) return
    const existing = vaccinationRecords.filter(v => v.batchId === targetBatchId)
    if (existing.length > 0) {
      if (!confirm(`El lote ${batch.name} ya tiene ${existing.length} vacunas registradas. Deseas reemplazarlas con el plan por defecto?`)) return
      // Delete existing
      for (const v of existing) {
        await fetch(`/api/vaccinations/${v.id}`, { method: 'DELETE' }).catch(() => {})
      }
    }
    const newSchedule = getDefaultVaccineSchedule(targetBatchId, batch.name, 1)
    try {
      await fetch(`/api/vaccinations?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaccinations: newSchedule.map(v => ({
            batch_id: v.batchId,
            shed_id: v.shedId,
            cycle_number: v.cycleNumber,
            vaccine_name: v.vaccineName,
            date_applied: null,
            age_weeks: v.ageWeeks,
            next_dose: null,
            applied_by: '',
            via: v.via,
            dosage: v.dosage,
            lot_number: v.lotNumber,
            status: v.status,
            notes: v.notes,
          })),
        }),
      })
      fetchAllData()
    } catch { /* ignore */ }
  }

  const duplicateScheduleFromBatch = async (sourceBatchId: string, targetBatchId: string) => {
    const sourceVacs = vaccinationRecords.filter(v => v.batchId === sourceBatchId)
    if (sourceVacs.length === 0 || !farmId) return
    const targetBatch = batches.find(b => b.id === targetBatchId)
    const existing = vaccinationRecords.filter(v => v.batchId === targetBatchId)
    if (existing.length > 0) {
      if (!confirm(`El lote ${targetBatch?.name} ya tiene vacunas. Deseas reemplazarlas?`)) return
      for (const v of existing) {
        await fetch(`/api/vaccinations/${v.id}`, { method: 'DELETE' }).catch(() => {})
      }
    }
    try {
      await fetch(`/api/vaccinations?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaccinations: sourceVacs.map(v => ({
            batch_id: targetBatchId,
            shed_id: targetBatch?.name || '',
            cycle_number: v.cycleNumber,
            vaccine_name: v.vaccineName,
            date_applied: null,
            age_weeks: v.ageWeeks,
            next_dose: null,
            applied_by: '',
            via: v.via,
            dosage: v.dosage,
            lot_number: v.lotNumber,
            status: 'programada',
            notes: v.notes,
          })),
        }),
      })
      fetchAllData()
    } catch { /* ignore */ }
  }

  const clearVaccinesForBatch = async (targetBatchId: string) => {
    const batch = batches.find(b => b.id === targetBatchId)
    if (!confirm(`Eliminar todas las vacunas del lote ${batch?.name}?`)) return
    const toDelete = vaccinationRecords.filter(v => v.batchId === targetBatchId)
    for (const v of toDelete) {
      await fetch(`/api/vaccinations/${v.id}`, { method: 'DELETE' }).catch(() => {})
    }
    fetchAllData()
  }

  // ================================================================
  // RENDER
  // ================================================================
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-center py-10 text-stone-400">
          <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin mr-3" />
          <span className="text-sm">Cargando datos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* --- Alertas Rapidas --- */}
      {feedAlerts.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-sm text-orange-800">
            <strong>Alerta de inventario:</strong> {feedAlerts.map(a => a.phase).join(', ')} — stock por debajo del nivel de reorden. Programa compra inmediata.
          </AlertDescription>
        </Alert>
      )}

      {/* --- RESUMEN OPERACIONAL --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Egg className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-medium text-stone-500">Produccion Esperada</span>
            </div>
            <p className="text-lg font-bold text-green-700">{fmtNum(expectedDailyEggs)}/dia</p>
            {avgProduction && (
              <p className="text-[10px] text-stone-400">Real promedio: {fmtNum(avgProduction)}/dia</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wheat className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-medium text-stone-500">Consumo Feed/Dia</span>
            </div>
            <p className="text-lg font-bold text-amber-700">{fmtNum(Math.round(expectedDailyFeed))} kg</p>
            <p className="text-[10px] text-stone-400">{fmtNum(totalHens)} aves alimentadas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-sky-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Droplets className="w-3.5 h-3.5 text-sky-600" />
              <span className="text-[10px] font-medium text-stone-500">Agua Estimada</span>
            </div>
            <p className="text-lg font-bold text-sky-700">{fmtNum(Math.round(expectedWaterLiters))} L</p>
            <p className="text-[10px] text-stone-400">~250ml/ave/dia</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Syringe className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[10px] font-medium text-stone-500">Vacunacion</span>
            </div>
            <p className="text-lg font-bold text-violet-700">{vacStats.applied}/{vacStats.total}</p>
            <p className="text-[10px] text-stone-400">{vacStats.programmed} programadas</p>
          </CardContent>
        </Card>
      </div>

      {/* --- REGISTRO DIARIO DE PRODUCCION --- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-green-600" />
            Registro Diario de Produccion
          </CardTitle>
          <CardDescription className="text-[11px]">Registra huevos, mortalidad, consumo de feed y agua por lote.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-[10px]">Fecha</Label>
              <Input type="date" value={newEntry.date || today}
                onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Lote</Label>
              <select value={newEntry.batchId || ''} onChange={e => setNewEntry(p => ({ ...p, batchId: e.target.value }))}
                className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full">
                <option value="">Seleccionar...</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Huevos recogidos</Label>
              <Input type="number" value={newEntry.eggsCollected || ''} onChange={e => setNewEntry(p => ({ ...p, eggsCollected: parseInt(e.target.value) || 0 }))}
                className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Huevos rotos</Label>
              <Input type="number" value={newEntry.eggsBroken || ''} onChange={e => setNewEntry(p => ({ ...p, eggsBroken: parseInt(e.target.value) || 0 }))}
                className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Mortalidad</Label>
              <Input type="number" value={newEntry.mortality || ''} onChange={e => setNewEntry(p => ({ ...p, mortality: parseInt(e.target.value) || 0 }))}
                className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Feed (kg)</Label>
              <Input type="number" value={newEntry.feedKg || ''} onChange={e => setNewEntry(p => ({ ...p, feedKg: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs" placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Agua (L)</Label>
              <Input type="number" value={newEntry.waterLiters || ''} onChange={e => setNewEntry(p => ({ ...p, waterLiters: parseFloat(e.target.value) || 0 }))}
                className="h-8 text-xs" placeholder="0" />
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[10px]">Notas</Label>
              <Input type="text" value={newEntry.notes || ''} onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))}
                className="h-8 text-xs" placeholder="Observaciones del dia..." />
            </div>
            <Button size="sm" onClick={addDailyEntry} className="gap-1 text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Registrar
            </Button>
          </div>

          {dailyEntries.length > 0 && (
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Lote</TableHead>
                    <TableHead className="text-[10px] text-right">Huevos</TableHead>
                    <TableHead className="text-[10px] text-right">Rotos</TableHead>
                    <TableHead className="text-[10px] text-right">Mort.</TableHead>
                    <TableHead className="text-[10px] text-right">Feed(kg)</TableHead>
                    <TableHead className="text-[10px] text-right">Agua(L)</TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyEntries.map(entry => {
                    const batch = batches.find(b => b.id === entry.batchId)
                    const expected = batch?.isLaying ? Math.round(batch.hens * (batch.layingRate / 100)) : 0
                    const pct = expected > 0 ? ((entry.eggsCollected / expected) * 100).toFixed(0) : '-'
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-[11px]">{entry.date}</TableCell>
                        <TableCell className="text-[11px]">{batch?.name || '-'}</TableCell>
                        <TableCell className="text-[11px] text-right font-medium">{fmtNum(entry.eggsCollected)} <span className="text-stone-400">({pct}%)</span></TableCell>
                        <TableCell className="text-[11px] text-right text-red-500">{entry.eggsBroken || '-'}</TableCell>
                        <TableCell className="text-[11px] text-right text-red-600 font-medium">{entry.mortality || '-'}</TableCell>
                        <TableCell className="text-[11px] text-right">{entry.feedKg || '-'}</TableCell>
                        <TableCell className="text-[11px] text-right">{entry.waterLiters || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-stone-300 hover:text-red-500"
                            onClick={() => removeDailyEntry(entry.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {dailyEntries.length === 0 && (
            <div className="text-center py-6 text-stone-400">
              <ClipboardCheck className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Sin registros de produccion. Agrega el primero arriba.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- INVENTARIO DE ALIMENTO --- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wheat className="w-4 h-4 text-amber-600" />
            Inventario de Alimento
            <Badge variant="outline" className="text-[9px] ml-1">5 fases</Badge>
          </CardTitle>
          <CardDescription className="text-[11px]">Control de stock actual y niveles de reorden por tipo de alimento. Precios sincronizados con Sanut.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Fase</TableHead>
                  <TableHead className="text-[10px]">Semanas</TableHead>
                  <TableHead className="text-[10px] text-right">Stock (kg)</TableHead>
                  <TableHead className="text-[10px] text-right">Reorden (kg)</TableHead>
                  <TableHead className="text-[10px] text-right">Precio/qq</TableHead>
                  <TableHead className="text-[10px]">Estado</TableHead>
                  <TableHead className="text-[10px] text-right">Dias est.</TableHead>
                  <TableHead className="text-[10px]">Aves en fase</TableHead>
                  <TableHead className="text-[10px] text-right">Costo/mes est.</TableHead>
                  <TableHead className="text-[10px]">Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedInventory.map(fi => {
                  const isLow = fi.currentStockKg <= fi.reorderLevelKg
                  const isCritical = fi.currentStockKg <= fi.reorderLevelKg * 0.5
                  const phaseBatches = batches.filter(b => b.phase === fi.phaseKey)
                  const hensInPhase = phaseBatches.reduce((s, b) => s + b.hens, 0)
                  const feed = config.feedPhases[fi.phaseKey as keyof typeof config.feedPhases]
                  const dailyCons = phaseBatches.reduce((s, b) => {
                    return s + (feed ? b.hens * feed.consumption / 1000 : 0)
                  }, 0)
                  const daysLeft = dailyCons > 0 ? Math.round(fi.currentStockKg / dailyCons) : (fi.currentStockKg > 0 ? 999 : 0)
                  const monthlyCost = dailyCons * 30 * (fi.pricePerQuintal / 100)
                  const consumptionG = feed?.consumption || 0
                  const weeks = feed?.weeks || '-'
                  return (
                    <TableRow key={fi.id} className={isCritical ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}>
                      <TableCell className="text-xs font-medium">
                        <div className="flex items-center gap-1">
                          {fi.phase}
                          {hensInPhase > 0 && (
                            <Badge className="bg-green-100 text-green-700 text-[8px] px-1 py-0">ACTIVA</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-stone-500">{weeks}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Input type="number" value={fi.currentStockKg}
                          onChange={e => {
                            const updated = { ...fi, currentStockKg: parseFloat(e.target.value) || 0 }
                            setFeedInventory(prev => prev.map(f => f.id === fi.id ? updated : f))
                          }}
                          onBlur={() => updateFeedInventory({ ...fi })}
                          className="w-20 h-7 text-xs text-right mx-auto" />
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Input type="number" value={fi.reorderLevelKg}
                          onChange={e => {
                            const updated = { ...fi, reorderLevelKg: parseFloat(e.target.value) || 0 }
                            setFeedInventory(prev => prev.map(f => f.id === fi.id ? updated : f))
                          }}
                          onBlur={() => updateFeedInventory({ ...fi })}
                          className="w-20 h-7 text-xs text-right mx-auto" />
                      </TableCell>
                      <TableCell className="text-[10px] text-right font-medium">{fmtRD(fi.pricePerQuintal)}</TableCell>
                      <TableCell>
                        {isCritical ? (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">CRITICO</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">REORDENAR</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : daysLeft === 0 ? 'text-stone-400' : 'text-green-700'}`}>
                        {daysLeft === 999 ? 'N/A' : daysLeft === 0 ? '-' : `~${daysLeft}d`}
                      </TableCell>
                      <TableCell className="text-[10px] text-center">{hensInPhase > 0 ? `${fmtNum(hensInPhase)} (${consumptionG}g/d)` : <span className="text-stone-300">0</span>}</TableCell>
                      <TableCell className="text-[10px] text-right font-medium">{monthlyCost > 0 ? fmtRD(monthlyCost) : '-'}</TableCell>
                      <TableCell className="text-[10px] text-stone-500">{fi.supplier}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-stone-50 rounded-lg">
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Stock Total</p>
              <p className="text-sm font-bold">{fmtNum(feedInventory.reduce((s, f) => s + f.currentStockKg, 0))} kg</p>
            </div>
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Fases Activas</p>
              <p className="text-sm font-bold">{feedInventory.filter(fi => batches.some(b => b.phase === fi.phaseKey)).length} de {feedInventory.length}</p>
            </div>
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Consumo Diario Total</p>
              <p className="text-sm font-bold">{fmtNum(Math.round(expectedDailyFeed))} kg</p>
            </div>
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Fases con Alerta</p>
              <p className="text-sm font-bold text-red-600">{feedAlerts.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* --- CALENDARIO DE VACUNACION Y SALUD --- */}
      <Card className="border-violet-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Syringe className="w-4 h-4 text-violet-600" />
                Calendario de Vacunacion y Salud
              </CardTitle>
              <CardDescription className="text-[11px] mt-1">
                Registro editable por lote, galpon y ciclo. Agrega, edita o elimina vacunas segun el plan de tu veterinario.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7"
                onClick={() => {
                  const targetId = prompt('Selecciona el lote ID para generar plan (ej: batch-0):')
                  if (targetId) generateScheduleForBatch(targetId)
                }}>
                <Clipboard className="w-3 h-3" /> Generar Plan
              </Button>
              <Button variant="outline" size="sm" className="gap-1 text-[10px] h-7"
                onClick={() => setShowVaccineForm(!showVaccineForm)}>
                <Plus className="w-3 h-3" /> Agregar Vacuna
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Batch summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {batches.map(b => {
              const batchVacs = vaccinesByBatch[b.id] || []
              const applied = batchVacs.filter(v => v.status === 'aplicada').length
              const programmed = batchVacs.filter(v => v.status === 'programada').length
              return (
                <div key={b.id} className="border rounded-lg p-2 bg-stone-50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-stone-700">{b.name}</span>
                    <Badge variant="outline" className="text-[8px]">{b.phase.replace('_', ' ')}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-green-600">{applied} aplicadas</span>
                    <span className="text-amber-600">{programmed} pendientes</span>
                  </div>
                  {batchVacs.length === 0 && (
                    <button
                      onClick={() => generateScheduleForBatch(b.id)}
                      className="mt-1 text-[9px] text-violet-600 hover:underline cursor-pointer"
                    >
                      + Generar plan vacunal
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add vaccine form */}
          {showVaccineForm && (
            <div className="border border-dashed border-violet-300 bg-violet-50/40 rounded-lg p-3 mb-3">
              <h4 className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
                <Plus className="w-3 h-3 text-violet-600" /> Nueva Vacuna
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">Lote *</Label>
                  <select value={newVaccine.batchId || ''}
                    onChange={e => {
                      const batch = batches.find(b => b.id === e.target.value)
                      setNewVaccine(p => ({ ...p, batchId: e.target.value, shedId: batch?.name || '' }))
                    }}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full">
                    <option value="">Seleccionar...</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.phase.replace('_', ' ')})</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Nombre Vacuna *</Label>
                  <Input type="text" value={newVaccine.vaccineName || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, vaccineName: e.target.value }))}
                    className="h-8 text-xs" placeholder="Ej: Newcastle" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Edad (semanas)</Label>
                  <Input type="number" value={newVaccine.ageWeeks || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, ageWeeks: parseInt(e.target.value) || 0 }))}
                    className="h-8 text-xs" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Fecha Aplicacion</Label>
                  <Input type="date" value={newVaccine.dateApplied || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, dateApplied: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={addVaccination} className="gap-1 text-xs h-8 bg-violet-600 hover:bg-violet-700 text-white">
                  <Plus className="w-3 h-3" /> Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setShowVaccineForm(false); setNewVaccine({ status: 'programada', via: 'Ocular', dosage: '', lotNumber: '', cycleNumber: 1, shedId: '' }) }} className="gap-1 text-xs h-8">
                  <X className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Vaccination table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px]">Vacuna</TableHead>
                <TableHead className="text-[10px]">Lote</TableHead>
                <TableHead className="text-[10px] text-right">Sem.</TableHead>
                <TableHead className="text-[10px]">Fecha</TableHead>
                <TableHead className="text-[10px]">Via</TableHead>
                <TableHead className="text-[10px]">Estado</TableHead>
                <TableHead className="text-[10px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVaccines.map(v => (
                <TableRow key={v.id}>
                  {editingVaccine === v.id ? (
                    <>
                      <TableCell><Input className="h-7 text-[10px]" value={editVaccineData.vaccineName || ''} onChange={e => setEditVaccineData(p => ({ ...p, vaccineName: e.target.value }))} /></TableCell>
                      <TableCell>{batches.find(b => b.id === v.batchId)?.name || '-'}</TableCell>
                      <TableCell className="text-right"><Input type="number" className="h-7 w-14 text-[10px] text-right" value={editVaccineData.ageWeeks || ''} onChange={e => setEditVaccineData(p => ({ ...p, ageWeeks: parseInt(e.target.value) || 0 }))} /></TableCell>
                      <TableCell><Input type="date" className="h-7 text-[10px]" value={editVaccineData.dateApplied || ''} onChange={e => setEditVaccineData(p => ({ ...p, dateApplied: e.target.value }))} /></TableCell>
                      <TableCell>{v.via}</TableCell>
                      <TableCell>
                        <Button size="sm" className="gap-0.5 text-[9px] h-6 bg-green-100 text-green-700 hover:bg-green-200" onClick={saveEditVaccine}>
                          <Save className="w-2.5 h-2.5" /> Guardar
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={cancelEditVaccine}><X className="w-3 h-3" /></Button>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-[11px] font-medium">{v.vaccineName}</TableCell>
                      <TableCell className="text-[11px]"><Badge variant="outline" className="text-[8px]">{batches.find(b => b.id === v.batchId)?.name || '-'}</Badge></TableCell>
                      <TableCell className="text-[11px] text-right">{v.ageWeeks}</TableCell>
                      <TableCell className="text-[11px]">{v.dateApplied || '-'}</TableCell>
                      <TableCell className="text-[11px]">{v.via}</TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] ${v.status === 'aplicada' ? 'bg-green-100 text-green-700' : v.status === 'vencida' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {v.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          {v.status === 'programada' && (
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:text-green-700" onClick={() => markAsApplied(v.id)} title="Marcar aplicada">
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-stone-600" onClick={() => startEditVaccine(v.id)} title="Editar">
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-red-500" onClick={() => removeVaccination(v.id)} title="Eliminar">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper to map vaccination from camelCase to snake_case for API
function mapVaccinationToDB(v: VaccinationRecord): Record<string, unknown> {
  return {
    batch_id: v.batchId,
    shed_id: v.shedId,
    cycle_number: v.cycleNumber,
    vaccine_name: v.vaccineName,
    date_applied: v.dateApplied || null,
    age_weeks: v.ageWeeks,
    next_dose: v.nextDose || null,
    applied_by: v.appliedBy,
    via: v.via,
    dosage: v.dosage,
    lot_number: v.lotNumber,
    status: v.status,
    notes: v.notes,
  }
}
