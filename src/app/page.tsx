'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  Truck,
  Save,
  RotateCcw,
  Plus,
  Minus,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  ClipboardList,
  Settings,
  FileText
} from 'lucide-react'

// ============ TYPES ============
interface BatchConfig {
  id: string
  name: string
  hens: number
  layingRate: number
  isLaying: boolean
  isPreLay: boolean
  cycleMonth: number
  phase: 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'
}

interface FeedPrices {
  preInicio: number
  inicio: number
  crecimiento: number
  prePostura: number
  postura: number
}

interface FarmConfig {
  eggPrice: number
  henSalePrice: number
  chickPrice: number
  fixedCosts: number
  feedPrices: FeedPrices
  vaccinesCost: number
  equipmentCost: number
  otherCosts: number
}

interface MonthlyRecord {
  month: string
  date: string
  batches: BatchConfig[]
  config: FarmConfig
  notes: string
}

// ============ DEFAULT VALUES ============
const DEFAULT_FEED_PRICES: FeedPrices = {
  preInicio: 2800,
  inicio: 2600,
  crecimiento: 2400,
  prePostura: 2200,
  postura: 1500,
}

const DEFAULT_CONFIG: FarmConfig = {
  eggPrice: 5.50,
  henSalePrice: 100,
  chickPrice: 86.10,
  fixedCosts: 85000,
  feedPrices: DEFAULT_FEED_PRICES,
  vaccinesCost: 52.68,
  equipmentCost: 23.60,
  otherCosts: 0,
}

const BATCH_NAMES = ['Galpon 1', 'Galpon 2', 'Galpon 3', 'Galpon 4']

const PHASE_COLORS: Record<string, string> = {
  pre_inicio: 'bg-gray-100 text-gray-700',
  inicio: 'bg-blue-100 text-blue-700',
  crecimiento: 'bg-cyan-100 text-cyan-700',
  pre_postura: 'bg-amber-100 text-amber-700',
  postura: 'bg-green-100 text-green-700',
}

const PHASE_LABELS: Record<string, string> = {
  pre_inicio: 'Pre-Inicio (S0-4)',
  inicio: 'Inicio (S4-8)',
  crecimiento: 'Crecimiento (S8-14)',
  pre_postura: 'Pre-Postura (S14-18)',
  postura: 'Postura (S18+)',
}

const PHASE_FEED_CONSUMPTION: Record<string, number> = {
  pre_inicio: 12,
  inicio: 28,
  crecimiento: 58,
  pre_postura: 85,
  postura: 115,
}

// ============ HELPERS ============
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

function getPhaseFromMonth(month: number): BatchConfig['phase'] {
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
    hens: 2000,
    layingRate: 80,
    isLaying: false,
    isPreLay: false,
    cycleMonth: 0,
    phase: 'pre_inicio',
  }))
}

