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
// LOCAL STORAGE KEYS
// ================================================================
const LS_VACCINATIONS = 'granja-wd80-vaccinations'
const LS_FEED_INVENTORY = 'granja-wd80-feed-inventory'

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
  batchId?: string | null  // Optional filter to show data for a specific batch only
}

// ================================================================
// ALL 5 FEED PHASES (matches config)
// ================================================================
const ALL_FEED_PHASES = [
  { key: 'pre_inicio', label: 'Pre-Inicio', defaultStock: 300, defaultReorder: 200 },
  { key: 'inicio', label: 'Inicio', defaultStock: 500, defaultReorder: 300 },
  { key: 'crecimiento', label: 'Crecimiento', defaultStock: 1500, defaultReorder: 800 },
  { key: 'pre_postura', label: 'Pre-Postura', defaultStock: 800, defaultReorder: 400 },
  { key: 'postura', label: 'Postura', defaultStock: 5000, defaultReorder: 2000 },
]

// ================================================================
// DEFAULT VACCINATION SCHEDULE (template per batch)
// ================================================================
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

export default function OperationsPanel({ batches, config, fmtRD, fmtNum, batchId }: OperationsProps) {
  const today = new Date().toISOString().split('T')[0]

  // --- State ---
  const [dailyEntries, setDailyEntries] = useState<DailyProductionEntry[]>([])
  const [newEntry, setNewEntry] = useState<Partial<DailyProductionEntry>>({})

  // Feed inventory: load from localStorage, ensuring all 5 phases exist
  const [feedInventory, setFeedInventory] = useState<FeedInventory[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LS_FEED_INVENTORY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as FeedInventory[]
          // Ensure all 5 phases exist - merge with defaults
          const merged = ALL_FEED_PHASES.map(phase => {
            const existing = parsed.find(fi => fi.phaseKey === phase.key)
            if (existing) return { ...existing, phase: phase.label, phaseKey: phase.key }
            return {
              id: `fi-${phase.key}`,
              phaseKey: phase.key,
              phase: phase.label,
              currentStockKg: phase.defaultStock,
              reorderLevelKg: phase.defaultReorder,
              lastPurchase: '',
              supplier: 'Nutriovo Sanut',
              pricePerQuintal: config.feedPhases[phase.key]?.price || 0,
            }
          })
          return merged
        } catch { /* ignore */ }
      }
    }
    return ALL_FEED_PHASES.map(phase => ({
      id: `fi-${phase.key}`,
      phaseKey: phase.key,
      phase: phase.label,
      currentStockKg: phase.defaultStock,
      reorderLevelKg: phase.defaultReorder,
      lastPurchase: '',
      supplier: 'Nutriovo Sanut',
      pricePerQuintal: config.feedPhases[phase.key]?.price || 0,
    }))
  })

  // Vaccination records: load from localStorage or create default per batch
  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(LS_VACCINATIONS)
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    // Create default schedule for first batch only
    return getDefaultVaccineSchedule('batch-0', 'Galpon 1', 1)
  })

  // Vaccination UI state
  const [editingVaccine, setEditingVaccine] = useState<string | null>(null)
  const [editVaccineData, setEditVaccineData] = useState<Partial<VaccinationRecord>>({})
  const [vaccineFilterBatch, setVaccineFilterBatch] = useState<string>('all')
  const [vaccineFilterStatus, setVaccineFilterStatus] = useState<string>('all')
  const [vaccineFilterShed, setVaccineFilterShed] = useState<string>('all')
  const [showVaccineForm, setShowVaccineForm] = useState(false)
  const [newVaccine, setNewVaccine] = useState<Partial<VaccinationRecord>>({
    status: 'programada',
    via: 'Ocular',
    dosage: '',
    lotNumber: '',
    cycleNumber: 1,
    shedId: '',
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_FEED_INVENTORY, JSON.stringify(feedInventory))
  }, [feedInventory])

  useEffect(() => {
    localStorage.setItem(LS_VACCINATIONS, JSON.stringify(vaccinationRecords))
  }, [vaccinationRecords])

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
    const overdue = vaccinationRecords.filter(v => {
      if (v.status !== 'programada') return false
      return false // nextDose based overdue checked inline
    }).length
    const overdueDoses = vaccinationRecords.filter(v => {
      if (v.nextDose && v.status === 'aplicada') {
        return new Date(v.nextDose) < new Date() && new Date(v.nextDose) > new Date(v.dateApplied)
      }
      return false
    }).length
    return { applied, programmed, overdue: overdueDoses, total: vaccinationRecords.length }
  }, [vaccinationRecords])

  // Filtered vaccinations
  const filteredVaccines = useMemo(() => {
    return vaccinationRecords.filter(v => {
      if (vaccineFilterBatch !== 'all' && v.batchId !== vaccineFilterBatch) return false
      if (vaccineFilterStatus !== 'all' && v.status !== vaccineFilterStatus) return false
      if (vaccineFilterShed !== 'all' && v.shedId !== vaccineFilterShed) return false
      return true
    })
  }, [vaccinationRecords, vaccineFilterBatch, vaccineFilterStatus, vaccineFilterShed])

  // Grouped by batch for summary
  const vaccinesByBatch = useMemo(() => {
    const grouped: Record<string, VaccinationRecord[]> = {}
    vaccinationRecords.forEach(v => {
      if (!grouped[v.batchId]) grouped[v.batchId] = []
      grouped[v.batchId].push(v)
    })
    return grouped
  }, [vaccinationRecords])

  const addDailyEntry = () => {
    if (!newEntry.batchId || !newEntry.eggsCollected && newEntry.eggsCollected !== 0) return
    const entry: DailyProductionEntry = {
      id: `de-${Date.now()}`,
      date: newEntry.date || today,
      batchId: newEntry.batchId,
      eggsCollected: newEntry.eggsCollected || 0,
      eggsBroken: newEntry.eggsBroken || 0,
      mortality: newEntry.mortality || 0,
      feedKg: newEntry.feedKg || 0,
      waterLiters: newEntry.waterLiters || 0,
      notes: newEntry.notes || '',
    }
    setDailyEntries(prev => [entry, ...prev])
    setNewEntry({})
  }

  const updateFeedInventory = (id: string, field: keyof FeedInventory, value: string | number) => {
    setFeedInventory(prev => prev.map(fi => fi.id === id ? { ...fi, [field]: value } : fi))
  }

  const removeDailyEntry = (id: string) => {
    setDailyEntries(prev => prev.filter(e => e.id !== id))
  }

  // --- Vaccination CRUD ---
  const addVaccination = () => {
    if (!newVaccine.batchId || !newVaccine.vaccineName) return
    const vac: VaccinationRecord = {
      id: `vac-${Date.now()}`,
      batchId: newVaccine.batchId || '',
      shedId: newVaccine.shedId || batches.find(b => b.id === newVaccine.batchId)?.name || '',
      cycleNumber: newVaccine.cycleNumber || 1,
      vaccineName: newVaccine.vaccineName || '',
      dateApplied: newVaccine.dateApplied || '',
      ageWeeks: newVaccine.ageWeeks || 0,
      nextDose: newVaccine.nextDose || '',
      appliedBy: newVaccine.appliedBy || '',
      via: newVaccine.via || 'Ocular',
      dosage: newVaccine.dosage || '',
      lotNumber: newVaccine.lotNumber || '',
      status: newVaccine.status || 'programada',
      notes: newVaccine.notes || '',
    }
    setVaccinationRecords(prev => [vac, ...prev])
    setNewVaccine({ status: 'programada', via: 'Ocular', dosage: '', lotNumber: '', cycleNumber: 1, shedId: '' })
    setShowVaccineForm(false)
  }

  const startEditVaccine = (id: string) => {
    const vac = vaccinationRecords.find(v => v.id === id)
    if (!vac) return
    setEditingVaccine(id)
    setEditVaccineData({ ...vac })
  }

  const saveEditVaccine = () => {
    if (!editingVaccine) return
    setVaccinationRecords(prev => prev.map(v =>
      v.id === editingVaccine ? { ...v, ...editVaccineData } as VaccinationRecord : v
    ))
    setEditingVaccine(null)
    setEditVaccineData({})
  }

  const cancelEditVaccine = () => {
    setEditingVaccine(null)
    setEditVaccineData({})
  }

  const removeVaccination = (id: string) => {
    setVaccinationRecords(prev => prev.filter(v => v.id !== id))
    if (editingVaccine === id) cancelEditVaccine()
  }

  const markAsApplied = (id: string) => {
    setVaccinationRecords(prev => prev.map(v =>
      v.id === id ? { ...v, status: 'aplicada' as const, dateApplied: v.dateApplied || today } : v
    ))
  }

  const generateScheduleForBatch = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId)
    if (!batch) return
    const existing = vaccinationRecords.filter(v => v.batchId === batchId)
    if (existing.length > 0) {
      if (!confirm(`El lote ${batch.name} ya tiene ${existing.length} vacunas registradas. Deseas reemplazarlas con el plan por defecto?`)) return
      setVaccinationRecords(prev => prev.filter(v => v.batchId !== batchId))
    }
    const newSchedule = getDefaultVaccineSchedule(batchId, batch.name, 1)
    setVaccinationRecords(prev => [...prev, ...newSchedule])
  }

  const duplicateScheduleFromBatch = (sourceBatchId: string, targetBatchId: string) => {
    const sourceVacs = vaccinationRecords.filter(v => v.batchId === sourceBatchId)
    if (sourceVacs.length === 0) return
    const targetBatch = batches.find(b => b.id === targetBatchId)
    const existing = vaccinationRecords.filter(v => v.batchId === targetBatchId)
    if (existing.length > 0) {
      if (!confirm(`El lote ${targetBatch?.name} ya tiene vacunas. Deseas reemplazarlas?`)) return
      setVaccinationRecords(prev => prev.filter(v => v.batchId !== targetBatchId))
    }
    const newVacs: VaccinationRecord[] = sourceVacs.map(v => ({
      ...v,
      id: `vac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      batchId: targetBatchId,
      shedId: targetBatch?.name || '',
      status: 'programada' as const,
      dateApplied: '',
    }))
    setVaccinationRecords(prev => [...prev, ...newVacs])
  }

  const clearVaccinesForBatch = (batchId: string) => {
    const batch = batches.find(b => b.id === batchId)
    if (!confirm(`Eliminar todas las vacunas del lote ${batch?.name}?`)) return
    setVaccinationRecords(prev => prev.filter(v => v.batchId !== batchId))
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

      {/* --- INVENTARIO DE ALIMENTO (5 FASES COMPLETO) --- */}
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
                          onChange={e => updateFeedInventory(fi.id, 'currentStockKg', parseFloat(e.target.value) || 0)}
                          className="w-20 h-7 text-xs text-right mx-auto" />
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Input type="number" value={fi.reorderLevelKg}
                          onChange={e => updateFeedInventory(fi.id, 'reorderLevelKg', parseFloat(e.target.value) || 0)}
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

          {/* Feed inventory summary */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-stone-50 rounded-lg">
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Stock Total</p>
              <p className="text-sm font-bold">{fmtNum(feedInventory.reduce((s, f) => s + f.currentStockKg, 0))} kg</p>
            </div>
            <div>
              <p className="text-[9px] text-stone-500 uppercase">Fases Activas</p>
              <p className="text-sm font-bold">{feedInventory.filter(fi => {
                return batches.some(b => b.phase === fi.phaseKey)
              }).length} de {feedInventory.length}</p>
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

      {/* ================================================================ */}
      {/* --- CALENDARIO DE VACUNACION Y SALUD (MEJORADO COMPLETO) --- */}
      {/* ================================================================ */}
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
                  const batchId = prompt('Selecciona el lote ID para generar plan (ej: batch-0):')
                  if (batchId) generateScheduleForBatch(batchId)
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
                <div className="space-y-1">
                  <Label className="text-[10px]">Prox. Dosis</Label>
                  <Input type="date" value={newVaccine.nextDose || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, nextDose: e.target.value }))}
                    className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Via</Label>
                  <select value={newVaccine.via || 'Ocular'}
                    onChange={e => setNewVaccine(p => ({ ...p, via: e.target.value }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full">
                    <option value="Ocular">Ocular</option>
                    <option value="Agua bebida">Agua bebida</option>
                    <option value="Inyectable">Inyectable</option>
                    <option value="Ala">Ala</option>
                    <option value="SC">Subcutanea</option>
                    <option value="IM">Intramuscular</option>
                    <option value="Nasal">Nasal</option>
                    <option value="Spray">Spray</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Dosificacion</Label>
                  <Input type="text" value={newVaccine.dosage || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, dosage: e.target.value }))}
                    className="h-8 text-xs" placeholder="Ej: 1 gota" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Lote/Veterinario</Label>
                  <Input type="text" value={newVaccine.appliedBy || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, appliedBy: e.target.value }))}
                    className="h-8 text-xs" placeholder="Dr. / Tecnico" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">No. Lote Lab.</Label>
                  <Input type="text" value={newVaccine.lotNumber || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, lotNumber: e.target.value }))}
                    className="h-8 text-xs" placeholder="No. fabricante" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Estado</Label>
                  <select value={newVaccine.status || 'programada'}
                    onChange={e => setNewVaccine(p => ({ ...p, status: e.target.value as VaccinationRecord['status'] }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full">
                    <option value="programada">Programada</option>
                    <option value="aplicada">Aplicada</option>
                    <option value="vencida">Vencida</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Ciclo #</Label>
                  <Input type="number" value={newVaccine.cycleNumber || 1}
                    onChange={e => setNewVaccine(p => ({ ...p, cycleNumber: parseInt(e.target.value) || 1 }))}
                    className="h-8 text-xs" min={1} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Notas</Label>
                  <Input type="text" value={newVaccine.notes || ''}
                    onChange={e => setNewVaccine(p => ({ ...p, notes: e.target.value }))}
                    className="h-8 text-xs" placeholder="Observaciones..." />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addVaccination} className="gap-1 text-xs h-7 bg-violet-600 hover:bg-violet-700">
                  <Save className="w-3 h-3" /> Guardar Vacuna
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowVaccineForm(false)} className="text-xs h-7">
                  <X className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3 p-2 bg-stone-50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-stone-500 uppercase">Filtrar Lote</Label>
              <select value={vaccineFilterBatch}
                onChange={e => setVaccineFilterBatch(e.target.value)}
                className="h-7 text-[10px] rounded-md border border-input bg-background px-1.5 w-auto min-w-[100px]">
                <option value="all">Todos los lotes</option>
                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-stone-500 uppercase">Estado</Label>
              <select value={vaccineFilterStatus}
                onChange={e => setVaccineFilterStatus(e.target.value)}
                className="h-7 text-[10px] rounded-md border border-input bg-background px-1.5 w-auto min-w-[100px]">
                <option value="all">Todos</option>
                <option value="programada">Programada</option>
                <option value="aplicada">Aplicada</option>
                <option value="vencida">Vencida</option>
              </select>
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-stone-500 uppercase">Galpon</Label>
              <select value={vaccineFilterShed}
                onChange={e => setVaccineFilterShed(e.target.value)}
                className="h-7 text-[10px] rounded-md border border-input bg-background px-1.5 w-auto min-w-[100px]">
                <option value="all">Todos</option>
                {batches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="flex-1" />
            <div className="flex items-end gap-1">
              <Button variant="ghost" size="sm" className="text-[9px] h-7 text-red-500"
                onClick={() => {
                  const batchId = prompt('ID del lote a limpiar (ej: batch-0):')
                  if (batchId) clearVaccinesForBatch(batchId)
                }}>
                <Trash2 className="w-2.5 h-2.5 mr-0.5" /> Limpiar Lote
              </Button>
              <Button variant="ghost" size="sm" className="text-[9px] h-7"
                onClick={() => {
                  const sourceId = prompt('ID lote origen (ej: batch-0):')
                  const targetId = prompt('ID lote destino (ej: batch-1):')
                  if (sourceId && targetId) duplicateScheduleFromBatch(sourceId, targetId)
                }}>
                <Clipboard className="w-2.5 h-2.5 mr-0.5" /> Copiar Plan
              </Button>
            </div>
          </div>

          {/* Vaccination table */}
          {filteredVaccines.length === 0 ? (
            <div className="text-center py-6 text-stone-400">
              <Syringe className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Sin registros de vacunacion {vaccineFilterBatch !== 'all' ? 'para este filtro.' : '.'}</p>
              <div className="flex justify-center gap-2 mt-2">
                {batches.map(b => (
                  <Button key={b.id} variant="outline" size="sm" className="text-[10px] h-7"
                    onClick={() => generateScheduleForBatch(b.id)}>
                    <Plus className="w-3 h-3 mr-1" /> {b.name}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[9px]">Estado</TableHead>
                    <TableHead className="text-[9px]">Lote</TableHead>
                    <TableHead className="text-[9px]">Galpon</TableHead>
                    <TableHead className="text-[9px]">Ciclo</TableHead>
                    <TableHead className="text-[9px]">Vacuna</TableHead>
                    <TableHead className="text-[9px]">Edad</TableHead>
                    <TableHead className="text-[9px]">Fecha</TableHead>
                    <TableHead className="text-[9px]">Prox. Dosis</TableHead>
                    <TableHead className="text-[9px]">Via</TableHead>
                    <TableHead className="text-[9px]">Dosificacion</TableHead>
                    <TableHead className="text-[9px]">Veterinario</TableHead>
                    <TableHead className="text-[9px]">Lote Lab.</TableHead>
                    <TableHead className="text-[9px]">Notas</TableHead>
                    <TableHead className="text-[9px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVaccines.map(vac => {
                    const batch = batches.find(b => b.id === vac.batchId)
                    const isOverdue = vac.nextDose && vac.status === 'aplicada' && new Date(vac.nextDose) < new Date()
                    const isEditing = editingVaccine === vac.id

                    return (
                      <TableRow key={vac.id} className={`
                        ${isOverdue ? 'bg-red-50' : ''}
                        ${vac.status === 'aplicada' ? 'bg-green-50/50' : ''}
                        ${vac.status === 'vencida' ? 'bg-red-50/50' : ''}
                        ${isEditing ? 'bg-violet-50 ring-1 ring-violet-300' : ''}
                      `}>
                        {isEditing ? (
                          <>
                            <TableCell className="text-[10px]">
                              <select value={editVaccineData.status || 'programada'}
                                onChange={e => setEditVaccineData(p => ({ ...p, status: e.target.value as VaccinationRecord['status'] }))}
                                className="h-6 text-[10px] rounded border px-1 w-full">
                                <option value="programada">Programada</option>
                                <option value="aplicada">Aplicada</option>
                                <option value="vencida">Vencida</option>
                              </select>
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <select value={editVaccineData.batchId || ''}
                                onChange={e => {
                                  const b = batches.find(x => x.id === e.target.value)
                                  setEditVaccineData(p => ({ ...p, batchId: e.target.value, shedId: b?.name || '' }))
                                }}
                                className="h-6 text-[10px] rounded border px-1 w-full">
                                {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.shedId || ''} className="h-6 text-[10px] w-16"
                                onChange={e => setEditVaccineData(p => ({ ...p, shedId: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="number" value={editVaccineData.cycleNumber || 1} className="h-6 text-[10px] w-12"
                                onChange={e => setEditVaccineData(p => ({ ...p, cycleNumber: parseInt(e.target.value) || 1 }))} min={1} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.vaccineName || ''} className="h-6 text-[10px] w-full min-w-[80px]"
                                onChange={e => setEditVaccineData(p => ({ ...p, vaccineName: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="number" value={editVaccineData.ageWeeks || 0} className="h-6 text-[10px] w-12"
                                onChange={e => setEditVaccineData(p => ({ ...p, ageWeeks: parseInt(e.target.value) || 0 }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="date" value={editVaccineData.dateApplied || ''} className="h-6 text-[10px] w-28"
                                onChange={e => setEditVaccineData(p => ({ ...p, dateApplied: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="date" value={editVaccineData.nextDose || ''} className="h-6 text-[10px] w-28"
                                onChange={e => setEditVaccineData(p => ({ ...p, nextDose: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <select value={editVaccineData.via || 'Ocular'}
                                onChange={e => setEditVaccineData(p => ({ ...p, via: e.target.value }))}
                                className="h-6 text-[10px] rounded border px-1 w-full">
                                <option value="Ocular">Ocular</option>
                                <option value="Agua bebida">Agua bebida</option>
                                <option value="Inyectable">Inyectable</option>
                                <option value="Ala">Ala</option>
                                <option value="SC">Subcutanea</option>
                                <option value="IM">Intramuscular</option>
                                <option value="Nasal">Nasal</option>
                                <option value="Spray">Spray</option>
                              </select>
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.dosage || ''} className="h-6 text-[10px] w-20"
                                onChange={e => setEditVaccineData(p => ({ ...p, dosage: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.appliedBy || ''} className="h-6 text-[10px] w-20"
                                onChange={e => setEditVaccineData(p => ({ ...p, appliedBy: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.lotNumber || ''} className="h-6 text-[10px] w-16"
                                onChange={e => setEditVaccineData(p => ({ ...p, lotNumber: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-[10px]">
                              <Input type="text" value={editVaccineData.notes || ''} className="h-6 text-[10px] w-24"
                                onChange={e => setEditVaccineData(p => ({ ...p, notes: e.target.value }))} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-0.5 justify-end">
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-green-500 hover:text-green-700"
                                  onClick={saveEditVaccine}>
                                  <Save className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-stone-400 hover:text-stone-600"
                                  onClick={cancelEditVaccine}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>
                              <Badge className={`text-[8px] ${
                                vac.status === 'aplicada' ? 'bg-green-100 text-green-700' :
                                vac.status === 'vencida' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {vac.status === 'aplicada' ? <><CheckCircle2 className="w-2 h-2 mr-0.5" /> Aplicada</> :
                                 vac.status === 'vencida' ? 'Vencida' : 'Programada'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[10px] font-medium">{batch?.name || vac.batchId}</TableCell>
                            <TableCell className="text-[10px] text-stone-500">{vac.shedId || '-'}</TableCell>
                            <TableCell className="text-[10px] text-center">#{vac.cycleNumber}</TableCell>
                            <TableCell className="text-[10px] font-medium">{vac.vaccineName}</TableCell>
                            <TableCell className="text-[10px] text-center">{vac.ageWeeks}s</TableCell>
                            <TableCell className="text-[10px]">{vac.dateApplied || '-'}</TableCell>
                            <TableCell className={`text-[10px] ${isOverdue ? 'text-red-600 font-bold' : ''}`}>
                              {vac.nextDose || '-'} {isOverdue ? ' !' : ''}
                            </TableCell>
                            <TableCell className="text-[10px]">{vac.via}</TableCell>
                            <TableCell className="text-[10px] text-stone-500">{vac.dosage || '-'}</TableCell>
                            <TableCell className="text-[10px]">{vac.appliedBy || '-'}</TableCell>
                            <TableCell className="text-[10px] text-stone-400">{vac.lotNumber || '-'}</TableCell>
                            <TableCell className="text-[9px] text-stone-500 max-w-[80px] truncate">{vac.notes || ''}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-0.5 justify-end">
                                {vac.status === 'programada' && (
                                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-green-400 hover:text-green-600"
                                    onClick={() => markAsApplied(vac.id)} title="Marcar como aplicada">
                                    <CheckCircle2 className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-stone-300 hover:text-violet-500"
                                  onClick={() => startEditVaccine(vac.id)} title="Editar">
                                  <Edit3 className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-stone-300 hover:text-red-500"
                                  onClick={() => removeVaccination(vac.id)} title="Eliminar">
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Info alert */}
          <Alert className="mt-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-[11px]">
              <strong>Plan vacunal WD80 tipico:</strong> Newcastle (S1, S3, S6, refuerzo), Gumboro (S1, S2, S4),
              Bronquitis Infecciosa (S2, S5), Coriza (S5), Encefalomielitis (S8), Marek (dia 1 incubadora).
              Usa &quot;Generar Plan&quot; para crear un esquema base y edita las dosis segun las indicaciones de tu veterinario.
              Las vacunas pueden variar por lote, galpon, ciclo y disponibilidad de laboratorio.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
