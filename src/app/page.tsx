'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Egg,
  Wheat,
  Save,
  RotateCcw,
  Plus,
  Minus,
  BarChart3,
  PieChart,
  Info,
  ClipboardList,
  Settings,
  FileText,
  Building2,
  Heart,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Box,
  Zap,
  Activity,
  Target,
  LayoutGrid,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ================================================================
// TYPES
// ================================================================
type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

interface FeedPhase {
  label: string
  consumption: number  // grams/bird/day
  price: number        // RD$/quintal
  weeks: string        // week range
}

interface FarmConfig {
  // === PRECIOS DE VENTA ===
  eggPrice: number           // RD$ per egg
  henSalePrice: number       // RD$ per spent hen
  chickPrice: number         // RD$ per chick

  // === ALIMENTO POR FASE ===
  feedPhases: Record<PhaseKey, FeedPhase>

  // === COSTOS POR AVE (INVERSION INICIAL) ===
  vaccinesCostPerBird: number  // RD$
  equipmentCostPerBird: number // RD$
  mortalityRate: number        // % expected mortality in rearing

  // === INFRAESTRUCTURA ===
  shed1Cost: number        // RD$ (galpon principal con equipo)
  shedAdditionalCost: number // RD$ (galpones adicionales)

  // === OPERACION ===
  baseLayingRate: number       // % (e.g. 80)
  layingCycleMonths: number    // months of laying cycle
  hensPerBatch: number         // default hens per batch
  fixedCostsMonthly: number    // RD$ monthly overhead
  otherCosts: number           // RD$ additional monthly
}

interface BatchConfig {
  id: string
  name: string
  hens: number
  layingRate: number
  isLaying: boolean
  cycleMonth: number
  phase: PhaseKey
}

interface MonthlyRecord {
  id: string
  month: string
  date: string
  batches: BatchConfig[]
  config: FarmConfig
  notes: string
  revenue: number
  expenses: number
  net: number
}

// ================================================================
// DEFAULT CONFIG
// ================================================================
const DEFAULT_FEED: Record<PhaseKey, FeedPhase> = {
  pre_inicio:  { label: 'Pre-Inicio',  consumption: 12,  price: 2800, weeks: 'S0-4' },
  inicio:      { label: 'Inicio',       consumption: 28,  price: 2600, weeks: 'S4-8' },
  crecimiento: { label: 'Crecimiento',  consumption: 58,  price: 2400, weeks: 'S8-14' },
  pre_postura: { label: 'Pre-Postura',  consumption: 85,  price: 2200, weeks: 'S14-18' },
  postura:     { label: 'Postura',      consumption: 115, price: 1500, weeks: 'S18+' },
}

const DEFAULT_CONFIG: FarmConfig = {
  eggPrice: 5.50,
  henSalePrice: 100,
  chickPrice: 86.10,
  feedPhases: DEFAULT_FEED,
  vaccinesCostPerBird: 52.68,
  equipmentCostPerBird: 23.60,
  mortalityRate: 5,
  shed1Cost: 624750,
  shedAdditionalCost: 315000,
  baseLayingRate: 80,
  layingCycleMonths: 20,
  hensPerBatch: 2000,
  fixedCostsMonthly: 85000,
  otherCosts: 0,
}

const BATCH_NAMES = ['Galpon 1', 'Galpon 2', 'Galpon 3', 'Galpon 4']

const PHASE_COLORS: Record<PhaseKey, string> = {
  pre_inicio: 'bg-gray-100 text-gray-700',
  inicio: 'bg-sky-100 text-sky-700',
  crecimiento: 'bg-cyan-100 text-cyan-700',
  pre_postura: 'bg-amber-100 text-amber-700',
  postura: 'bg-green-100 text-green-700',
}

const PHASE_KEYS: PhaseKey[] = ['pre_inicio', 'inicio', 'crecimiento', 'pre_postura', 'postura']

// ================================================================
// HELPERS
// ================================================================
function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function fmtNum(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}

function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

function getPhaseFromMonth(month: number): PhaseKey {
  if (month < 1) return 'pre_inicio'
  if (month < 2) return 'inicio'
  if (month < 3.5) return 'crecimiento'
  if (month < 5) return 'pre_postura'
  return 'postura'
}

function createDefaultBatches(): BatchConfig[] {
  return BATCH_NAMES.map((name, i) => ({
    id: `batch-${i}`,
    name,
    hens: DEFAULT_CONFIG.hensPerBatch,
    layingRate: DEFAULT_CONFIG.baseLayingRate,
    isLaying: false,
    cycleMonth: 0,
    phase: 'pre_inicio' as PhaseKey,
  }))
}

// ================================================================
// SUB COMPONENTS
// ================================================================

