'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ArrowLeft, Egg, Wheat, DollarSign, Info, Trash2,
  BarChart3, ClipboardCheck, Heart,
} from 'lucide-react'
import type {
  PhaseKey, FarmConfig, BatchConfig, CalculationsResult,
} from '@/lib/farm-data'
import {
  DEFAULT_CONFIG, DEFAULT_FEED, PHASE_COLORS, PHASE_KEYS,
  fmtRD, fmtNum, fmtPct,
} from '@/lib/farm-data'
import OperationsPanel from '@/components/operations-panel'
import RemindersPanel from '@/components/reminders-panel'

// ================================================================
// NUMBER INPUT
// ================================================================
function NumberInput({
  label, value, onChange, step = 1, min, max, prefix, suffix, className = '',
  tooltip, disabled = false,
}: {
  label: string; value: number; onChange: (v: number) => void
  step?: number; min?: number; max?: number; prefix?: string; suffix?: string
  className?: string; tooltip?: string; disabled?: boolean
}) {
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
              <TooltipContent side="top" className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="relative">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{prefix}</span>}
          <Input type="number" step={step} min={min} max={max} value={value}
            onChange={e => onChange(parseFloat(e.target.value) || 0)} disabled={disabled}
            className={`text-sm h-9 ${prefix ? 'pl-8' : ''} ${suffix ? 'pr-10' : ''}`} />
          {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">{suffix}</span>}
        </div>
      </div>
    </TooltipProvider>
  )
}

// ================================================================
// LOT DETAIL SUB-TAB TYPES
// ================================================================
type LotSubTab = 'general' | 'produccion' | 'feed' | 'salud' | 'finanzas' | 'alertas'

const SUB_TABS: { key: LotSubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'general', label: 'General', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
  { key: 'produccion', label: 'Produccion', icon: <Egg className="w-3.5 h-3.5" /> },
  { key: 'feed', label: 'Feed', icon: <Wheat className="w-3.5 h-3.5" /> },
  { key: 'salud', label: 'Salud', icon: <Heart className="w-3.5 h-3.5" /> },
  { key: 'finanzas', label: 'Finanzas', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: 'alertas', label: 'Alertas', icon: <BarChart3 className="w-3.5 h-3.5" /> },
]

// ================================================================
// LOT DETAIL PROPS
// ================================================================
interface LotDetailProps {
  batch: BatchConfig
  totalBatches: number
  calc: CalculationsResult
  config: FarmConfig
  onBack: () => void
  updateBatch: (id: string, field: keyof BatchConfig, value: boolean | number | string) => void
  removeBatch: (id: string) => void
}

