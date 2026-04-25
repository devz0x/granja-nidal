'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import LotCard from '@/components/lot-card'
import LotDetail from '@/components/lot-detail'
import ConfigSheet from '@/components/config-sheet'
import ReportsPanel from '@/components/reports-panel'
import RemindersPanel from '@/components/reminders-panel'
import FarmMapView from '@/components/farm-map-view'
import { generateRemindersForNewBatch, generatePhaseChangeReminders, generateCycleWarningReminder, clearAutoRemindersForBatch } from '@/lib/auto-reminders'
import type {
  PhaseKey, FarmConfig, BatchConfig, StructuralExpense, StructuralFrequency,
  MonthlyRecord,
} from '@/lib/farm-data'
import {
  DEFAULT_CONFIG, DEFAULT_FEED, DEFAULT_STRUCTURAL_EXPENSES, PHASE_COLORS,
  FREQUENCY_LABELS, FREQUENCY_MULTIPLIER, PHASE_KEYS,
  fmtRD, fmtNum, fmtPct, getPhaseFromMonth, createDefaultBatches,
  computeCalculations, getAlertCountForBatch, getUrgentReminderCount,
} from '@/lib/farm-data'
import {
  TrendingUp, TrendingDown, DollarSign, Egg, Wheat,
  Activity, Target, Settings, FileText, Sparkles, AlertTriangle, CheckCircle2,
  RefreshCw, Bell, Map, FileOutput, ClipboardCheck, ChevronDown, ChevronUp, Eye,
  Plus, Trash2, Printer,
} from 'lucide-react'

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function Home() {
  // ---- Hydration guard ----
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ---- Navigation state ----
  const [view, setView] = useState<'dashboard' | 'lot-detail' | 'reports' | 'history' | 'map' | 'reminders'>('dashboard')
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  // ---- Core data state (preserved exactly) ----
  const [config, setConfig] = useState<FarmConfig>(() => {
    if (typeof window !== 'undefined') {
      const savedVersion = localStorage.getItem('granja-wd80-config-version')
      const saved = localStorage.getItem('granja-wd80-config')
      if (saved && savedVersion === String(2)) {
        try {
          const parsed = JSON.parse(saved)
          return { ...DEFAULT_CONFIG, ...parsed, feedPhases: { ...DEFAULT_FEED, ...(parsed.feedPhases || {}) } }
        } catch { /* ignore */ }
      } else if (saved && savedVersion !== String(2)) {
        try {
          const parsed = JSON.parse(saved)
          localStorage.setItem('granja-wd80-config-version', String(2))
          return { ...DEFAULT_CONFIG, ...parsed, feedPhases: { ...DEFAULT_FEED } }
        } catch { /* ignore */ }
      }
      localStorage.setItem('granja-wd80-config-version', String(2))
    }
    return DEFAULT_CONFIG
  })
  const [batches, setBatches] = useState<BatchConfig[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('granja-wd80-batches')
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    return createDefaultBatches()
  })
  const [savedRecords, setSavedRecords] = useState<MonthlyRecord[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('granja-wd80-records')
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    return []
  })
  const [structuralExpenses, setStructuralExpenses] = useState<StructuralExpense[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('granja-wd80-structural')
      if (saved) {
        try { return JSON.parse(saved) } catch { /* ignore */ }
      }
    }
    return DEFAULT_STRUCTURAL_EXPENSES
  })
  const [notes, setNotes] = useState('')
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('granja-wd80-config', JSON.stringify(config)) }, [config])
  useEffect(() => { localStorage.setItem('granja-wd80-batches', JSON.stringify(batches)) }, [batches])
  useEffect(() => { localStorage.setItem('granja-wd80-records', JSON.stringify(savedRecords)) }, [savedRecords])
  useEffect(() => { localStorage.setItem('granja-wd80-structural', JSON.stringify(structuralExpenses)) }, [structuralExpenses])

  // ---- Handlers (preserved exactly) ----
  const updateConfig = useCallback(<K extends keyof FarmConfig>(key: K, value: FarmConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateBatch = useCallback((id: string, field: keyof BatchConfig, value: boolean | number | string) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== id) return b
      const updated = { ...b, [field]: value } as BatchConfig
      if (field === 'cycleMonth') {
        const m = value as number
        updated.phase = getPhaseFromMonth(m)
        updated.isLaying = m >= 5
      }
      if (field === 'phase') {
        updated.phase = value as PhaseKey
        updated.isLaying = value === 'postura'
      }
      return updated
    }))
  }, [])

  const addBatch = useCallback(() => {
    const num = batches.length + 1
    const newId = `batch-${batches.length}`
    const newName = `Galpon ${num}`
    setBatches(prev => [...prev, {
      id: newId, name: newName, hens: config.hensPerBatch,
      layingRate: config.baseLayingRate, isLaying: false, cycleMonth: 0, phase: 'pre_inicio',
    }])
    const today = new Date().toISOString().split('T')[0]
    setTimeout(() => {
      generateRemindersForNewBatch(newId, newName, config.hensPerBatch, today)
    }, 100)
  }, [batches.length, config.hensPerBatch, config.baseLayingRate])

  const removeBatch = useCallback((id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id))
    setTimeout(() => { clearAutoRemindersForBatch(id) }, 100)
    if (selectedBatchId === id) {
      setSelectedBatchId(null)
      setView('dashboard')
    }
  }, [selectedBatchId])

  const resetAll = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setBatches(createDefaultBatches())
    setNotes('')
    localStorage.removeItem('granja-wd80-config')
    localStorage.removeItem('granja-wd80-batches')
  }, [])

  const resetSection = useCallback((section: string) => {
    if (section === 'ventas') {
      setConfig(prev => ({ ...prev, eggPrice: DEFAULT_CONFIG.eggPrice, henSalePrice: DEFAULT_CONFIG.henSalePrice, chickPrice: DEFAULT_CONFIG.chickPrice }))
    } else if (section === 'alimento') {
      setConfig(prev => ({ ...prev, feedPhases: DEFAULT_FEED }))
    } else if (section === 'ave') {
      setConfig(prev => ({ ...prev, vaccinesCostPerBird: DEFAULT_CONFIG.vaccinesCostPerBird, equipmentCostPerBird: DEFAULT_CONFIG.equipmentCostPerBird, mortalityRate: DEFAULT_CONFIG.mortalityRate }))
    } else if (section === 'infraestructura') {
      setConfig(prev => ({ ...prev, shed1Cost: DEFAULT_CONFIG.shed1Cost, shedAdditionalCost: DEFAULT_CONFIG.shedAdditionalCost }))
    } else if (section === 'operacion') {
      setConfig(prev => ({
        ...prev, baseLayingRate: DEFAULT_CONFIG.baseLayingRate, layingCycleMonths: DEFAULT_CONFIG.layingCycleMonths,
        hensPerBatch: DEFAULT_CONFIG.hensPerBatch, fixedCostsMonthly: DEFAULT_CONFIG.fixedCostsMonthly, otherCosts: DEFAULT_CONFIG.otherCosts,
      }))
    }
  }, [])

  const deleteRecord = useCallback((id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id))
  }, [])

  const saveRecord = useCallback(() => {
    const now = new Date()
    const currentCalcs = computeCalculations(config, batches, structuralExpenses)
    const record: MonthlyRecord = {
      id: `rec-${Date.now()}`,
      month: now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }),
      date: now.toLocaleDateString('es-DO'),
      batches: JSON.parse(JSON.stringify(batches)),
      config: JSON.parse(JSON.stringify(config)),
      notes,
      revenue: currentCalcs.totalRevenue,
      expenses: currentCalcs.totalExpenses,
      net: currentCalcs.netProfit,
    }
    setSavedRecords(prev => [record, ...prev])
    setNotes('')
  }, [batches, config, notes, structuralExpenses])

  // ================================================================
  // CALCULATIONS ENGINE (preserved exactly)
  // ================================================================
  const [configVersion, setConfigVersion] = useState(0)
  const [displayedCalcs, setDisplayedCalcs] = useState<ReturnType<typeof computeCalculations> | null>(null)

  useEffect(() => { setConfigVersion(v => v + 1) }, [config, batches, structuralExpenses])

  useEffect(() => {
    if (!displayedCalcs) {
      setDisplayedCalcs(computeCalculations(config, batches, structuralExpenses))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const liveCalcs = useMemo(() => computeCalculations(config, batches, structuralExpenses), [config, batches, structuralExpenses])
  const [lastUpdateVersion, setLastUpdateVersion] = useState(0)
  const hasPendingChanges = configVersion > lastUpdateVersion
  const calculations = displayedCalcs || liveCalcs

  const handleUpdateCalculations = useCallback(() => {
    setDisplayedCalcs(computeCalculations(config, batches, structuralExpenses))
    setLastUpdateVersion(configVersion)
  }, [config, batches, structuralExpenses, configVersion])

  // Urgent reminders
  const [urgentReminderCount, setUrgentReminderCount] = useState(0)
  useEffect(() => {
    const update = () => { setUrgentReminderCount(getUrgentReminderCount()) }
    update()
    const interval = setInterval(update, 120000)
    return () => clearInterval(interval)
  }, [])

  // Auto-reminders: Watch for phase changes and cycle warnings
  const prevBatchesRef = useRef(batches)
  useEffect(() => {
    const prev = prevBatchesRef.current
    batches.forEach(batch => {
      const prevBatch = prev.find(b => b.id === batch.id)
      if (!prevBatch) return
      if (prevBatch.phase !== batch.phase) {
        const phaseLabel = DEFAULT_FEED[batch.phase as PhaseKey]?.label || batch.phase
        generatePhaseChangeReminders(batch.id, batch.name, batch.hens, batch.phase, phaseLabel)
      }
      if (batch.isLaying && batch.cycleMonth > 0) {
        const monthsLeft = config.layingCycleMonths - (batch.cycleMonth - 5)
        if (monthsLeft <= 3 && monthsLeft > 0) {
          generateCycleWarningReminder(batch.id, batch.name, batch.cycleMonth, config.layingCycleMonths)
        }
      }
    })
    prevBatchesRef.current = batches
  }, [batches, config.layingCycleMonths])

  // ---- Navigation helpers ----
  const openLotDetail = useCallback((batchId: string) => {
    setSelectedBatchId(batchId)
    setView('lot-detail')
  }, [])

  const goBack = useCallback(() => {
    setView('dashboard')
    setSelectedBatchId(null)
  }, [])

  // ---- Selected batch ----
  const selectedBatch = selectedBatchId ? batches.find(b => b.id === selectedBatchId) : null
  const selectedCalc = selectedBatchId ? {
    ...liveCalcs,
    batchDetails: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId),
    totalEggRevenue: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.eggRevenue, 0),
    totalFeedCost: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.monthlyFeedCost, 0),
    totalHens: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.hens, 0),
    totalEggs: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.eggsPerMonth, 0),
    layingBirds: liveCalcs.batchDetails.filter(b => b.id === selectedBatchId && b.isLaying).reduce((s, b) => s + b.hens, 0),
  } : null

  // ================================================================
  // RENDER
  // ================================================================
  if (!mounted) {
    return <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 to-amber-50/30" />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 to-amber-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Granja Nidal" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
              <div>
                <h1 className="text-lg font-bold text-stone-900">Granja Nidal</h1>
                <p className="text-[11px] text-stone-500">Gestor de Granja</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                <Activity className="w-3 h-3 mr-1" />
                {liveCalcs.layingBatches}/{batches.length} postura
              </Badge>
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                {fmtNum(liveCalcs.totalHens)} aves
              </Badge>
              <Badge className={`text-xs ${liveCalcs.netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {fmtRD(liveCalcs.netProfit)}/mes
              </Badge>
              {urgentReminderCount > 0 && (
                <button onClick={() => setView('reminders')} className="relative cursor-pointer">
                  <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-200 transition-colors cursor-pointer">
                    <Bell className="w-3 h-3 mr-1" />
                    {urgentReminderCount} alerta{urgentReminderCount !== 1 ? 's' : ''}
                  </Badge>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                </button>
              )}
              <button
                onClick={() => setConfigOpen(true)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4 text-stone-500" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* ====================== DASHBOARD VIEW ====================== */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary KPI bar (6 cards) */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Ingresos</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-green-700">{fmtRD(calculations.totalRevenue)}</p>
                  <p className="text-[10px] text-stone-400">{fmtNum(calculations.totalEggs)} huevos</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-red-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Gastos</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-red-700">{fmtRD(calculations.totalExpenses)}</p>
                  <p className="text-[10px] text-stone-400">
                    Feed: {fmtRD(calculations.totalFeedCost)}
                    {calculations.feedPriceImpact !== 0 && (
                      <span className={`ml-1 font-medium ${calculations.feedPriceImpact > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        ({calculations.feedPriceImpact > 0 ? '+' : ''}{fmtRD(calculations.feedPriceImpact)})
                      </span>
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Neto</span>
                  </div>
                  <p className={`text-base sm:text-lg font-bold ${calculations.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmtRD(calculations.netProfit)}
                  </p>
                  <p className="text-[10px] text-stone-400">Margen: {fmtPct(calculations.profitMargin)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-orange-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Egg className="w-3.5 h-3.5 text-orange-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Costo/Huevo</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-stone-800">{fmtRD(calculations.costPerEgg)}</p>
                  <p className="text-[10px] text-stone-400">Venta: {fmtRD(config.eggPrice)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-emerald-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Wheat className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Feed/Gasto</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-stone-800">{fmtPct(calculations.feedPercentage)}</p>
                  <p className="text-[10px] text-stone-400">{fmtRD(calculations.totalFeedCost)}</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-violet-500">
                <CardContent className="p-3">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Target className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-[10px] font-medium text-stone-500 uppercase">Eq. Diario</span>
                  </div>
                  <p className="text-base sm:text-lg font-bold text-stone-800">{fmtNum(calculations.breakEvenEggsPerDay)}</p>
                  <p className="text-[10px] text-stone-400">huevos/dia min</p>
                </CardContent>
              </Card>
            </div>

            {/* Update Button */}
            <div className={`flex items-center justify-between mb-6 p-3 rounded-xl bg-white border-2 border-dashed transition-all duration-300 ${
              hasPendingChanges ? 'border-amber-400 bg-amber-50/50 shadow-sm' : 'border-green-300 bg-green-50/30'
            }`}>
              <div className="flex items-center gap-2.5">
                {hasPendingChanges ? (
                  <>
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Cambios pendientes</p>
                      <p className="text-[11px] text-amber-600">Actualiza los numeros.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">Calculos actualizados</p>
                      <p className="text-[11px] text-green-600">Los numeros reflejan la configuracion actual.</p>
                    </div>
                  </>
                )}
              </div>
              <Button
                onClick={handleUpdateCalculations}
                className={`shrink-0 font-semibold text-sm px-5 h-10 transition-all duration-200 ${
                  hasPendingChanges ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg' : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${hasPendingChanges ? 'animate-spin' : ''}`}
                style={hasPendingChanges ? { animationDuration: '2s' } : {}} />
                Actualizar
              </Button>
            </div>

            {/* Lot Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-stone-800">Lotes</h2>
                <Badge variant="outline" className="text-xs">{batches.length} lotes</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {batches.map(batch => (
                  <LotCard
                    key={batch.id}
                    batch={batch}
                    calc={liveCalcs}
                    config={config}
                    onClick={() => openLotDetail(batch.id)}
                  />
                ))}
              </div>
            </div>

            {/* Quick Access Cards */}
            <div>
              <h2 className="text-base font-bold text-stone-800 mb-3">Herramientas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => setView('reports')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                      <FileOutput className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Reportes</h3>
                      <p className="text-[11px] text-stone-400">Contable, ingeniero, veterinario, compra y RRHH</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView('history')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                      <FileText className="w-5 h-5 text-violet-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Historial</h3>
                      <p className="text-[11px] text-stone-400">{savedRecords.length} registros guardados</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView('map')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center group-hover:bg-sky-200 transition-colors">
                      <Map className="w-5 h-5 text-sky-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Vista Granja</h3>
                      <p className="text-[11px] text-stone-400">Mapa interactivo de la granja</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Floating Add Button */}
            <div className="fixed bottom-6 right-6 z-40">
              <Button
                onClick={addBatch}
                size="lg"
                className="h-14 w-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white hover:shadow-xl transition-all"
              >
                <Plus className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* ====================== LOT DETAIL VIEW ====================== */}
        {view === 'lot-detail' && selectedBatch && selectedCalc && (
          <LotDetail
            batch={selectedBatch}
            calc={selectedCalc}
            config={config}
            onBack={goBack}
            updateBatch={updateBatch}
            removeBatch={removeBatch}
          />
        )}

        {/* ====================== REPORTS VIEW ====================== */}
        {view === 'reports' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Reportes</h2>
            </div>
            <ReportsPanel
              batches={batches}
              config={config}
              calculations={liveCalcs}
              structuralExpenses={structuralExpenses}
              farmName="Granja Nidal"
            />
          </div>
        )}

        {/* ====================== HISTORY VIEW ====================== */}
        {view === 'history' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Historial</h2>
            </div>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Notas del Mes</CardTitle>
                <CardDescription className="text-[11px">Observaciones o comentarios sobre el mes actual</CardDescription>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ej: Lote 2 con mortalidad elevada..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Records */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="w-4 h-4 text-stone-600" /> Registros Guardados
                    </CardTitle>
                    <CardDescription className="text-[11px]">Historial mensual ({savedRecords.length} registros)</CardDescription>
                  </div>
                  {savedRecords.length > 0 && (
                    <Button variant="outline" size="sm" className="text-[10px] h-7 text-red-500"
                      onClick={() => { if (confirm('Borrar todos los registros?')) setSavedRecords([]) }}>
                      <Trash2 className="w-3 h-3 mr-1" /> Borrar todo
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {savedRecords.length === 0 ? (
                  <div className="text-center py-10 text-stone-400">
                    <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No hay registros guardados aun.</p>
                    <p className="text-xs mt-1">Configura y guarda el primer registro.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                    {savedRecords.map((record) => {
                      const isExpanded = expandedRecord === record.id
                      return (
                        <div key={record.id} className="border rounded-lg overflow-hidden">
                          <div
                            className="p-3 cursor-pointer hover:bg-stone-50 transition-colors"
                            onClick={() => setExpandedRecord(isExpanded ? null : record.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                <span className="font-semibold text-sm">{record.month}</span>
                                <span className="text-[10px] text-stone-400">{record.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">{fmtRD(record.config.eggPrice)}/huevo</Badge>
                                <Badge className={record.net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {fmtRD(record.net)}
                                </Badge>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-stone-700"
                                  onClick={e => { e.stopPropagation(); setExpandedRecord(isExpanded ? null : record.id) }}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-red-500"
                                  onClick={e => { e.stopPropagation(); deleteRecord(record.id) }}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="px-4 pb-3 border-t bg-stone-50/50 space-y-2">
                              <div className="text-[11px] text-stone-500">
                                <strong>Notas:</strong> {record.notes || 'Sin notas'}
                              </div>
                              <Table>
                                <TableBody>
                                  <TableRow><TableCell className="text-[11px] font-medium">Lotes activos</TableCell><TableCell className="text-[11px]">{record.batches.filter(b => b.isLaying).length} en postura de {record.batches.length}</TableCell></TableRow>
                                  <TableRow><TableCell className="text-[11px] font-medium">Aves totales</TableCell><TableCell className="text-[11px]">{record.batches.reduce((s, b) => s + b.hens, 0)}</TableCell></TableRow>
                                  <TableRow><TableCell className="text-[11px] font-medium">Ingreso</TableCell><TableCell className="text-[11px] text-green-700">{fmtRD(record.revenue)}</TableCell></TableRow>
                                  <TableRow><TableCell className="text-[11px] font-medium">Gastos</TableCell><TableCell className="text-[11px] text-red-700">{fmtRD(record.expenses)}</TableCell></TableRow>
                                  <TableRow><TableCell className="text-[11px] font-bold">Utilidad Neta</TableCell><TableCell className={`text-[11px] font-bold ${record.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtRD(record.net)}</TableCell></TableRow>
                                </TableBody>
                              </Table>
                              <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1 text-[10px] h-7">
                                  <Printer className="w-3 h-3" /> Imprimir
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ====================== MAP VIEW ====================== */}
        {view === 'map' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Vista Granja</h2>
            </div>
            <FarmMapView batches={batches} config={config} calculations={liveCalcs} />
          </div>
        )}

        {/* ====================== REMINDERS VIEW ====================== */}
        {view === 'reminders' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Alertas</h2>
            </div>
            <RemindersPanel
              batches={batches}
              config={config}
              fmtRD={fmtRD}
              fmtNum={fmtNum}
            />
          </div>
        )}
      </main>

      {/* Config Sheet */}
      <ConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={config}
        setConfig={setConfig}
        batches={batches}
        structuralExpenses={structuralExpenses}
        setStructuralExpenses={setStructuralExpenses}
        liveCalcs={liveCalcs}
        notes={notes}
        setNotes={setNotes}
        saveRecord={saveRecord}
        resetAll={resetAll}
      />
    </div>
  )
}