function NumberInput({
  label, value, onChange, step = 1, min, max, prefix, suffix, className = '',
  tooltip, disabled = false, highlightOnDefault, defaultValue,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  className?: string
  tooltip?: string
  disabled?: boolean
  highlightOnDefault?: boolean
  defaultValue?: number
}) {
  const isChanged = defaultValue !== undefined && value !== defaultValue
  return (
    <TooltipProvider delayDuration={200}>
      <div className={`space-y-1.5 ${className}`}>
        <div className="flex items-center gap-1">
          <Label className="text-xs text-stone-600">{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-stone-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="relative">
          {prefix && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{prefix}</span>
          )}
          <Input
            type="number"
            step={step}
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            disabled={disabled}
            className={`text-sm h-9 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''} ${
              highlightOnDefault && isChanged
                ? 'border-amber-400 bg-amber-50/50'
                : ''
            }`}
          />
          {suffix && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

function ChangeIndicator({ current, original, unit = '' }: { current: number; original: number; unit?: string }) {
  if (current === original) return null
  const diff = current - original
  const pct = original !== 0 ? ((diff / original) * 100) : 0
  const isUp = diff > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isUp ? 'text-red-500' : 'text-green-500'}`}>
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {isUp ? '+' : ''}{fmtNum(Math.abs(diff))}{unit} ({isUp ? '+' : ''}{pct.toFixed(1)}%)
    </span>
  )
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function Home() {
  const [config, setConfig] = useState<FarmConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('granja-wd80-config')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return { ...DEFAULT_CONFIG, ...parsed, feedPhases: { ...DEFAULT_FEED, ...(parsed.feedPhases || {}) } }
        } catch { /* ignore */ }
      }
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
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState('config')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ventas: true,
    alimento: true,
    ave: true,
    infraestructura: false,
    operacion: true,
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('granja-wd80-config', JSON.stringify(config))
  }, [config])
  useEffect(() => {
    localStorage.setItem('granja-wd80-batches', JSON.stringify(batches))
  }, [batches])
  useEffect(() => {
    localStorage.setItem('granja-wd80-records', JSON.stringify(savedRecords))
  }, [savedRecords])

  const toggleSection = useCallback((key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  // ---- Handlers ----
  const updateConfig = useCallback(<K extends keyof FarmConfig>(key: K, value: FarmConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateFeedPhase = useCallback((phaseKey: PhaseKey, field: 'consumption' | 'price', value: number) => {
    setConfig(prev => ({
      ...prev,
      feedPhases: {
        ...prev.feedPhases,
        [phaseKey]: { ...prev.feedPhases[phaseKey], [field]: value },
      },
    }))
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
    setBatches(prev => [...prev, {
      id: `batch-${prev.length}`,
      name: `Galpon ${num}`,
      hens: config.hensPerBatch,
      layingRate: config.baseLayingRate,
      isLaying: false,
      cycleMonth: 0,
      phase: 'pre_inicio',
    }])
  }, [batches.length, config.hensPerBatch, config.baseLayingRate])

  const removeBatch = useCallback((id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id))
  }, [])

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
        ...prev,
        baseLayingRate: DEFAULT_CONFIG.baseLayingRate,
        layingCycleMonths: DEFAULT_CONFIG.layingCycleMonths,
        hensPerBatch: DEFAULT_CONFIG.hensPerBatch,
        fixedCostsMonthly: DEFAULT_CONFIG.fixedCostsMonthly,
        otherCosts: DEFAULT_CONFIG.otherCosts,
      }))
    }
  }, [])

  const deleteRecord = useCallback((id: string) => {
    setSavedRecords(prev => prev.filter(r => r.id !== id))
  }, [])

  // ================================================================
  // CORE CALCULATIONS - reactive to ALL config + batch changes
  // ================================================================
  const calculations = useMemo(() => {
    // Per-batch calculations
    const batchDetails = batches.map(batch => {
      const phase = batch.phase
      const feed = config.feedPhases[phase]
      const monthlyFeedKg = (batch.hens * feed.consumption * 30) / 1000
      const monthlyFeedCost = monthlyFeedKg * (feed.price / 100)  // price is per quintal (100kg)

      const eggsPerDay = batch.isLaying ? batch.hens * (batch.layingRate / 100) : 0
      const eggsPerMonth = Math.round(eggsPerDay * 30)
      const eggRevenue = eggsPerMonth * config.eggPrice

      const initialInvestmentPerBird = config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird
      const batchInvestment = batch.hens * initialInvestmentPerBird

      return {
        id: batch.id,
        name: batch.name,
        phase,
        hens: batch.hens,
        isLaying: batch.isLaying,
        layingRate: batch.layingRate,
        cycleMonth: batch.cycleMonth,
        eggsPerDay,
        eggsPerMonth,
        eggRevenue,
        feedConsumption: feed.consumption,
        feedPrice: feed.price,
        monthlyFeedKg,
        monthlyFeedCost,
        initialInvestmentPerBird,
        batchInvestment,
        netBalance: eggRevenue - monthlyFeedCost,
      }
    })

    // Totals
    const totalEggRevenue = batchDetails.reduce((s, b) => s + b.eggRevenue, 0)
    const totalFeedCost = batchDetails.reduce((s, b) => s + b.monthlyFeedCost, 0)
    const totalFeedKg = batchDetails.reduce((s, b) => s + b.monthlyFeedKg, 0)
    const totalRevenue = totalEggRevenue
    const totalExpenses = totalFeedCost + config.fixedCostsMonthly + config.otherCosts
    const netProfit = totalRevenue - totalExpenses
    const layingBatches = batches.filter(b => b.isLaying).length
    const totalHens = batches.reduce((s, b) => s + b.hens, 0)
    const totalEggs = batchDetails.reduce((s, b) => s + b.eggsPerMonth, 0)

    // Derived KPIs
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const feedPercentage = totalExpenses > 0 ? (totalFeedCost / totalExpenses) * 100 : 0
    const costPerEgg = totalEggs > 0 ? totalExpenses / totalEggs : 0
    const costPerBirdMonthly = totalHens > 0 ? totalExpenses / totalHens : 0
    const revenuePerBirdMonthly = totalHens > 0 ? totalRevenue / totalHens : 0

    // Feed cost per laying bird per month
    const layingBirds = batches.filter(b => b.isLaying).reduce((s, b) => s + b.hens, 0)
    const feedCostPerLayingBird = layingBirds > 0 ? totalFeedCost / layingBirds : 0

    // Hen sale revenue at cycle end
    const totalHenSaleRevenue = totalHens * config.henSalePrice

    // Initial investment for a new batch
    const newBatchInvestment = config.hensPerBatch * (config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird)
    const newBatchInvestmentWithMortality = newBatchInvestment / (1 - config.mortalityRate / 100)

    // Infrastructure total
    const infraCost = config.shed1Cost + (Math.max(0, batches.length - 1) * config.shedAdditionalCost)

    // Monthly pre-lay feed cost (for a batch in rearing)
    const preLayMonthlyCost = PHASE_KEYS
      .filter(k => k !== 'postura')
      .reduce((sum, key) => {
        const feed = config.feedPhases[key]
        // Approximate: assume ~1 month per phase in rearing
        const monthlyKg = (config.hensPerBatch * feed.consumption * 30) / 1000
        return sum + (monthlyKg * feed.price / 100)
      }, 0) / 4 // average across 4 pre-lay months

    // Revenue per quintal of feed (efficiency metric)
    const layingBatchDetails = batchDetails.filter(b => b.isLaying)
    const totalLayingFeedCost = layingBatchDetails.reduce((s, b) => s + b.monthlyFeedCost, 0)
    const revenuePerFeedRD = totalLayingFeedCost > 0 ? totalEggRevenue / totalLayingFeedCost : 0

    // Break-even eggs per day (total)
    const dailyExpenses = totalExpenses / 30
    const breakEvenEggsPerDay = config.eggPrice > 0 ? Math.ceil(dailyExpenses / config.eggPrice) : 0

    return {
      batchDetails,
      totalEggRevenue,
      totalHenSaleRevenue,
      totalRevenue,
      totalFeedCost,
      totalFeedKg,
      totalExpenses,
      netProfit,
      layingBatches,
      totalHens,
      totalEggs,
      profitMargin,
      feedPercentage,
      costPerEgg,
      costPerBirdMonthly,
      revenuePerBirdMonthly,
      feedCostPerLayingBird,
      newBatchInvestment,
      newBatchInvestmentWithMortality,
      infraCost,
      preLayMonthlyCost,
      revenuePerFeedRD,
      breakEvenEggsPerDay,
      dailyExpenses,
      layingBirds,
    }
  }, [batches, config])

  const saveRecord = useCallback(() => {
    const now = new Date()
    const record: MonthlyRecord = {
      id: `rec-${Date.now()}`,
      month: now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }),
      date: now.toLocaleDateString('es-DO'),
      batches: JSON.parse(JSON.stringify(batches)),
      config: JSON.parse(JSON.stringify(config)),
      notes,
      revenue: calculations.totalRevenue,
      expenses: calculations.totalExpenses,
      net: calculations.netProfit,
    }
    setSavedRecords(prev => [record, ...prev])
    setNotes('')
  }, [batches, config, notes, calculations.totalRevenue, calculations.totalExpenses, calculations.netProfit])

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 to-amber-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                <Egg className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-stone-900">Granja Gallinas WD80</h1>
                <p className="text-[11px] text-stone-500">Calculadora de Gastos e Ingresos | Estrategia C</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                <Activity className="w-3 h-3 mr-1" />
                {calculations.layingBatches}/{batches.length} postura
              </Badge>
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                {fmtNum(calculations.totalHens)} aves
              </Badge>
              <Badge className={`text-xs ${calculations.netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {fmtRD(calculations.netProfit)}/mes
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {/* Summary Cards - always visible */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2.5 mb-5">
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
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-600" />
                <span className="text-[10px] font-medium text-stone-500 uppercase">Gastos</span>
              </div>
              <p className="text-base sm:text-lg font-bold text-red-700">{fmtRD(calculations.totalExpenses)}</p>
              <p className="text-[10px] text-stone-400">Feed: {fmtRD(calculations.totalFeedCost)}</p>
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
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 mb-5">
            <TabsTrigger value="config" className="text-xs sm:text-sm">
              <Settings className="w-4 h-4 mr-1 hidden sm:inline" />
              Config Base
            </TabsTrigger>
            <TabsTrigger value="batches" className="text-xs sm:text-sm">
              <ClipboardList className="w-4 h-4 mr-1 hidden sm:inline" />
              Lotes
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              <BarChart3 className="w-4 h-4 mr-1 hidden sm:inline" />
              Detalle
            </TabsTrigger>
            <TabsTrigger value="kpis" className="text-xs sm:text-sm">
              <Sparkles className="w-4 h-4 mr-1 hidden sm:inline" />
              KPIs
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* ============ TAB: CONFIGURACION BASE ============ */}
          <TabsContent value="config">
            <div className="space-y-4">

              {/* Section 1: PRECIOS DE VENTA */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('ventas')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-700" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Precios de Venta</CardTitle>
                        <CardDescription className="text-[11px]">Precios actuales del mercado para tus productos</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400"
                        onClick={e => { e.stopPropagation(); resetSection('ventas') }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      {openSections.ventas ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </div>
                </CardHeader>
                {openSections.ventas && (
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <NumberInput
                        label="Precio por Huevo"
                        value={config.eggPrice}
                        onChange={v => updateConfig('eggPrice', v)}
                        step={0.10}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.eggPrice}
                        highlightOnDefault
                        tooltip="Precio de venta al publico por cada huevo. Afecta directamente el ingreso total."
                      />
                      <NumberInput
                        label="Venta Gallina de Desecho"
                        value={config.henSalePrice}
                        onChange={v => updateConfig('henSalePrice', v)}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.henSalePrice}
                        highlightOnDefault
                        tooltip="Precio por gallina al final del ciclo de postura (20 meses). Ingreso de disposicion."
                      />
                      <NumberInput
                        label="Precio Pollita/ Ave Nueva"
                        value={config.chickPrice}
                        onChange={v => updateConfig('chickPrice', v)}
                        step={0.10}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.chickPrice}
                        highlightOnDefault
                        tooltip="Costo de adquisicion de cada pollita WD80. Afecta la inversion inicial por lote."
                      />
                    </div>
                    {/* Live calculation preview */}
                    <div className="mt-3 p-2.5 bg-green-50 rounded-lg">
                      <p className="text-[11px] text-green-800">
                        Con {fmtNum(config.hensPerBatch)} aves al {config.baseLayingRate}%: Ingreso por lote en postura = <strong>{fmtRD(config.hensPerBatch * (config.baseLayingRate / 100) * 30 * config.eggPrice)}/mes</strong>
                        {' | '}Ingreso por gallina al desecho = <strong>{fmtRD(config.henSalePrice)}</strong>
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Section 2: ALIMENTO POR FASE */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('alimento')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Wheat className="w-4 h-4 text-amber-700" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Alimento por Fase</CardTitle>
                        <CardDescription className="text-[11px]">Precios (RD$/qq) y consumo (g/ave/dia) por cada fase. Marca: Nutriovo Sanut</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400"
                        onClick={e => { e.stopPropagation(); resetSection('alimento') }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      {openSections.alimento ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </div>
                </CardHeader>
                {openSections.alimento && (
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Fase</TableHead>
                            <TableHead className="text-xs">Semanas</TableHead>
                            <TableHead className="text-xs text-right">Consumo (g/ave/dia)</TableHead>
                            <TableHead className="text-xs text-right">Precio (RD$/qq)</TableHead>
                            <TableHead className="text-xs text-right">Costo mes/lote</TableHead>
                            <TableHead className="text-xs text-center">Cambio vs Base</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {PHASE_KEYS.map(key => {
                            const feed = config.feedPhases[key]
                            const defFeed = DEFAULT_FEED[key]
                            const monthlyCost = (config.hensPerBatch * feed.consumption * 30 * feed.price) / 100
                            const defMonthlyCost = (DEFAULT_CONFIG.hensPerBatch * defFeed.consumption * 30 * defFeed.price) / 100
                            return (
                              <TableRow key={key} className="group">
                                <TableCell>
                                  <Badge className={`${PHASE_COLORS[key]} text-[10px] whitespace-nowrap`}>
                                    {feed.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-stone-500">{feed.weeks}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step={1}
                                    min={0}
                                    max={200}
                                    value={feed.consumption}
                                    onChange={e => updateFeedPhase(key, 'consumption', parseFloat(e.target.value) || 0)}
                                    className="w-20 h-7 text-xs text-right mx-auto"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    step={50}
                                    min={0}
                                    value={feed.price}
                                    onChange={e => updateFeedPhase(key, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-24 h-7 text-xs text-right mx-auto"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-xs font-medium">{fmtRD(monthlyCost)}</TableCell>
                                <TableCell className="text-center">
                                  <ChangeIndicator current={monthlyCost} original={defMonthlyCost} />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button variant="outline" size="sm" className="text-[10px] h-7"
                        onClick={() => setConfig(prev => ({ ...prev, feedPhases: { ...DEFAULT_FEED } }))}>
                        Precios base originales
                      </Button>
                      <Button variant="outline" size="sm" className="text-[10px] h-7"
                        onClick={() => {
                          const p = config.feedPhases.postura.price
                          setConfig(prev => ({
                            ...prev,
                            feedPhases: {
                              ...prev.feedPhases,
                              pre_inicio: { ...prev.feedPhases.pre_inicio, price: Math.round(p * 1.87) },
                              inicio: { ...prev.feedPhases.inicio, price: Math.round(p * 1.73) },
                              crecimiento: { ...prev.feedPhases.crecimiento, price: Math.round(p * 1.60) },
                              pre_postura: { ...prev.feedPhases.pre_postura, price: Math.round(p * 1.47) },
                            }
                          }))
                        }}>
                        Proporcional a postura ({fmtRD(config.feedPhases.postura.price)})
                      </Button>
                    </div>
                    {/* Live calculation */}
                    <div className="mt-3 p-2.5 bg-amber-50 rounded-lg">
                      <p className="text-[11px] text-amber-800">
                        Feed total este mes: <strong>{fmtRD(calculations.totalFeedCost)}</strong> ({fmtNum(Math.round(calculations.totalFeedKg))} kg)
                        {' | '}Feed/ave en postura: <strong>{fmtRD(calculations.feedCostPerLayingBird)}/mes</strong>
                        {' | '}RD$ ingreso por RD$ en feed: <strong>x{calculations.revenuePerFeedRD.toFixed(2)}</strong>
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Section 3: COSTOS POR AVE */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('ave')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                        <Heart className="w-4 h-4 text-violet-700" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Costos por Ave (Inversion Inicial)</CardTitle>
                        <CardDescription className="text-[11px]">Gastos al iniciar cada lote nuevo de pollitas</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400"
                        onClick={e => { e.stopPropagation(); resetSection('ave') }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      {openSections.ave ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </div>
                </CardHeader>
                {openSections.ave && (
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <NumberInput
                        label="Costo Vacunas / Ave"
                        value={config.vaccinesCostPerBird}
                        onChange={v => updateConfig('vaccinesCostPerBird', v)}
                        step={0.01}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.vaccinesCostPerBird}
                        highlightOnDefault
                        tooltip="Incluye Newcastle, Gumboro, Bronquitis, etc. Plan vacunal completo WD80."
                      />
                      <NumberInput
                        label="Costo Equipo / Ave"
                        value={config.equipmentCostPerBird}
                        onChange={v => updateConfig('equipmentCostPerBird', v)}
                        step={0.01}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.equipmentCostPerBird}
                        highlightOnDefault
                        tooltip="Bebederos, comederos, nidos, termometros, etc. Amortizado por ave."
                      />
                      <NumberInput
                        label="Mortalidad Esperada (Cria)"
                        value={config.mortalityRate}
                        onChange={v => updateConfig('mortalityRate', Math.min(20, Math.max(0, v)))}
                        step={0.5}
                        min={0}
                        max={20}
                        suffix="%"
                        defaultValue={DEFAULT_CONFIG.mortalityRate}
                        highlightOnDefault
                        tooltip="% de aves que no llegan a postura. Ajusta la inversion real por ave productiva."
                      />
                    </div>
                    <div className="mt-3 p-2.5 bg-violet-50 rounded-lg">
                      <p className="text-[11px] text-violet-800">
                        Inversion por ave: <strong>{fmtRD(config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird)}</strong>
                        {' '}(pollita {fmtRD(config.chickPrice)} + vacunas {fmtRD(config.vaccinesCostPerBird)} + equipo {fmtRD(config.equipmentCostPerBird)})
                        {' | '}Con {config.mortalityRate}% mortalidad: <strong>{fmtRD(calculations.newBatchInvestmentWithMortality)}/lote</strong> ({fmtNum(config.hensPerBatch)} aves)
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Section 4: INFRAESTRUCTURA */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('infraestructura')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-stone-700" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Infraestructura</CardTitle>
                        <CardDescription className="text-[11px]">Costos de construccion y equipamiento de galpones</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400"
                        onClick={e => { e.stopPropagation(); resetSection('infraestructura') }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      {openSections.infraestructura ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </div>
                </CardHeader>
                {openSections.infraestructura && (
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <NumberInput
                        label="Galpon 1 (Completo con Equipo)"
                        value={config.shed1Cost}
                        onChange={v => updateConfig('shed1Cost', v)}
                        step={5000}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.shed1Cost}
                        highlightOnDefault
                        tooltip="Construccion + equipamiento completo del primer galpon. Incluyeestructura, electricidad, agua."
                      />
                      <NumberInput
                        label="Galpones Adicionales (c/u)"
                        value={config.shedAdditionalCost}
                        onChange={v => updateConfig('shedAdditionalCost', v)}
                        step={5000}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.shedAdditionalCost}
                        highlightOnDefault
                        tooltip="Costo de cada galpon adicional. Mas economico al compartir infraestructura del galpon 1."
                      />
                    </div>
                    <div className="mt-3 p-2.5 bg-stone-100 rounded-lg">
                      <p className="text-[11px] text-stone-700">
                        Infraestructura total ({batches.length} galpones): <strong>{fmtRD(calculations.infraCost)}</strong>
                        {' | '}Galpon 1: {fmtRD(config.shed1Cost)} + {Math.max(0, batches.length - 1)} adicionales x {fmtRD(config.shedAdditionalCost)}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Section 5: OPERACION */}
              <Card>
                <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('operacion')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center">
                        <LayoutGrid className="w-4 h-4 text-sky-700" />
                      </div>
                      <div>
                        <CardTitle className="text-sm">Parametros de Operacion</CardTitle>
                        <CardDescription className="text-[11px]">Variables operativas del negocio avicola</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400"
                        onClick={e => { e.stopPropagation(); resetSection('operacion') }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset
                      </Button>
                      {openSections.operacion ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                    </div>
                  </div>
                </CardHeader>
                {openSections.operacion && (
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <NumberInput
                        label="% Postura Base (WD80)"
                        value={config.baseLayingRate}
                        onChange={v => updateConfig('baseLayingRate', Math.min(98, Math.max(50, v)))}
                        step={1}
                        min={50}
                        max={98}
                        suffix="%"
                        defaultValue={DEFAULT_CONFIG.baseLayingRate}
                        highlightOnDefault
                        tooltip="Porcentaje de aves que ponen huevos diariamente. Raza WD80: 80-85% tipico."
                      />
                      <NumberInput
                        label="Duracion Ciclo Postura"
                        value={config.layingCycleMonths}
                        onChange={v => updateConfig('layingCycleMonths', Math.min(30, Math.max(12, v)))}
                        step={1}
                        min={12}
                        max={30}
                        suffix="meses"
                        defaultValue={DEFAULT_CONFIG.layingCycleMonths}
                        highlightOnDefault
                        tooltip="Meses de produccion antes de vender como desecho. WD80: 18-22 meses optimo."
                      />
                      <NumberInput
                        label="Aves por Lote (Default)"
                        value={config.hensPerBatch}
                        onChange={v => updateConfig('hensPerBatch', Math.max(100, v))}
                        step={100}
                        min={100}
                        suffix="aves"
                        defaultValue={DEFAULT_CONFIG.hensPerBatch}
                        highlightOnDefault
                        tooltip="Cantidad de aves por galpon. Capacidad tipica: 1,500-3,000 segun tamano del galpon."
                      />
                      <NumberInput
                        label="Gastos Fijos Mensuales"
                        value={config.fixedCostsMonthly}
                        onChange={v => updateConfig('fixedCostsMonthly', v)}
                        step={1000}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.fixedCostsMonthly}
                        highlightOnDefault
                        tooltip="Salarios, luz, agua, combustible, mantenimiento, insumos. Total mensual fijo."
                      />
                      <NumberInput
                        label="Otros Gastos Adicionales"
                        value={config.otherCosts}
                        onChange={v => updateConfig('otherCosts', v)}
                        step={1000}
                        prefix="RD$"
                        defaultValue={DEFAULT_CONFIG.otherCosts}
                        highlightOnDefault
                        tooltip="Gastos extraordinarios no recurrentes del mes."
                      />
                    </div>
                    {/* Quick preset buttons for fixed costs */}
                    <div className="mt-2">
                      <Label className="text-[10px] text-stone-400">Presets gastos fijos:</Label>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {[55000, 70000, 85000, 100000].map(v => (
                          <Button key={v} variant="outline" size="sm" className="text-[10px] h-6"
                            onClick={() => updateConfig('fixedCostsMonthly', v)}>
                            {fmtRD(v)}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 p-2.5 bg-sky-50 rounded-lg">
                      <p className="text-[11px] text-sky-800">
                        Gastos fijos: <strong>{fmtRD(config.fixedCostsMonthly)}</strong> + Otros: <strong>{fmtRD(config.otherCosts)}</strong> = <strong>{fmtRD(config.fixedCostsMonthly + config.otherCosts)}</strong>
                        {' | '}Costo por ave/mes: <strong>{fmtRD(calculations.costPerBirdMonthly)}</strong>
                        {' | '}Ingreso por ave/mes: <strong>{fmtRD(calculations.revenuePerBirdMonthly)}</strong>
                        {' | '}Punto equilibrio: <strong>{fmtNum(calculations.breakEvenEggsPerDay)} huevos/dia</strong>
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Bottom actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button onClick={saveRecord} className="gap-2">
                  <Save className="w-4 h-4" /> Guardar registro del mes
                </Button>
                <Button variant="outline" onClick={resetAll} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Restaurar todo por defecto
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* ============ TAB: LOTES ============ */}
          <TabsContent value="batches">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-violet-600" />
                      Estado Actual de Lotes
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Configura cada galpon. La fase se calcula automaticamente al cambiar el mes del ciclo.
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addBatch} className="gap-1 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Agregar Lote
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batches.map((batch) => {
                    const feed = config.feedPhases[batch.phase]
                    const monthlyFeedCost = (batch.hens * feed.consumption * 30 * feed.price) / 100
                    const eggsPerMonth = batch.isLaying ? Math.round(batch.hens * (batch.layingRate / 100) * 30) : 0
                    const eggRevenue = eggsPerMonth * config.eggPrice
                    return (
                      <div key={batch.id} className={`border rounded-lg p-4 space-y-3 ${batch.isLaying ? 'border-green-200 bg-green-50/30' : 'border-stone-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{batch.name}</span>
                            <Badge className={PHASE_COLORS[batch.phase]}>
                              {feed.label} ({feed.weeks})
                            </Badge>
                            {batch.isLaying && (
                              <Badge className="bg-green-100 text-green-700">
                                En postura
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">
                              {batch.isLaying ? `+${fmtRD(eggRevenue - monthlyFeedCost)}/mes` : `-${fmtRD(monthlyFeedCost)}/mes`}
                            </Badge>
                            {batches.length > 1 && (
                              <Button variant="ghost" size="sm" onClick={() => removeBatch(batch.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <NumberInput
                            label="Aves"
                            value={batch.hens}
                            onChange={v => updateBatch(batch.id, 'hens', v)}
                            step={50}
                            min={0}
                            tooltip="Cantidad de aves activas en este galpon."
                          />
                          <NumberInput
                            label="Mes del Ciclo"
                            value={batch.cycleMonth}
                            onChange={v => updateBatch(batch.id, 'cycleMonth', v)}
                            step={0.5}
                            min={0}
                            max={30}
                            tooltip="Mes actual desde el inicio del lote. La fase se calcula automaticamente."
                          />
                          <NumberInput
                            label="% Postura"
                            value={batch.layingRate}
                            onChange={v => updateBatch(batch.id, 'layingRate', v)}
                            step={1}
                            min={0}
                            max={100}
                            suffix="%"
                            disabled={!batch.isLaying}
                            tooltip="Porcentaje actual de postura. Solo editable cuando el lote esta en postura."
                          />
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-600">Fase Actual</Label>
                            <div className="h-9 rounded-md border bg-stone-50 px-3 flex items-center text-sm text-stone-600">
                              {feed.label}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-stone-600">Feed Costo/Mes</Label>
                            <div className="h-9 rounded-md border bg-red-50 px-3 flex items-center text-sm text-red-700 font-medium">
                              {fmtRD(monthlyFeedCost)}
                            </div>
                          </div>
                        </div>
                        {/* Quick phase buttons */}
                        <div className="flex flex-wrap gap-1">
                          {PHASE_KEYS.map(phase => (
                            <Button key={phase} variant={batch.phase === phase ? 'default' : 'outline'} size="sm"
                              className="text-[10px] h-6 px-2"
                              onClick={() => updateBatch(batch.id, 'phase', phase)}>
                              {config.feedPhases[phase].label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TAB: DETALLE ============ */}
          <TabsContent value="details">
            <div className="space-y-5">
              {/* Batch Detail Table */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-stone-600" />
                    Detalle Financiero por Lote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Lote</TableHead>
                          <TableHead className="text-xs">Fase</TableHead>
                          <TableHead className="text-xs text-right">Aves</TableHead>
                          <TableHead className="text-xs text-right">% Postura</TableHead>
                          <TableHead className="text-xs text-right">Huevos/Mes</TableHead>
                          <TableHead className="text-xs text-right">Ing. Huevos</TableHead>
                          <TableHead className="text-xs text-right">Gasto Feed</TableHead>
                          <TableHead className="text-xs text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {calculations.batchDetails.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium text-sm">{b.name}</TableCell>
                            <TableCell>
                              <Badge className={`${PHASE_COLORS[b.phase as PhaseKey]} text-[10px]`}>
                                {config.feedPhases[b.phase as PhaseKey].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm">{fmtNum(b.hens)}</TableCell>
                            <TableCell className="text-right text-sm">{b.isLaying ? `${b.layingRate}%` : '-'}</TableCell>
                            <TableCell className="text-right text-sm">{b.isLaying ? fmtNum(b.eggsPerMonth) : '-'}</TableCell>
                            <TableCell className="text-right text-sm text-green-700 font-medium">
                              {b.isLaying ? fmtRD(b.eggRevenue) : '-'}
                            </TableCell>
                            <TableCell className="text-right text-sm text-red-600">
                              {fmtRD(b.monthlyFeedCost)}
                            </TableCell>
                            <TableCell className={`text-right text-sm font-bold ${b.netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                              {fmtRD(b.netBalance)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-bold border-t-2">
                          <TableCell colSpan={5} className="text-sm">TOTALES</TableCell>
                          <TableCell className="text-right text-sm text-green-700">{fmtRD(calculations.totalEggRevenue)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600">{fmtRD(calculations.totalFeedCost)}</TableCell>
                          <TableCell className={`text-right text-sm ${calculations.totalEggRevenue - calculations.totalFeedCost >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                            {fmtRD(calculations.totalEggRevenue - calculations.totalFeedCost)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Monthly Summary */}
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Desglose de Gastos Mensual</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Alimentacion', value: calculations.totalFeedCost, color: 'bg-amber-500' },
                        { label: 'Gastos Fijos', value: config.fixedCostsMonthly, color: 'bg-stone-500' },
                        { label: 'Otros Gastos', value: config.otherCosts, color: 'bg-violet-500' },
                      ].map(item => {
                        const pct = calculations.totalExpenses > 0 ? (item.value / calculations.totalExpenses) * 100 : 0
                        return (
                          <div key={item.label} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{item.label}</span>
                              <span className="font-medium">{fmtRD(item.value)} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div className={`h-full ${item.color} rounded-full transition-all duration-300`}
                                style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total Gastos</span>
                        <span className="text-red-700">{fmtRD(calculations.totalExpenses)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Estado de Resultados del Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span>Venta de Huevos</span>
                        <span className="text-green-700 font-medium">{fmtRD(calculations.totalEggRevenue)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Venta Gallinas Desecho</span>
                        <span className="text-stone-400 font-medium">No aplica este mes</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Ingresos Totales</span>
                        <span className="text-green-700">{fmtRD(calculations.totalRevenue)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span>Alimentacion</span>
                        <span className="text-red-600">{fmtRD(calculations.totalFeedCost)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Gastos Fijos</span>
                        <span className="text-red-600">{fmtRD(config.fixedCostsMonthly)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Otros</span>
                        <span className="text-red-600">{fmtRD(config.otherCosts)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">Total Gastos</span>
                        <span className="text-red-700 font-bold">{fmtRD(calculations.totalExpenses)}</span>
                      </div>
                      <Separator />
                      <div className={`flex justify-between text-base font-bold p-3 rounded-lg ${calculations.netProfit >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <span>BENEFICIO NETO</span>
                        <span>{fmtRD(calculations.netProfit)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Reference Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-[11px]">
                  <strong>Referencia rapida:</strong> Con {fmtRD(config.eggPrice)}/huevo y feed {fmtRD(config.feedPhases.postura.price)}/qq,
                  cada lote de {fmtNum(config.hensPerBatch)} aves al {config.baseLayingRate}% genera <strong>{fmtRD(config.hensPerBatch * (config.baseLayingRate / 100) * 30 * config.eggPrice)}</strong> en huevos
                  y consume <strong>{fmtRD(config.hensPerBatch * config.feedPhases.postura.consumption * 30 * config.feedPhases.postura.price / 100)}</strong> en alimento.
                  Costo por huevo: <strong>{fmtRD(calculations.costPerEgg)}</strong> vs precio venta {fmtRD(config.eggPrice)}.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* ============ TAB: KPIs ============ */}
          <TabsContent value="kpis">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Indicadores Clave de Rendimiento
                  </CardTitle>
                  <CardDescription className="text-[11px]">Todos los KPIs se recalculan en tiempo real al cambiar cualquier variable.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* KPI Cards */}
                    {[
                      { label: 'Ingreso por Lote (Postura)', value: fmtRD(config.hensPerBatch * (config.baseLayingRate / 100) * 30 * config.eggPrice), sub: `${fmtNum(config.hensPerBatch)} aves x ${config.baseLayingRate}%`, color: 'text-green-700', icon: <Egg className="w-4 h-4" /> },
                      { label: 'Gasto Feed por Lote (Postura)', value: fmtRD(config.hensPerBatch * config.feedPhases.postura.consumption * 30 * config.feedPhases.postura.price / 100), sub: `${config.feedPhases.postura.consumption}g x ${fmtRD(config.feedPhases.postura.price)}/qq`, color: 'text-red-600', icon: <Wheat className="w-4 h-4" /> },
                      { label: 'Costo por Huevo Producido', value: fmtRD(calculations.costPerEgg), sub: `Venta: ${fmtRD(config.eggPrice)} | Ganancia: ${fmtRD(config.eggPrice - calculations.costPerEgg)}`, color: calculations.costPerEgg < config.eggPrice ? 'text-green-700' : 'text-red-600', icon: <Target className="w-4 h-4" /> },
                      { label: 'Feed / Gasto Total', value: fmtPct(calculations.feedPercentage), sub: fmtRD(calculations.totalFeedCost) + ' de ' + fmtRD(calculations.totalExpenses), color: 'text-amber-700', icon: <PieChart className="w-4 h-4" /> },
                      { label: 'RD$ Ingreso por RD$ Feed', value: 'x' + calculations.revenuePerFeedRD.toFixed(2), sub: calculations.revenuePerFeedRD >= 2 ? 'Eficiencia buena' : 'Revisar precio feed', color: calculations.revenuePerFeedRD >= 2 ? 'text-green-700' : 'text-red-600', icon: <TrendingUp className="w-4 h-4" /> },
                      { label: 'Punto Equilibrio (huevos/dia)', value: fmtNum(calculations.breakEvenEggsPerDay), sub: `Produccion actual: ${fmtNum(calculations.totalEggs / 30)}/dia`, color: calculations.totalEggs / 30 >= calculations.breakEvenEggsPerDay ? 'text-green-700' : 'text-red-600', icon: <Activity className="w-4 h-4" /> },
                      { label: 'Inversion Nuevo Lote', value: fmtRD(calculations.newBatchInvestmentWithMortality), sub: `${fmtNum(config.hensPerBatch)} aves x ${fmtRD(config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird)}/ave`, color: 'text-violet-700', icon: <Box className="w-4 h-4" /> },
                      { label: 'Venta Desecho Total (al final)', value: fmtRD(calculations.totalHenSaleRevenue), sub: `${fmtNum(calculations.totalHens)} aves x ${fmtRD(config.henSalePrice)}`, color: 'text-stone-700', icon: <DollarSign className="w-4 h-4" /> },
                      { label: 'Infraestructura Total', value: fmtRD(calculations.infraCost), sub: `${batches.length} galpones`, color: 'text-stone-700', icon: <Building2 className="w-4 h-4" /> },
                    ].map(kpi => (
                      <div key={kpi.label} className="border rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-stone-500">
                          {kpi.icon}
                          <span className="text-[10px] font-medium">{kpi.label}</span>
                        </div>
                        <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                        <p className="text-[10px] text-stone-400">{kpi.sub}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Efficiency Gauges */}
              <div className="grid md:grid-cols-2 gap-5">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Eficiencia de Conversion</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Margen de Ganancia</span>
                        <span className={`font-bold ${calculations.profitMargin >= 20 ? 'text-green-700' : calculations.profitMargin >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                          {fmtPct(calculations.profitMargin)}
                        </span>
                      </div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${calculations.profitMargin >= 20 ? 'bg-green-500' : calculations.profitMargin >= 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, calculations.profitMargin))}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Alimento como % del Gasto</span>
                        <span className="font-bold text-amber-700">{fmtPct(calculations.feedPercentage)}</span>
                      </div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, calculations.feedPercentage)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span>Ratio Ingreso/Feed</span>
                        <span className={`font-bold ${calculations.revenuePerFeedRD >= 2.5 ? 'text-green-700' : 'text-amber-600'}`}>
                          x{calculations.revenuePerFeedRD.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-300 ${calculations.revenuePerFeedRD >= 2.5 ? 'bg-green-500' : 'bg-amber-500'}`}
                          style={{ width: `${Math.min(100, (calculations.revenuePerFeedRD / 4) * 100)}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Analisis de Costos por Ave</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Inversion inicial/ave</span>
                        <span className="font-medium">{fmtRD(config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Gasto mensual/ave</span>
                        <span className="font-medium text-red-600">{fmtRD(calculations.costPerBirdMonthly)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Ingreso mensual/ave</span>
                        <span className="font-medium text-green-700">{fmtRD(calculations.revenuePerBirdMonthly)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Ganancia neta/ave/mes</span>
                        <span className={calculations.revenuePerBirdMonthly - calculations.costPerBirdMonthly >= 0 ? 'text-green-700' : 'text-red-600'}>
                          {fmtRD(calculations.revenuePerBirdMonthly - calculations.costPerBirdMonthly)}
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Recupero inversion en</span>
                        <span className="font-bold">
                          {calculations.revenuePerBirdMonthly - calculations.costPerBirdMonthly > 0
                            ? `${Math.ceil((config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird) / (calculations.revenuePerBirdMonthly - calculations.costPerBirdMonthly))} meses`
                            : 'N/A'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-stone-600">Ingreso total ciclo ({config.layingCycleMonths}m)</span>
                        <span className="font-bold text-green-700">
                          {fmtRD((calculations.revenuePerBirdMonthly - calculations.costPerBirdMonthly) * config.layingCycleMonths)}/ave
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ============ TAB: HISTORIAL ============ */}
          <TabsContent value="history">
            <div className="space-y-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Notas del Mes</CardTitle>
                  <CardDescription className="text-[11px]">Observaciones o comentarios sobre el mes actual</CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Ej: Lote 2 con mortalidad elevada, cambio de proveedor de alimento, precio del huevo subio..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4 text-stone-600" />
                        Registros Guardados
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
                      <p className="text-xs mt-1">Configura los valores y haz clic en &quot;Guardar registro del mes&quot;</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {savedRecords.map((record) => (
                        <div key={record.id} className="border rounded-lg p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{record.month}</span>
                              <span className="text-[10px] text-stone-400">{record.date}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">
                                {record.config.eggPrice}/huevo
                              </Badge>
                              <Badge className={record.net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                {fmtRD(record.net)}
                              </Badge>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-300 hover:text-red-500"
                                onClick={() => deleteRecord(record.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-2 text-[11px]">
                            <div>
                              <span className="text-stone-400 block">Ingresos</span>
                              <span className="text-green-700 font-medium">{fmtRD(record.revenue)}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Gastos</span>
                              <span className="text-red-600 font-medium">{fmtRD(record.expenses)}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Huevo</span>
                              <span className="font-medium">{fmtRD(record.config.eggPrice)}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 block">Feed Postura</span>
                              <span className="font-medium">{fmtRD(record.config.feedPhases.postura.price)}/qq</span>
                            </div>
                          </div>
                          {record.notes && (
                            <p className="text-[11px] text-stone-500 bg-stone-50 rounded p-2">{record.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <p className="text-[10px] text-stone-400">
              Granja Gallinas WD80 - Estrategia C | Calculadora de Gastos e Ingresos
            </p>
            <p className="text-[10px] text-stone-400">
              Datos guardados localmente en tu navegador
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
