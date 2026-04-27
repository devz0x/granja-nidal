'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  DollarSign, Wheat, Heart, Building2, LayoutGrid, Hammer,
  ChevronDown, ChevronUp, RotateCcw, Plus, Trash2,
  TrendingUp, TrendingDown, Save, Info, Zap,
  Download, Upload, FileJson, FileSpreadsheet, Database, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import {
  exportAllDataAsJSON, importAllDataFromJSON, exportDailyEntriesAsCSV,
  importDailyEntriesFromCSV, downloadJSON, downloadCSV, getDataSummary, getDataSummaryAsync,
} from '@/lib/data-io'
import type { ImportResult } from '@/lib/data-io'
import type {
  PhaseKey, FarmConfig, BatchConfig, StructuralExpense, StructuralFrequency,
  CalculationsResult
} from '@/lib/farm-data'
import {
  DEFAULT_CONFIG, DEFAULT_FEED, DEFAULT_STRUCTURAL_EXPENSES,
  FREQUENCY_LABELS, FREQUENCY_MULTIPLIER, PHASE_COLORS, PHASE_KEYS,
  fmtRD, fmtNum, fmtPct,
} from '@/lib/farm-data'

// ================================================================
// NUMBER INPUT SUB-COMPONENT
// ================================================================
function NumberInput({
  label, value, onChange, step = 1, min, max, prefix, suffix, className = '',
  tooltip, disabled = false, highlightOnDefault, defaultValue,
}: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; max?: number; prefix?: string; suffix?: string
  className?: string; tooltip?: string; disabled?: boolean
  highlightOnDefault?: boolean; defaultValue?: number
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
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{prefix}</span>}
          <Input
            type="number" step={step} min={min} max={max} value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)} disabled={disabled}
            className={`text-sm h-9 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''} ${
              highlightOnDefault && isChanged ? 'border-amber-400 bg-amber-50/50' : ''
            }`}
          />
          {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
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
// CONFIG SHEET PROPS
// ================================================================
interface ConfigSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: FarmConfig
  setConfig: React.Dispatch<React.SetStateAction<FarmConfig>>
  batches: BatchConfig[]
  structuralExpenses: StructuralExpense[]
  setStructuralExpenses: React.Dispatch<React.SetStateAction<StructuralExpense[]>>
  liveCalcs: CalculationsResult
  notes: string
  setNotes: (n: string) => void
  saveRecord: () => void
  resetAll: () => void
}