// ============ MAIN COMPONENT ============
export default function Home() {
  const [config, setConfig] = useState<FarmConfig>(DEFAULT_CONFIG)
  const [batches, setBatches] = useState<BatchConfig[]>(createDefaultBatches())
  const [savedRecords, setSavedRecords] = useState<MonthlyRecord[]>([])
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState('calculator')

  // ---- Calculations ----
  const calculations = useMemo(() => {
    let totalEggRevenue = 0
    let totalHenSaleRevenue = 0
    let totalFeedCost = 0
    let totalBatchCosts = 0
    const batchDetails: {
      name: string
      phase: string
      hens: number
      eggsPerMonth: number
      eggRevenue: number
      feedCost: number
      isLaying: boolean
    }[] = []

    batches.forEach((batch) => {
      const phase = batch.phase
      const consumption = PHASE_FEED_CONSUMPTION[phase]
      const feedPrice = config.feedPrices[phase]
      const monthlyFeedCost = (batch.hens * consumption * 30 * feedPrice) / 100

      let eggsPerMonth = 0
      let eggRevenue = 0

      if (phase === 'postura' && batch.isLaying) {
        eggsPerMonth = Math.round(batch.hens * (batch.layingRate / 100) * 30)
        eggRevenue = eggsPerMonth * config.eggPrice
        totalEggRevenue += eggRevenue
      }

      totalFeedCost += monthlyFeedCost

      batchDetails.push({
        name: batch.name,
        phase,
        hens: batch.hens,
        eggsPerMonth,
        eggRevenue,
        feedCost: monthlyFeedCost,
        isLaying: phase === 'postura' && batch.isLaying,
      })
    })

    const totalRevenue = totalEggRevenue + totalHenSaleRevenue
    const totalExpenses = totalFeedCost + config.fixedCosts + config.otherCosts
    const netProfit = totalRevenue - totalExpenses
    const layingBatches = batches.filter(b => b.isLaying).length
    const totalHens = batches.reduce((sum, b) => sum + b.hens, 0)
    const totalEggs = batchDetails.reduce((sum, b) => sum + b.eggsPerMonth, 0)

    return {
      totalEggRevenue,
      totalHenSaleRevenue,
      totalRevenue,
      totalFeedCost,
      totalExpenses,
      netProfit,
      layingBatches,
      totalHens,
      totalEggs,
      batchDetails,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      feedPercentage: totalExpenses > 0 ? (totalFeedCost / totalExpenses) * 100 : 0,
    }
  }, [batches, config])

  // ---- Handlers ----
  const updateConfig = useCallback((key: keyof FarmConfig, value: number | string) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const updateFeedPrice = useCallback((key: keyof FeedPrices, value: number) => {
    setConfig(prev => ({
      ...prev,
      feedPrices: { ...prev.feedPrices, [key]: value },
    }))
  }, [])

  const updateBatch = useCallback((id: string, field: keyof BatchConfig, value: boolean | number | string) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== id) return b
      const updated = { ...b, [field]: value }
      if (field === 'cycleMonth') {
        const m = value as number
        updated.phase = getPhaseFromMonth(m)
        updated.isLaying = m >= 5
        updated.isPreLay = m < 5
      }
      return updated
    }))
  }, [])

  const addBatch = useCallback(() => {
    const num = batches.length + 1
    setBatches(prev => [...prev, {
      id: `batch-${prev.length}`,
      name: `Galpon ${num}`,
      hens: 2000,
      layingRate: 80,
      isLaying: false,
      isPreLay: true,
      cycleMonth: 0,
      phase: 'pre_inicio',
    }])
  }, [batches.length])

  const removeBatch = useCallback((id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id))
  }, [])

  const resetAll = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setBatches(createDefaultBatches())
    setNotes('')
  }, [])

  const saveRecord = useCallback(() => {
    const now = new Date()
    const record: MonthlyRecord = {
      month: now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' }),
      date: now.toLocaleDateString('es-DO'),
      batches: [...batches],
      config: { ...config },
      notes,
    }
    setSavedRecords(prev => [record, ...prev])
  }, [batches, config, notes])

  // ---- Render ----
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Egg className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-stone-900">Granja Gallinas WD80</h1>
                <p className="text-xs text-stone-500">Calculadora de Gastos e Ingresos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {calculations.layingBatches} lotes en postura
              </Badge>
              <Badge variant="outline" className="text-xs">
                {fmtNum(calculations.totalHens)} aves
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-stone-500">Ingresos</span>
              </div>
              <p className="text-xl font-bold text-green-700">{fmtRD(calculations.totalRevenue)}</p>
              <p className="text-xs text-stone-400">{fmtNum(calculations.totalEggs)} huevos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-stone-500">Gastos</span>
              </div>
              <p className="text-xl font-bold text-red-700">{fmtRD(calculations.totalExpenses)}</p>
              <p className="text-xs text-stone-400">Alimento: {fmtRD(calculations.totalFeedCost)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-medium text-stone-500">Beneficio Neto</span>
              </div>
              <p className={`text-xl font-bold ${calculations.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {fmtRD(calculations.netProfit)}
              </p>
              <p className="text-xs text-stone-400">Margen: {calculations.profitMargin.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-medium text-stone-500">Alimento / Gasto</span>
              </div>
              <p className="text-xl font-bold text-violet-700">{calculations.feedPercentage.toFixed(1)}%</p>
              <p className="text-xs text-stone-400">{fmtRD(calculations.totalFeedCost)} del total</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="calculator" className="text-xs sm:text-sm">
              <Calculator className="w-4 h-4 mr-1 hidden sm:inline" />
              Calculadora
            </TabsTrigger>
            <TabsTrigger value="batches" className="text-xs sm:text-sm">
              <ClipboardList className="w-4 h-4 mr-1 hidden sm:inline" />
              Lotes
            </TabsTrigger>
            <TabsTrigger value="details" className="text-xs sm:text-sm">
              <PieChart className="w-4 h-4 mr-1 hidden sm:inline" />
              Detalle
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">
              <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* ============ TAB: CALCULADORA ============ */}
          <TabsContent value="calculator">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Precios e Ingresos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    Precios de Venta
                  </CardTitle>
                  <CardDescription>Configura los precios actuales del mercado</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="eggPrice">Precio huevo (RD$/unidad)</Label>
                      <Input
                        id="eggPrice"
                        type="number"
                        step="0.10"
                        value={config.eggPrice}
                        onChange={e => updateConfig('eggPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="henSale">Venta gallina desecho (RD$)</Label>
                      <Input
                        id="henSale"
                        type="number"
                        value={config.henSalePrice}
                        onChange={e => updateConfig('henSalePrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chickPrice">Precio pollita (RD$/unidad)</Label>
                      <Input
                        id="chickPrice"
                        type="number"
                        step="0.10"
                        value={config.chickPrice}
                        onChange={e => updateConfig('chickPrice', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otherCosts">Otros gastos adicionales</Label>
                      <Input
                        id="otherCosts"
                        type="number"
                        value={config.otherCosts}
                        onChange={e => updateConfig('otherCosts', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gastos Fijos */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="w-4 h-4 text-stone-600" />
                    Gastos Fijos Mensuales
                  </CardTitle>
                  <CardDescription>Salarios, electricidad, agua, mantenimiento</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fixedCosts">Gastos fijos mensuales (RD$)</Label>
                    <Input
                      id="fixedCosts"
                      type="number"
                      value={config.fixedCosts}
                      onChange={e => updateConfig('fixedCosts', parseFloat(e.target.value) || 0)}
                    />
                    <div className="flex gap-2 mt-2">
                      {[55000, 70000, 85000, 100000].map(v => (
                        <Button key={v} variant="outline" size="sm" className="text-xs"
                          onClick={() => updateConfig('fixedCosts', v)}>
                          {fmtRD(v)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="vaccines">Costo vacunas/ave (RD$)</Label>
                      <Input
                        id="vaccines"
                        type="number"
                        step="0.01"
                        value={config.vaccinesCost}
                        onChange={e => updateConfig('vaccinesCost', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="equip">Costo equipo/ave (RD$)</Label>
                      <Input
                        id="equip"
                        type="number"
                        step="0.01"
                        value={config.equipmentCost}
                        onChange={e => updateConfig('equipmentCost', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Precios de Alimento */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wheat className="w-4 h-4 text-amber-600" />
                    Precios de Alimento (RD$/quintal)
                  </CardTitle>
                  <CardDescription>Marca: Nutriovo Sanut (+5% ajuste). El alimento es ~75% del costo variable.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    {(Object.entries(config.feedPrices) as [keyof FeedPrices, number][]).map(([key, value]) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs capitalize">
                          {key === 'preInicio' ? 'Pre-Inicio' :
                           key === 'inicio' ? 'Inicio' :
                           key === 'crecimiento' ? 'Crecimiento' :
                           key === 'prePostura' ? 'Pre-Postura' : 'Postura'}
                        </Label>
                        <Input
                          type="number"
                          step="50"
                          value={value}
                          onChange={e => updateFeedPrice(key, parseFloat(e.target.value) || 0)}
                          className="text-sm"
                        />
                        <p className="text-[10px] text-stone-400">
                          {PHASE_FEED_CONSUMPTION[key]}g/ave/dia
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" className="text-xs"
                      onClick={() => setConfig(prev => ({ ...prev, feedPrices: DEFAULT_FEED_PRICES }))}>
                      Restaurar precios base
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs"
                      onClick={() => {
                        const p = 1500
                        setConfig(prev => ({
                          ...prev,
                          feedPrices: {
                            preInicio: Math.round(p * 1.87),
                            inicio: Math.round(p * 1.73),
                            crecimiento: Math.round(p * 1.60),
                            prePostura: Math.round(p * 1.47),
                            postura: p,
                          }
                        }))
                      }}>
                      Precios proporcionales al postura
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Save / Reset */}
              <div className="lg:col-span-2 flex flex-wrap gap-3">
                <Button onClick={saveRecord} className="gap-2">
                  <Save className="w-4 h-4" /> Guardar registro del mes
                </Button>
                <Button variant="outline" onClick={resetAll} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Restaurar valores por defecto
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
                    <CardTitle className="text-base flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-violet-600" />
                      Configuracion de Lotes
                    </CardTitle>
                    <CardDescription>Define el estado actual de cada lote/galpon</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={addBatch} className="gap-1">
                    <Plus className="w-4 h-4" /> Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {batches.map((batch, idx) => (
                    <div key={batch.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm">{batch.name}</span>
                          <Badge className={PHASE_COLORS[batch.phase]}>
                            {PHASE_LABELS[batch.phase]}
                          </Badge>
                          {batch.isLaying && (
                            <Badge className="bg-green-100 text-green-700">
                              En postura
                            </Badge>
                          )}
                        </div>
                        {batches.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeBatch(batch.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Minus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Aves</Label>
                          <Input
                            type="number"
                            value={batch.hens}
                            onChange={e => updateBatch(batch.id, 'hens', parseInt(e.target.value) || 0)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Mes del ciclo</Label>
                          <Input
                            type="number"
                            min={0}
                            max={25}
                            step={0.5}
                            value={batch.cycleMonth}
                            onChange={e => updateBatch(batch.id, 'cycleMonth', parseFloat(e.target.value) || 0)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">% Postura</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={batch.layingRate}
                            onChange={e => updateBatch(batch.id, 'layingRate', parseFloat(e.target.value) || 0)}
                            className="text-sm"
                            disabled={!batch.isLaying}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fase actual</Label>
                          <div className="h-9 rounded-md border bg-stone-50 px-3 flex items-center text-sm text-stone-600">
                            {PHASE_LABELS[batch.phase]}
                          </div>
                        </div>
                      </div>
                      {/* Quick phase buttons */}
                      <div className="flex flex-wrap gap-1">
                        {(['pre_inicio', 'inicio', 'crecimiento', 'pre_postura', 'postura'] as const).map(phase => (
                          <Button key={phase} variant={batch.phase === phase ? 'default' : 'outline'} size="sm"
                            className="text-[10px] h-7"
                            onClick={() => updateBatch(batch.id, 'phase', phase)}>
                            {PHASE_LABELS[phase]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============ TAB: DETALLE ============ */}
          <TabsContent value="details">
            <div className="space-y-6">
              {/* Batch Detail Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-stone-600" />
                    Detalle por Lote
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lote</TableHead>
                        <TableHead>Fase</TableHead>
                        <TableHead className="text-right">Aves</TableHead>
                        <TableHead className="text-right">Huevos/Mes</TableHead>
                        <TableHead className="text-right">Ingreso Huevos</TableHead>
                        <TableHead className="text-right">Alimento</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calculations.batchDetails.map((b) => (
                        <TableRow key={b.name}>
                          <TableCell className="font-medium">{b.name}</TableCell>
                          <TableCell>
                            <Badge className={`${PHASE_COLORS[b.phase]} text-[10px]`}>
                              {PHASE_LABELS[b.phase]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmtNum(b.hens)}</TableCell>
                          <TableCell className="text-right">
                            {b.isLaying ? fmtNum(b.eggsPerMonth) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-green-700 font-medium">
                            {b.isLaying ? fmtRD(b.eggRevenue) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {fmtRD(b.feedCost)}
                          </TableCell>
                          <TableCell className={`text-right font-bold ${b.isLaying ? (b.eggRevenue - b.feedCost >= 0 ? 'text-green-700' : 'text-red-600') : 'text-red-600'}`}>
                            {fmtRD(b.isLaying ? b.eggRevenue - b.feedCost : -b.feedCost)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Desglose de Gastos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { label: 'Alimento', value: calculations.totalFeedCost, color: 'bg-amber-500' },
                        { label: 'Gastos Fijos', value: config.fixedCosts, color: 'bg-stone-500' },
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
                              <div className={`h-full ${item.color} rounded-full transition-all`}
                                style={{ width: `${pct}%` }} />
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
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumen del Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Venta de Huevos</span>
                        <span className="text-green-700 font-medium">
                          {fmtRD(calculations.totalEggRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Venta de Gallinas</span>
                        <span className="text-green-700 font-medium">
                          {fmtRD(calculations.totalHenSaleRevenue)}
                        </span>
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
                        <span className="text-red-600">{fmtRD(config.fixedCosts)}</span>
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
                      <div className={`flex justify-between text-lg font-bold p-3 rounded-lg ${calculations.netProfit >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                        <span>BENEFICIO NETO</span>
                        <span>{fmtRD(calculations.netProfit)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Margen de Ganancia</span>
                        <span className="font-medium">{calculations.profitMargin.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Total Huevos/Mes</span>
                        <span className="font-medium">{fmtNum(calculations.totalEggs)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Reference */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Referencia rapida:</strong> Con los precios actuales ({fmtRD(config.eggPrice)}/huevo, alimento {fmtRD(config.feedPrices.postura)}/qq),
                  cada lote de {fmtNum(2000)} aves en postura al 80% genera <strong>{fmtRD(2000 * 0.80 * 30 * config.eggPrice)}</strong> en huevos
                  y consume <strong>{fmtRD(2000 * 115 * 30 * config.feedPrices.postura / 100)}</strong> en alimento.
                  El punto de equilibrio por lote es de {fmtNum(Math.ceil((config.feedPrices.postura * 115 * 30) / (config.eggPrice * 30)))} huevos/dia al 100% de postura.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>

          {/* ============ TAB: HISTORIAL ============ */}
          <TabsContent value="history">
            <div className="space-y-6">
              {/* Notes input */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notas del Mes</CardTitle>
                  <CardDescription>Agrega observaciones o comentarios sobre el mes actual</CardDescription>
                </CardHeader>
                <CardContent>
                  <textarea
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Ej: Lote 2 con mortalidad elevada, cambio de proveedor de alimento..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </CardContent>
              </Card>

              {/* Saved Records */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-600" />
                    Registros Guardados
                  </CardTitle>
                  <CardDescription>Historial de registros mensuales ({savedRecords.length} guardados)</CardDescription>
                </CardHeader>
                <CardContent>
                  {savedRecords.length === 0 ? (
                    <div className="text-center py-8 text-stone-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No hay registros guardados aun.</p>
                      <p className="text-xs mt-1">Configura los valores y haz clic en &quot;Guardar registro del mes&quot;</p>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                      {savedRecords.map((record, idx) => {
                        const laying = record.batches.filter(b => b.isLaying)
                        const eggRev = laying.reduce((sum, b) => sum + (b.hens * (b.layingRate / 100) * 30 * record.config.eggPrice), 0)
                        const feedCost = record.batches.reduce((sum, b) => {
                          const cons = PHASE_FEED_CONSUMPTION[b.phase]
                          const price = record.config.feedPrices[b.phase]
                          return sum + (b.hens * cons * 30 * price) / 100
                        }, 0)
                        const totalExp = feedCost + record.config.fixedCosts + record.config.otherCosts
                        const net = eggRev - totalExp
                        return (
                          <div key={idx} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">{record.month}</span>
                                <span className="text-xs text-stone-400">{record.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {laying.length}/{record.batches.length} lotes
                                </Badge>
                                <Badge className={net >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {fmtRD(net)}
                                </Badge>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-stone-400">Ingresos:</span>{' '}
                                <span className="text-green-700 font-medium">{fmtRD(eggRev)}</span>
                              </div>
                              <div>
                                <span className="text-stone-400">Gastos:</span>{' '}
                                <span className="text-red-600 font-medium">{fmtRD(totalExp)}</span>
                              </div>
                              <div>
                                <span className="text-stone-400">Huevo:</span>{' '}
                                <span className="font-medium">{fmtRD(record.config.eggPrice)}</span>
                              </div>
                            </div>
                            {record.notes && (
                              <p className="text-xs text-stone-500 bg-stone-50 rounded p-2">
                                {record.notes}
                              </p>
                            )}
                          </div>
                        )
                      })}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-stone-400">
              Granja Gallinas WD80 - Estrategia C | Calculadora de Gastos e Ingresos
            </p>
            <p className="text-xs text-stone-400">
              Datos actualizados en tiempo real
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