// ================================================================
// LOT DETAIL COMPONENT
// ================================================================
export default function LotDetail({ batch, totalBatches, calc, config, onBack, updateBatch, removeBatch }: LotDetailProps) {
  const [activeSubTab, setActiveSubTab] = useState<LotSubTab>('general')
  const detail = calc.batchDetails.find(b => b.id === batch.id)
  const feed = config.feedPhases[batch.phase]

  const layingCycleMonths = config.layingCycleMonths
  const layingStart = 5
  const cycleProgress = batch.isLaying
    ? Math.min(100, ((batch.cycleMonth - layingStart) / (layingCycleMonths - layingStart)) * 100)
    : Math.min(100, (batch.cycleMonth / layingStart) * 100)

  return (
    <div className="space-y-4">
      {/* Back + Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs h-8">
          <ArrowLeft className="w-4 h-4" /> Volver
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <span className="text-sm text-stone-500">Granja Nidal</span>
        <span className="text-sm text-stone-400">/</span>
        <span className="text-sm font-semibold text-stone-700">{batch.name}</span>
      </div>

      {/* Lot Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Input
                  type="text" value={batch.name}
                  onChange={e => updateBatch(batch.id, 'name', e.target.value)}
                  className="h-8 w-48 text-base font-bold border-transparent hover:border-stone-300 focus:border-stone-400 bg-transparent px-0"
                />
                <Badge className={`${PHASE_COLORS[batch.phase]} text-[10px]`}>
                  {feed.label}
                </Badge>
                {batch.isLaying && (
                  <Badge className="bg-green-100 text-green-700 text-[10px]">En postura</Badge>
                )}
              </div>
              {/* Cycle Progress */}
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-stone-500">Ciclo: Mes {batch.cycleMonth}/{config.layingCycleMonths}</span>
                  <span className="text-[10px] text-stone-400">{cycleProgress.toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${batch.isLaying ? 'bg-green-500' : 'bg-stone-400'}`}
                    style={{ width: `${cycleProgress}%` }} />
                </div>
              </div>
            </div>
            {totalBatches > 1 && (
              <Button variant="ghost" size="sm" onClick={() => removeBatch(batch.id)}
                className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Quick KPI row */}
          {detail && (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-stone-400">Aves</p>
                <p className="text-sm font-bold">{fmtNum(detail.hens)}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-stone-400">% Postura</p>
                <p className="text-sm font-bold">{detail.isLaying ? `${detail.layingRate}%` : '-'}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-stone-400">Huevos/dia</p>
                <p className="text-sm font-bold">{detail.isLaying ? fmtNum(detail.eggsPerDay) : '-'}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-stone-400">Ingreso/mes</p>
                <p className="text-sm font-bold text-green-700">{detail.isLaying ? fmtRD(detail.eggRevenue) : '-'}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <p className="text-[9px] text-stone-400">Feed/mes</p>
                <p className="text-sm font-bold text-red-600">{fmtRD(detail.monthlyFeedCost)}</p>
              </div>
              <div className={`rounded-lg p-2 text-center ${detail.netBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className="text-[9px] text-stone-400">Balance/mes</p>
                <p className={`text-sm font-bold ${detail.netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {detail.netBalance >= 0 ? '+' : ''}{fmtRD(detail.netBalance)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sub-tabs (compact pill-style) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              activeSubTab === tab.key
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeSubTab === 'general' && (
        <GeneralTab batch={batch} config={config} updateBatch={updateBatch} detail={detail} calc={calc} />
      )}
      {activeSubTab === 'produccion' && (
        <ProduccionTab batch={batch} config={config} detail={detail} />
      )}
      {activeSubTab === 'feed' && (
        <FeedTab batch={batch} config={config} detail={detail} calc={calc} />
      )}
      {activeSubTab === 'salud' && (
        <SaludTab batch={batch} config={config} />
      )}
      {activeSubTab === 'finanzas' && (
        <FinanzasTab batch={batch} config={config} detail={detail} calc={calc} />
      )}
      {activeSubTab === 'alertas' && (
        <AlertasTab batch={batch} config={config} />
      )}
    </div>
  )
}

// ================================================================
// SUB-TAB COMPONENTS
// ================================================================
function GeneralTab({ batch, config, updateBatch, detail, calc }: {
  batch: BatchConfig; config: FarmConfig; updateBatch: (id: string, field: keyof BatchConfig, value: boolean | number | string) => void;
  detail: CalculationsResult['batchDetails'][0] | undefined; calc: CalculationsResult
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-semibold text-stone-700 mb-3">Datos del Lote</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NumberInput label="Cantidad de Aves" value={batch.hens} onChange={v => updateBatch(batch.id, 'hens', v)} step={50} min={0} tooltip="Cantidad de aves activas" />
          <NumberInput label="Mes del Ciclo" value={batch.cycleMonth} onChange={v => updateBatch(batch.id, 'cycleMonth', v)} step={0.5} min={0} max={30} tooltip="Mes actual desde inicio. Fase se calcula automaticamente." />
          <NumberInput label="% Postura" value={batch.layingRate} onChange={v => updateBatch(batch.id, 'layingRate', v)} step={1} min={0} max={100} suffix="%" disabled={!batch.isLaying} tooltip="% de postura actual" />
        </div>

        <div>
          <Label className="text-xs text-stone-600 mb-2">Fase Actual</Label>
          <div className="h-9 rounded-md border bg-stone-50 px-3 flex items-center text-sm text-stone-600 mb-2">{config.feedPhases[batch.phase].label} ({config.feedPhases[batch.phase].weeks})</div>
          <div className="flex flex-wrap gap-1">
            {PHASE_KEYS.map(phase => (
              <Button key={phase} variant={batch.phase === phase ? 'default' : 'outline'} size="sm"
                className="text-[10px] h-7 px-2"
                onClick={() => updateBatch(batch.id, 'phase', phase)}>
                {config.feedPhases[phase].label}
              </Button>
            ))}
          </div>
        </div>

        {/* Feed Cost Summary */}
        {detail && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-[10px] text-red-600 mb-1">Costo Feed Mensual</p>
              <p className="text-lg font-bold text-red-700">{fmtRD(detail.monthlyFeedCost)}</p>
              <p className="text-[10px] text-stone-500">{fmtNum(detail.monthlyFeedKg)} kg/mes | {config.feedPhases[batch.phase].consumption}g/ave/dia</p>
            </div>
            {detail.isLaying && (
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-[10px] text-green-600 mb-1">Ingreso Huevos Mensual</p>
                <p className="text-lg font-bold text-green-700">{fmtRD(detail.eggRevenue)}</p>
                <p className="text-[10px] text-stone-500">{fmtNum(detail.eggsPerMonth)} huevos/mes a {fmtRD(config.eggPrice)}/huevo</p>
              </div>
            )}
            <div className={`p-3 rounded-lg ${detail.netBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-[10px] ${detail.netBalance >= 0 ? 'text-green-600' : 'text-red-600'} mb-1`}>Balance Mensual</p>
              <p className={`text-lg font-bold ${detail.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                {detail.netBalance >= 0 ? '+' : ''}{fmtRD(detail.netBalance)}
              </p>
              <p className="text-[10px] text-stone-500">
                {detail.isLaying ? 'Ingreso huevos - Gasto feed' : 'Solo gastos (no en postura)'}
              </p>
            </div>
          </div>
        )}

        {/* Investment */}
        <div className="p-3 bg-violet-50 rounded-lg">
          <p className="text-[10px] text-violet-600 mb-1">Inversion Inicial</p>
          <p className="text-sm font-bold text-violet-800">{fmtRD(detail?.batchInvestment || 0)}</p>
          <p className="text-[10px] text-stone-500">
            {fmtNum(batch.hens)} aves x {fmtRD(detail?.initialInvestmentPerBird || 0)}/ave
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ProduccionTab({ batch, config, detail }: {
  batch: BatchConfig; config: FarmConfig
  detail: CalculationsResult['batchDetails'][0] | undefined
}) {
  return (
    <OperationsPanel
      batches={[batch]}
      config={config}
      fmtRD={fmtRD}
      fmtNum={fmtNum}
      batchId={batch.id}
    />
  )
}

function FeedTab({ batch, config, detail, calc }: {
  batch: BatchConfig; config: FarmConfig; detail: CalculationsResult['batchDetails'][0] | undefined; calc: CalculationsResult
}) {
  const feed = config.feedPhases[batch.phase]
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Alimentacion — {feed.label}</h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <p className="text-[10px] text-amber-600">Consumo</p>
              <p className="text-lg font-bold text-amber-800">{feed.consumption}g/ave/dia</p>
              <p className="text-[10px] text-stone-500">{fmtNum(batch.hens * feed.consumption)}g total/dia</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-[10px] text-red-600">Precio</p>
              <p className="text-lg font-bold text-red-700">{fmtRD(feed.price)}/qq</p>
              <p className="text-[10px] text-stone-500">{fmtNum(calc.feedCostByPhase?.find(fp => fp.phaseKey === batch.phase)?.defMonthlyCost || 0)} vs base</p>
            </div>
            <div className="p-3 bg-stone-50 rounded-lg">
              <p className="text-[10px] text-stone-500">Costo Mensual</p>
              <p className="text-lg font-bold text-stone-700">{fmtRD(detail?.monthlyFeedCost || 0)}</p>
              <p className="text-[10px] text-stone-500">{fmtNum(detail?.monthlyFeedKg || 0)} kg/mes</p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Costo por ave/mes</span>
            <span className="font-bold text-red-700">{detail ? fmtRD(detail.monthlyFeedCost / batch.hens) : '-'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-600">Consumo diario total</span>
            <span className="font-medium text-stone-700">{detail ? fmtNum(Math.round(detail.monthlyFeedKg / 30)) : '-'} kg</span>
          </div>
        </CardContent>
      </Card>

      {/* Feed inventory for this phase */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-stone-700">Inventario de Alimento — {feed.label}</h3>
          <OperationsPanel batches={[batch]} config={config} fmtRD={fmtRD} fmtNum={fmtNum} batchId={batch.id} />
        </CardContent>
      </Card>
    </div>
  )
}

function SaludTab({ batch, config }: {
  batch: BatchConfig; config: FarmConfig
}) {
  return (
    <OperationsPanel batches={[batch]} config={config} fmtRD={fmtRD} fmtNum={fmtNum} batchId={batch.id} />
  )
}

function FinanzasTab({ batch, config, detail, calc }: {
  batch: BatchConfig; config: FarmConfig; detail: CalculationsResult['batchDetails'][0] | undefined; calc: CalculationsResult
}) {
  if (!detail) return null
  const isLaying = batch.isLaying
  const roi = detail.netBalance > 0 ? ((detail.eggRevenue - detail.monthlyFeedCost) / detail.batchInvestment * 100 * 12) : 0

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <h3 className="text-sm font-semibold text-stone-700">Finanzas — {batch.name}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Revenue */}
          <div className="p-3 bg-green-50 rounded-lg space-y-1.5">
            <p className="text-[10px] text-green-600 font-medium">INGRESOS</p>
            {isLaying ? (
              <>
                <div className="flex justify-between text-sm"><span>Venta Huevos/mes</span><span className="font-bold text-green-700">{fmtRD(detail.eggRevenue)}</span></div>
                <div className="flex justify-between text-sm text-stone-500"><span>Huevos/mes</span><span>{fmtNum(detail.eggsPerMonth)}</span></div>
                <div className="flex justify-between text-sm text-stone-500"><span>Precio/huevo</span><span>{fmtRD(config.eggPrice)}</span></div>
              </>
            ) : (
              <p className="text-sm text-stone-400">No en postura</p>
            )}
            <div className="flex justify-between text-sm text-stone-500"><span>Venta Desecho</span><span>{fmtRD(batch.hens * config.henSalePrice)}</span></div>
          </div>

          {/* Expenses */}
          <div className="p-3 bg-red-50 rounded-lg space-y-1.5">
            <p className="text-[10px] text-red-600 font-medium">GASTOS</p>
            <div className="flex justify-between text-sm"><span>Feed</span><span className="font-bold text-red-700">{fmtRD(detail.monthlyFeedCost)}</span></div>
            <div className="flex justify-between text-sm text-stone-500"><span>Costo/ave/mes</span><span>{fmtRD(detail.monthlyFeedCost / batch.hens)}</span></div>
            <div className="flex justify-between text-sm text-stone-500"><span>Feed/Gasto Total</span>
              <span>{calc.totalExpenses > 0 ? fmtPct(detail.monthlyFeedCost / calc.totalExpenses * 100) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Balance & ROI */}
        <div className={`p-4 rounded-lg ${detail.netBalance >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold">Balance Neto Mensual</span>
            <span className={`text-lg font-bold ${detail.netBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {detail.netBalance >= 0 ? '+' : ''}{fmtRD(detail.netBalance)}
            </span>
          </div>
          {isLaying && (
            <div className="flex justify-between text-xs text-stone-500">
              <span>ROI Anual Estimado</span>
              <span className={`font-bold ${roi > 0 ? 'text-green-700' : 'text-red-600'}`}>{roi.toFixed(1)}%</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-stone-500 mt-1">
            <span>Inversion Inicial</span>
            <span>{fmtRD(detail.batchInvestment)}</span>
          </div>
          <div className="flex justify-between text-xs text-stone-500">
            <span>Payback (balance)</span>
            <span>{detail.netBalance > 0 ? `${Math.ceil(detail.batchInvestment / detail.netBalance)} meses` : 'N/A'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertasTab({ batch, config }: {
  batch: BatchConfig; config: FarmConfig
}) {
  return (
    <RemindersPanel batches={[batch]} config={config} fmtRD={fmtRD} fmtNum={fmtNum} batchId={batch.id} />
  )
}