// ================================================================
// CONFIG SHEET COMPONENT
// ================================================================
export default function ConfigSheet({
  open, onOpenChange, config, setConfig, batches,
  structuralExpenses, setStructuralExpenses, liveCalcs,
  notes, setNotes, saveRecord, resetAll,
}: ConfigSheetProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    ventas: true,
    alimento: true,
    ave: true,
    infraestructura: false,
    operacion: true,
    estructural: true,
  })

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const updateConfig = <K extends keyof FarmConfig>(key: K, value: FarmConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const updateFeedPhase = (phaseKey: PhaseKey, field: 'consumption' | 'price', value: number) => {
    setConfig(prev => ({
      ...prev,
      feedPhases: {
        ...prev.feedPhases,
        [phaseKey]: { ...prev.feedPhases[phaseKey], [field]: value },
      },
    }))
  }

  const resetSection = (section: string) => {
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
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center">
              <Settings2Icon className="w-4 h-4 text-stone-600" />
            </div>
            Configuracion General
          </SheetTitle>
        </SheetHeader>

        <div className="px-6 pb-8 space-y-4">
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
                  <NumberInput label="Precio por Huevo" value={config.eggPrice} onChange={v => updateConfig('eggPrice', v)} step={0.10} prefix="RD$" defaultValue={DEFAULT_CONFIG.eggPrice} highlightOnDefault tooltip="Precio de venta al publico por cada huevo." />
                  <NumberInput label="Venta Gallina de Desecho" value={config.henSalePrice} onChange={v => updateConfig('henSalePrice', v)} prefix="RD$" defaultValue={DEFAULT_CONFIG.henSalePrice} highlightOnDefault />
                  <NumberInput label="Precio Pollita/ Ave Nueva" value={config.chickPrice} onChange={v => updateConfig('chickPrice', v)} step={0.10} prefix="RD$" defaultValue={DEFAULT_CONFIG.chickPrice} highlightOnDefault />
                </div>
                <div className="mt-3 p-2.5 bg-green-50 rounded-lg">
                  <p className="text-[11px] text-green-800">
                    Con {fmtNum(config.hensPerBatch)} aves al {config.baseLayingRate}%: Ingreso por lote en postura = <strong>{fmtRD(config.hensPerBatch * (config.baseLayingRate / 100) * 30 * config.eggPrice)}/mes</strong>
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
                    <CardDescription className="text-[11px]">Precios (RD$/qq) y consumo (g/ave/dia) por cada fase.</CardDescription>
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
                        <TableHead className="text-xs text-right">Precio Base</TableHead>
                        <TableHead className="text-xs text-right">Costo mes/lote</TableHead>
                        <TableHead className="text-xs text-center">Cambio vs Base</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PHASE_KEYS.map(key => {
                        const feed = config.feedPhases[key]
                        const defFeed = DEFAULT_FEED[key]
                        const monthlyCost = (config.hensPerBatch * feed.consumption * 30 * feed.price) / 100000
                        const defMonthlyCost = (DEFAULT_CONFIG.hensPerBatch * defFeed.consumption * 30 * defFeed.price) / 100000
                        const isPriceChanged = feed.price !== defFeed.price
                        return (
                          <TableRow key={key} className={isPriceChanged ? 'bg-amber-50/50' : ''}>
                            <TableCell>
                              <Badge className={`${PHASE_COLORS[key]} text-[10px]`}>{feed.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs text-stone-500">{feed.weeks}</TableCell>
                            <TableCell className="text-right">
                              <Input type="number" step={1} min={0} max={200} value={feed.consumption}
                                onChange={e => updateFeedPhase(key, 'consumption', parseFloat(e.target.value) || 0)}
                                className="w-20 h-7 text-xs text-right mx-auto" />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input type="number" step={50} min={0} value={feed.price}
                                onChange={e => updateFeedPhase(key, 'price', parseFloat(e.target.value) || 0)}
                                className={`w-24 h-7 text-xs text-right mx-auto ${isPriceChanged ? 'border-amber-400 bg-amber-50' : ''}`} />
                            </TableCell>
                            <TableCell className="text-right text-xs text-stone-400">{fmtNum(defFeed.price)}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{fmtRD(monthlyCost)}</TableCell>
                            <TableCell className="text-center"><ChangeIndicator current={monthlyCost} original={defMonthlyCost} /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-3 p-3 bg-amber-50 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-amber-900">IMPACTO DE PRECIOS DE ALIMENTO</p>
                    {liveCalcs.feedPriceImpact !== 0 && (
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${liveCalcs.feedPriceImpact > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {liveCalcs.feedPriceImpact > 0 ? '+' : ''}{fmtRD(liveCalcs.feedPriceImpact)} vs base
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    {liveCalcs.feedCostByPhase.map(fp => (
                      <div key={fp.phaseKey} className={`flex items-center justify-between px-2 py-1.5 rounded ${fp.batchesCount > 0 ? 'bg-white border border-amber-200' : 'bg-amber-100/50 opacity-70'}`}>
                        <span className="text-amber-800">{fp.label} ({fp.batchesCount})</span>
                        <span className="font-mono font-medium">{fmtRD(fp.monthlyCost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Section 3: COSTOS POR AVE */}
          <Card>
            <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('ave')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><Heart className="w-4 h-4 text-violet-700" /></div>
                  <div><CardTitle className="text-sm">Costos por Ave</CardTitle><CardDescription className="text-[11px]">Inversion inicial por lote</CardDescription></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400" onClick={e => { e.stopPropagation(); resetSection('ave') }}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  {openSections.ave ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </div>
            </CardHeader>
            {openSections.ave && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <NumberInput label="Costo Vacunas / Ave" value={config.vaccinesCostPerBird} onChange={v => updateConfig('vaccinesCostPerBird', v)} step={0.01} prefix="RD$" defaultValue={DEFAULT_CONFIG.vaccinesCostPerBird} highlightOnDefault />
                  <NumberInput label="Costo Equipo / Ave" value={config.equipmentCostPerBird} onChange={v => updateConfig('equipmentCostPerBird', v)} step={0.01} prefix="RD$" defaultValue={DEFAULT_CONFIG.equipmentCostPerBird} highlightOnDefault />
                  <NumberInput label="Mortalidad Esperada" value={config.mortalityRate} onChange={v => updateConfig('mortalityRate', Math.min(20, Math.max(0, v)))} step={0.5} min={0} max={20} suffix="%" defaultValue={DEFAULT_CONFIG.mortalityRate} highlightOnDefault />
                </div>
                <div className="mt-3 p-2.5 bg-violet-50 rounded-lg">
                  <p className="text-[11px] text-violet-800">
                    Inversion/ave: <strong>{fmtRD(config.chickPrice + config.vaccinesCostPerBird + config.equipmentCostPerBird)}</strong>
                    {' | '}Con {config.mortalityRate}% mortalidad: <strong>{fmtRD(liveCalcs.newBatchInvestmentWithMortality)}/lote</strong>
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
                  <div className="w-8 h-8 rounded-lg bg-stone-200 flex items-center justify-center"><Building2 className="w-4 h-4 text-stone-700" /></div>
                  <div><CardTitle className="text-sm">Infraestructura</CardTitle><CardDescription className="text-[11px]">Costos de galpones</CardDescription></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400" onClick={e => { e.stopPropagation(); resetSection('infraestructura') }}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  {openSections.infraestructura ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </div>
            </CardHeader>
            {openSections.infraestructura && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <NumberInput label="Galpon 1 (Completo con Equipo)" value={config.shed1Cost} onChange={v => updateConfig('shed1Cost', v)} step={5000} prefix="RD$" defaultValue={DEFAULT_CONFIG.shed1Cost} highlightOnDefault />
                  <NumberInput label="Galpones Adicionales (c/u)" value={config.shedAdditionalCost} onChange={v => updateConfig('shedAdditionalCost', v)} step={5000} prefix="RD$" defaultValue={DEFAULT_CONFIG.shedAdditionalCost} highlightOnDefault />
                </div>
                <div className="mt-3 p-2.5 bg-stone-100 rounded-lg">
                  <p className="text-[11px] text-stone-700">Infraestructura total ({batches.length} galpones): <strong>{fmtRD(liveCalcs.infraCost)}</strong></p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Section 5: OPERACION */}
          <Card>
            <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('operacion')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center"><LayoutGrid className="w-4 h-4 text-sky-700" /></div>
                  <div><CardTitle className="text-sm">Parametros de Operacion</CardTitle><CardDescription className="text-[11px]">Variables operativas</CardDescription></div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-[10px] h-7 text-stone-400" onClick={e => { e.stopPropagation(); resetSection('operacion') }}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Reset
                  </Button>
                  {openSections.operacion ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </div>
            </CardHeader>
            {openSections.operacion && (
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <NumberInput label="% Postura Base (WD80)" value={config.baseLayingRate} onChange={v => updateConfig('baseLayingRate', Math.min(98, Math.max(50, v)))} step={1} min={50} max={98} suffix="%" defaultValue={DEFAULT_CONFIG.baseLayingRate} highlightOnDefault />
                  <NumberInput label="Duracion Ciclo Postura" value={config.layingCycleMonths} onChange={v => updateConfig('layingCycleMonths', Math.min(30, Math.max(12, v)))} step={1} min={12} max={30} suffix="meses" defaultValue={DEFAULT_CONFIG.layingCycleMonths} highlightOnDefault />
                  <NumberInput label="Aves por Lote (Default)" value={config.hensPerBatch} onChange={v => updateConfig('hensPerBatch', Math.max(100, v))} step={100} min={100} suffix="aves" defaultValue={DEFAULT_CONFIG.hensPerBatch} highlightOnDefault />
                  <NumberInput label="Gastos Fijos Mensuales" value={config.fixedCostsMonthly} onChange={v => updateConfig('fixedCostsMonthly', v)} step={1000} prefix="RD$" defaultValue={DEFAULT_CONFIG.fixedCostsMonthly} highlightOnDefault />
                  <NumberInput label="Otros Gastos Adicionales" value={config.otherCosts} onChange={v => updateConfig('otherCosts', v)} step={1000} prefix="RD$" defaultValue={DEFAULT_CONFIG.otherCosts} highlightOnDefault />
                </div>
                <div className="mt-3 p-2.5 bg-sky-50 rounded-lg">
                  <p className="text-[11px] text-sky-800">
                    Costo por ave/mes: <strong>{fmtRD(liveCalcs.costPerBirdMonthly)}</strong>
                    {' | '}Punto equilibrio: <strong>{fmtNum(liveCalcs.breakEvenEggsPerDay)} huevos/dia</strong>
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Section 6: GASTOS ESTRUCTURALES */}
          <Card>
            <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => toggleSection('estructural')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><Hammer className="w-4 h-4 text-orange-700" /></div>
                  <div>
                    <CardTitle className="text-sm">Gastos Estructurales</CardTitle>
                    <CardDescription className="text-[11px]">Reparaciones, mejoras, bioseguridad</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{fmtRD(liveCalcs.structuralMonthlyTotal)}/mes</Badge>
                  {openSections.estructural ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                </div>
              </div>
            </CardHeader>
            {openSections.estructural && (
              <CardContent>
                <div className="space-y-3">
                  {structuralExpenses.length === 0 ? (
                    <div className="text-center py-6 text-stone-400">
                      <Hammer className="w-8 h-8 mx-auto mb-1 opacity-30" />
                      <p className="text-xs">No hay gastos estructurales.</p>
                    </div>
                  ) : (
                    structuralExpenses.map((expense) => (
                      <div key={expense.id} className={`flex items-center gap-3 p-3 rounded-lg border ${expense.isActive ? 'border-stone-200 bg-white' : 'border-stone-100 bg-stone-50 opacity-60'}`}>
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                          <div className="col-span-1 sm:col-span-2">
                            <Input type="text" value={expense.description}
                              onChange={e => setStructuralExpenses(prev => prev.map(ex => ex.id === expense.id ? { ...ex, description: e.target.value } : ex))}
                              className="text-xs h-7" placeholder="Descripcion del gasto..." />
                          </div>
                          <div className="flex gap-2">
                            <Input type="number" value={expense.amount}
                              onChange={e => setStructuralExpenses(prev => prev.map(ex => ex.id === expense.id ? { ...ex, amount: parseFloat(e.target.value) || 0 } : ex))}
                              className="text-xs h-7 w-28" />
                            <select value={expense.frequency}
                              onChange={e => setStructuralExpenses(prev => prev.map(ex => ex.id === expense.id ? { ...ex, frequency: e.target.value as StructuralFrequency } : ex))}
                              className="text-xs h-7 rounded-md border border-input bg-background px-2 min-w-[100px]">
                              {(Object.entries(FREQUENCY_LABELS) as [StructuralFrequency, string][]).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-stone-400">~{fmtRD(expense.amount * FREQUENCY_MULTIPLIER[expense.frequency] / 12)}/mes</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setStructuralExpenses(prev => prev.map(ex => ex.id === expense.id ? { ...ex, isActive: !ex.isActive } : ex))}
                              className={`text-[10px] px-1.5 py-0.5 rounded ${expense.isActive ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
                              {expense.isActive ? 'Activo' : 'Inactivo'}
                            </button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-300 hover:text-red-500"
                              onClick={() => setStructuralExpenses(prev => prev.filter(ex => ex.id !== expense.id))}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs"
                    onClick={() => setStructuralExpenses(prev => [...prev, {
                      id: `se-${Date.now()}`, description: '', amount: 0,
                      frequency: 'unico' as StructuralFrequency, dateAdded: new Date().toISOString(), isActive: true,
                    }])}>
                    <Plus className="w-3.5 h-3.5" /> Agregar gasto estructural
                  </Button>
                </div>
                <div className="mt-3 p-2.5 bg-orange-50 rounded-lg">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-orange-600 block">Items activos</span><span className="font-bold">{liveCalcs.activeStructural} de {liveCalcs.totalStructuralItems}</span></div>
                    <div><span className="text-orange-600 block">Prorrateado/mes</span><span className="font-bold">{fmtRD(liveCalcs.structuralMonthlyTotal)}</span></div>
                    <div><span className="text-orange-600 block">Anual estimado</span><span className="font-bold">{fmtRD(liveCalcs.structuralAnnualTotal)}</span></div>
                    <div><span className="text-orange-600 block">% del gasto</span><span className="font-bold">{liveCalcs.totalExpenses > 0 ? (liveCalcs.structuralMonthlyTotal / liveCalcs.totalExpenses * 100).toFixed(1) : '0'}%</span></div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notas del Mes</CardTitle>
              <CardDescription className="text-[11px]">Observaciones del mes actual</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="w-full min-h-[80px]"
                placeholder="Observaciones del mes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* ================================================================ */}
          {/* --- RESPALDO DE DATOS (Export/Import) --- */}
          {/* ================================================================ */}
          <DataBackupSection />

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
      </SheetContent>
    </Sheet>
  )
}

// ================================================================
// DATA BACKUP SECTION (Export / Import)
// ================================================================
function DataBackupSection() {
  const [importStatus, setImportStatus] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [summary, setSummary] = useState<ReturnType<typeof getDataSummary> | null>(null)
  const fileInputRef = { current: null as HTMLInputElement | null }
  const csvInputRef = { current: null as HTMLInputElement | null }

  // Fetch summary from Supabase on mount
  useEffect(() => {
    getDataSummaryAsync().then(data => {
      if (data) setSummary(data)
    })
  }, [])

  const handleExportJSON = async () => {
    setIsExporting(true)
    try {
      const json = await exportAllDataAsJSON()
      downloadJSON(json)
      setImportStatus({ success: true, message: 'Respaldo JSON descargado exitosamente.' })
    } catch {
      setImportStatus({ success: false, message: 'Error al exportar datos.' })
    } finally {
      setIsExporting(false)
      setTimeout(() => setImportStatus(null), 4000)
    }
  }

  const handleExportCSV = async () => {
    setIsExporting(true)
    try {
      const csv = await exportDailyEntriesAsCSV()
      if (!csv) {
        setImportStatus({ success: false, message: 'No hay registros de produccion diaria para exportar.' })
        setTimeout(() => setImportStatus(null), 4000)
        return
      }
      downloadCSV(csv)
      setImportStatus({ success: true, message: `CSV descargado exitosamente.` })
    } catch {
      setImportStatus({ success: false, message: 'Error al exportar CSV.' })
    } finally {
      setIsExporting(false)
      setTimeout(() => setImportStatus(null), 4000)
    }
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const result = await importAllDataFromJSON(text)
      setImportStatus(result)
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (result.success) {
        setTimeout(() => window.location.reload(), 2000)
      } else {
        setTimeout(() => setImportStatus(null), 6000)
      }
    }
    reader.onerror = () => {
      setImportStatus({ success: false, message: 'Error al leer el archivo.' })
      setIsImporting(false)
    }
    reader.readAsText(file)
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = ev.target?.result as string
      const result = await importDailyEntriesFromCSV(text)
      setImportStatus(result)
      setIsImporting(false)
      if (csvInputRef.current) csvInputRef.current.value = ''
      setTimeout(() => {
        setImportStatus(null)
        if (result.success) window.location.reload()
 }, 4000)
    }
    reader.onerror = () => {
      setImportStatus({ success: false, message: 'Error al leer el archivo CSV.' })
      setIsImporting(false)
    }
    reader.readAsText(file)
  }

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-2 cursor-pointer select-none">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Database className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <CardTitle className="text-sm">Respaldo de Datos</CardTitle>
            <CardDescription className="text-[11px]">Exporta e importa todos tus datos de la granja.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && (
          <div className="p-2.5 bg-blue-50 rounded-lg">
            <p className="text-[10px] font-semibold text-blue-900 mb-1.5">Datos actuales almacenados:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
              <div><span className="text-blue-600 block">Lotes</span><span className="font-bold">{summary.batchCount}</span></div>
              <div><span className="text-blue-600 block">Registros mensuales</span><span className="font-bold">{summary.recordCount}</span></div>
              <div><span className="text-blue-600 block">Produccion diaria</span><span className="font-bold">{summary.dailyEntryCount}</span></div>
              <div><span className="text-blue-600 block">Alertas</span><span className="font-bold">{summary.reminderCount}</span></div>
              <div><span className="text-blue-600 block">Vacunas</span><span className="font-bold">{summary.vaccineCount}</span></div>
              <div><span className="text-blue-600 block">Inventario feed</span><span className="font-bold">{summary.feedInventoryCount}</span></div>
              <div><span className="text-blue-600 block">Gastos estruct.</span><span className="font-bold">{summary.structuralCount}</span></div>
            </div>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold text-stone-600 mb-2">EXPORTAR:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportJSON} className="gap-2 text-xs" disabled={isExporting}>
              <FileJson className="w-3.5 h-3.5 text-blue-600" /> {isExporting ? 'Exportando...' : 'Respaldo completo (JSON)'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2 text-xs" disabled={isExporting}>
              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600" /> {isExporting ? 'Exportando...' : 'Produccion diaria (CSV)'}
            </Button>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-[10px] font-semibold text-stone-600 mb-2">IMPORTAR:</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2 text-xs" disabled={isImporting}>
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              {isImporting ? 'Importando...' : 'Cargar respaldo (JSON)'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} className="gap-2 text-xs" disabled={isImporting}>
              <Upload className="w-3.5 h-3.5 text-amber-600" />
              {isImporting ? 'Importando...' : 'Cargar produccion (CSV)'}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          <p className="text-[9px] text-stone-400 mt-1.5">
            JSON: reemplaza todos los datos. CSV: agrega registros diarios sin duplicados.
          </p>
        </div>

        {importStatus && (
          <Alert className={importStatus.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}>
            {importStatus.success
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-red-600" />
            }
            <AlertDescription className={`text-xs ${importStatus.success ? 'text-green-800' : 'text-red-800'}`}>
              {importStatus.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function Settings2Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-1.56 0l-.5.3a2 2 0 0 0-1.76 3.05l-.34.1a2 2 0 0 1-1.89-1.27v-.07a2 2 0 0 0-2.65-2.11l-.3-.1a2 2 0 0 1-1.8.67l-.37.25a2 2 0 0 1-2.23-.05l-.6-.3a2 2 0 0 0-1.28.89l-.59.76a2 2 0 0 1-1.83-.57l-.63.29a2 2 0 0 1-1.12-.63l-.77-.46a2 2 0 0 1-.47-1.84l-.54-.07a2 2 0 0 0-.37 2.12 2 2 0 0 1 .65.98l-.43-.25a2 2 0 0 1 .85-.26l.59.76a2 2 0 0 0 1.12-.63l.63-.29a2 2 0 0 1 1.28-.89l.59-.76a2 2 0 0 0 .85.26l.43.25a2 2 0 0 1 1.12.63l.63.29a2 2 0 0 1 .28.89l.59.76a2 2 0 0 0 1.12.63l.63.29a2 2 0 0 1 .56.11l.59.76a2 2 0 0 0 .83-.65l.37-.25a2 2 0 0 1 1.28.89l.59-.76a2 2 0 0 0 .85-.26l.43.25a2 2 0 0 1 1.12.63l.63.29a2 2 0 0 1 .65.98"/>
    </svg>
  )
}
