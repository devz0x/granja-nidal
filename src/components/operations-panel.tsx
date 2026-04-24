'use client'

import { useState, useMemo } from 'react'
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
  vaccineName: string
  dateApplied: string
  ageWeeks: number
  nextDose: string
  appliedBy: string
  notes: string
}

interface FeedInventory {
  id: string
  phase: string
  currentStockKg: number
  reorderLevelKg: number
  lastPurchase: string
  supplier: string
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
}

export default function OperationsPanel({ batches, config, fmtRD, fmtNum }: OperationsProps) {
  // --- State ---
  const [dailyEntries, setDailyEntries] = useState<DailyProductionEntry[]>([])
  const [vaccinationRecords, setVaccinationRecords] = useState<VaccinationRecord[]>([
    { id: 'vac-1', batchId: 'batch-0', vaccineName: 'Newcastle (Lasota)', dateApplied: '2025-01-15', ageWeeks: 1, nextDose: '2025-04-15', appliedBy: 'Dr. Veterinario', notes: 'Primera dosis' },
  ])
  const [feedInventory, setFeedInventory] = useState<FeedInventory[]>([
    { id: 'fi-1', phase: 'Postura', currentStockKg: 5000, reorderLevelKg: 2000, lastPurchase: '2025-04-10', supplier: 'Nutriovo Sanut' },
    { id: 'fi-2', phase: 'Crecimiento', currentStockKg: 1500, reorderLevelKg: 800, lastPurchase: '2025-04-08', supplier: 'Nutriovo Sanut' },
    { id: 'fi-3', phase: 'Pre-Inicio', currentStockKg: 300, reorderLevelKg: 200, lastPurchase: '2025-03-20', supplier: 'Nutriovo Sanut' },
  ])
  const [newEntry, setNewEntry] = useState<Partial<DailyProductionEntry>>({})

  // --- Derived calculations ---
  const layingBatches = batches.filter(b => b.isLaying)
  const expectedDailyEggs = layingBatches.reduce((s, b) => s + Math.round(b.hens * (b.layingRate / 100)), 0)
  const expectedDailyFeed = batches.reduce((s, b) => {
    const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
    if (!feed) return s
    return s + (b.hens * feed.consumption * 30 / 1000 / 30)
  }, 0)
  const totalHens = batches.reduce((s, b) => s + b.hens, 0)
  const expectedWaterLiters = totalHens * 0.25 // ~250ml per bird per day

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

  const today = new Date().toISOString().split('T')[0]

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

  const removeVaccination = (id: string) => {
    setVaccinationRecords(prev => prev.filter(v => v.id !== id))
  }

  const removeDailyEntry = (id: string) => {
    setDailyEntries(prev => prev.filter(e => e.id !== id))
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
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-600" />
              <span className="text-[10px] font-medium text-stone-500">Mortalidad</span>
            </div>
            <p className="text-lg font-bold text-red-700">{avgMortality ? avgMortality + '/dia' : 'Sin datos'}</p>
            <p className="text-[10px] text-stone-400">{dailyEntries.length} registros</p>
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
          </CardTitle>
          <CardDescription className="text-[11px]">Control de stock actual y niveles de reorden por tipo de alimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Fase</TableHead>
                  <TableHead className="text-[10px] text-right">Stock Actual (kg)</TableHead>
                  <TableHead className="text-[10px] text-right">Nivel Reorden (kg)</TableHead>
                  <TableHead className="text-[10px]">Estado</TableHead>
                  <TableHead className="text-[10px]">Dias estimados</TableHead>
                  <TableHead className="text-[10px]">Ultima Compra</TableHead>
                  <TableHead className="text-[10px]">Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedInventory.map(fi => {
                  const isLow = fi.currentStockKg <= fi.reorderLevelKg
                  const isCritical = fi.currentStockKg <= fi.reorderLevelKg * 0.5
                  // Estimate daily consumption for this phase
                  const phaseBatches = batches.filter(b => config.feedPhases[b.phase as keyof typeof config.feedPhases]?.label === fi.phase)
                  const dailyCons = phaseBatches.reduce((s, b) => {
                    const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
                    return s + (feed ? b.hens * feed.consumption / 1000 : 0)
                  }, 0)
                  const daysLeft = dailyCons > 0 ? Math.round(fi.currentStockKg / dailyCons) : 999
                  return (
                    <TableRow key={fi.id} className={isCritical ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}>
                      <TableCell className="text-xs font-medium">{fi.phase}</TableCell>
                      <TableCell className="text-xs text-right">
                        <Input type="number" value={fi.currentStockKg}
                          onChange={e => updateFeedInventory(fi.id, 'currentStockKg', parseFloat(e.target.value) || 0)}
                          className="w-24 h-7 text-xs text-right mx-auto" />
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <Input type="number" value={fi.reorderLevelKg}
                          onChange={e => updateFeedInventory(fi.id, 'reorderLevelKg', parseFloat(e.target.value) || 0)}
                          className="w-24 h-7 text-xs text-right mx-auto" />
                      </TableCell>
                      <TableCell>
                        {isCritical ? (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">CRITICO</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">REORDENAR</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-xs text-right font-medium ${daysLeft <= 3 ? 'text-red-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-green-700'}`}>
                        ~{daysLeft === 999 ? 'N/A' : daysLeft + ' dias'}
                      </TableCell>
                      <TableCell className="text-[10px] text-stone-500">{fi.lastPurchase}</TableCell>
                      <TableCell className="text-[10px] text-stone-500">{fi.supplier}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Button variant="outline" size="sm" className="mt-3 gap-1 text-xs"
            onClick={() => setFeedInventory(prev => [...prev, {
              id: `fi-${Date.now()}`, phase: 'Nueva Fase', currentStockKg: 0, reorderLevelKg: 500,
              lastPurchase: today, supplier: '',
            }])}>
            <Plus className="w-3 h-3" /> Agregar tipo de alimento
          </Button>
        </CardContent>
      </Card>

      {/* --- CALENDARIO DE VACUNACION --- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4 text-violet-600" />
            Calendario de Vacunacion y Salud
          </CardTitle>
          <CardDescription className="text-[11px]">Registro de vacunas aplicadas y programadas por lote.</CardDescription>
        </CardHeader>
        <CardContent>
          {vaccinationRecords.length === 0 ? (
            <div className="text-center py-6 text-stone-400">
              <Info className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Sin registros de vacunacion.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Lote</TableHead>
                    <TableHead className="text-[10px]">Vacuna</TableHead>
                    <TableHead className="text-[10px]">Fecha Aplicada</TableHead>
                    <TableHead className="text-[10px]">Edad (semanas)</TableHead>
                    <TableHead className="text-[10px]">Prox. Dosis</TableHead>
                    <TableHead className="text-[10px]">Veterinario</TableHead>
                    <TableHead className="text-[10px]">Notas</TableHead>
                    <TableHead className="text-[10px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vaccinationRecords.map(vac => {
                    const batch = batches.find(b => b.id === vac.batchId)
                    const isOverdue = vac.nextDose && new Date(vac.nextDose) < new Date()
                    return (
                      <TableRow key={vac.id} className={isOverdue ? 'bg-red-50' : ''}>
                        <TableCell className="text-[11px] font-medium">{batch?.name || 'N/A'}</TableCell>
                        <TableCell className="text-[11px]">{vac.vaccineName}</TableCell>
                        <TableCell className="text-[11px]">{vac.dateApplied}</TableCell>
                        <TableCell className="text-[11px] text-center">{vac.ageWeeks}s</TableCell>
                        <TableCell className={`text-[11px] ${isOverdue ? 'text-red-600 font-bold' : ''}`}>{vac.nextDose} {isOverdue ? '⚠ VENCIDA' : ''}</TableCell>
                        <TableCell className="text-[11px]">{vac.appliedBy}</TableCell>
                        <TableCell className="text-[10px] text-stone-500 max-w-[100px] truncate">{vac.notes}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-stone-300 hover:text-red-500"
                            onClick={() => removeVaccination(vac.id)}>
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
          <Alert className="mt-3">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-[11px]">
              <strong>Plan vacunal WD80 tipico:</strong> Newcastle (S1, S3, S6, refuerzo), Gumboro (S1, S2, S4),
              Bronquitis Infecciosa (S2, S5), Coriza (S5), Enfermedad de Marek (dia 1 incubadora).
              Consulta siempre con tu veterinario de confianza.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  )
}
