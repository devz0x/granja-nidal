'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Printer, FileText, Building2, Heart, Users, Landmark, ClipboardList, DollarSign, TrendingUp,
} from 'lucide-react'

// ================================================================
// TYPES FOR REPORT DATA
// ================================================================
interface ReportBatch {
  id: string
  name: string
  hens: number
  layingRate: number
  isLaying: boolean
  cycleMonth: number
  phase: string
}

interface ReportFeedPhase {
  label: string
  consumption: number
  price: number
  weeks: string
}

interface ReportConfig {
  eggPrice: number
  henSalePrice: number
  chickPrice: number
  vaccinesCostPerBird: number
  equipmentCostPerBird: number
  mortalityRate: number
  shed1Cost: number
  shedAdditionalCost: number
  baseLayingRate: number
  layingCycleMonths: number
  hensPerBatch: number
  fixedCostsMonthly: number
  otherCosts: number
  feedPhases: Record<string, ReportFeedPhase>
}

interface StructuralExpense {
  id: string
  description: string
  amount: number
  frequency: string
  isActive: boolean
}

interface ReportCalculations {
  totalEggRevenue: number
  totalFeedCost: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
  feedPercentage: number
  costPerEgg: number
  costPerBirdMonthly: number
  revenuePerBirdMonthly: number
  structuralMonthlyTotal: number
  structuralAnnualTotal: number
  totalHens: number
  totalEggs: number
  layingBatches: number
  breakEvenEggsPerDay: number
  newBatchInvestment: number
  newBatchInvestmentWithMortality: number
  infraCost: number
  batchDetails: {
    name: string; phase: string; hens: number; isLaying: boolean; layingRate: number
    eggsPerMonth: number; eggRevenue: number; monthlyFeedCost: number; netBalance: number
  }[]
}

interface ReportsPanelProps {
  batches: ReportBatch[]
  config: ReportConfig
  calculations: ReportCalculations
  structuralExpenses: StructuralExpense[]
  farmName: string
}

// ================================================================
// HELPERS
// ================================================================
function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}
function fmtNum(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}
function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

const FREQUENCY_MULTIPLIER: Record<string, number> = { unico: 1, mensual: 12, trimestral: 4, semestral: 2, anual: 1 }

const today = () => new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })

// ================================================================
// PRINT HELPER
// ================================================================
function PrintButton({ label }: { label: string }) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs print:hidden" onClick={() => window.print()}>
      <Printer className="w-3.5 h-3.5" /> {label}
    </Button>
  )
}

function ReportHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="print:mb-4 mb-2 pb-3 border-b-2 border-stone-300 print:border-b-black">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center print:bg-amber-500">
            <span className="text-white text-lg font-bold">G</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-stone-900 print:text-base">{title}</h1>
            <p className="text-xs text-stone-500 print:text-xs">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right print:text-right">
            <p className="text-xs text-stone-500 print:text-xs">{today()}</p>
            <p className="text-[10px] text-stone-400 print:text-[10px]">Generado automaticamente</p>
          </div>
          {icon}
        </div>
      </div>
    </div>
  )
}

// ================================================================
// 1. REPORTE PARA EL CONTABLE
// ================================================================
function ReportContable({ c, config, structuralExpenses, batches }: { c: ReportCalculations; config: ReportConfig; structuralExpenses: StructuralExpense[]; batches: ReportBatch[] }) {
  const activeStructural = structuralExpenses.filter(e => e.isActive)
  const depreciacionMensual = config.shed1Cost / 120 + Math.max(0, batches.length - 1) * (config.shedAdditionalCost / 120) // 10 years

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">ESTADO DE RESULTADOS DEL MES</h2>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-stone-300 print:border-b-black">
            <th className="text-left py-1.5 print:py-1">Concepto</th>
            <th className="text-right py-1.5 print:py-1">Monto (RD$)</th>
            <th className="text-right py-1.5 print:py-1">%</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 font-medium text-green-700">+ Venta de Huevos</td>
            <td className="text-right text-green-700 font-medium">{fmtRD(c.totalEggRevenue)}</td>
            <td className="text-right">{c.totalEggRevenue}/{c.totalExpenses > 0 ? fmtPct(c.totalEggRevenue / (c.totalEggRevenue + c.totalExpenses) * 100) : '-'}</td>
          </tr>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 text-stone-500 font-medium">VENTAS TOTALES</td>
            <td className="text-right font-bold text-green-700">{fmtRD(c.totalEggRevenue)}</td>
            <td className="text-right font-bold">100%</td>
          </tr>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 text-red-600">- Alimentacion</td>
            <td className="text-right text-red-600">{fmtRD(c.totalFeedCost)}</td>
            <td className="text-right">{fmtPct(c.totalExpenses > 0 ? c.totalFeedCost / c.totalExpenses * 100 : 0)}</td>
          </tr>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 text-red-600">- Gastos Fijos (nomina, luz, agua)</td>
            <td className="text-right text-red-600">{fmtRD(config.fixedCostsMonthly)}</td>
            <td className="text-right">{fmtPct(c.totalExpenses > 0 ? config.fixedCostsMonthly / c.totalExpenses * 100 : 0)}</td>
          </tr>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 text-red-600">- Gastos Estructurales (prorrateado)</td>
            <td className="text-right text-red-600">{fmtRD(c.structuralMonthlyTotal)}</td>
            <td className="text-right">{fmtPct(c.totalExpenses > 0 ? c.structuralMonthlyTotal / c.totalExpenses * 100 : 0)}</td>
          </tr>
          <tr className="border-b border-stone-100 print:border-b-stone-300">
            <td className="py-1.5 print:py-1 text-stone-400">- Depreciacion infraestructura (estimada)</td>
            <td className="text-right text-stone-400">{fmtRD(depreciacionMensual)}</td>
            <td className="text-right text-stone-400">-</td>
          </tr>
          <tr className="border-b-2 border-stone-300 print:border-b-black">
            <td className="py-1.5 print:py-1 font-bold text-red-700">GASTOS TOTALES</td>
            <td className="text-right font-bold text-red-700">{fmtRD(c.totalExpenses)}</td>
            <td className="text-right font-bold">100%</td>
          </tr>
          <tr className="bg-green-50 print:bg-white print:font-bold">
            <td className="py-2 print:py-1.5 font-bold text-green-800">UTILIDAD NETA DEL MES</td>
            <td className="text-right font-bold text-green-800 text-sm print:text-sm">{fmtRD(c.netProfit)}</td>
            <td className="text-right font-bold">{fmtPct(c.profitMargin)}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-4 print:mt-3 print:text-xs">DETALLE DE GASTOS ESTRUCTURALES ACTIVOS</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Descripcion</th>
            <th className="text-right py-1 print:py-0.5">Monto</th>
            <th className="text-right py-1 print:py-0.5">Frecuencia</th>
            <th className="text-right py-1 print:py-0.5">Mensual Equiv.</th>
            <th className="text-right py-1 print:py-0.5">Anual</th>
          </tr>
        </thead>
        <tbody>
          {activeStructural.map(exp => (
            <tr key={exp.id} className="border-b border-stone-50 print:border-b-stone-200">
              <td className="py-1 print:py-0.5">{exp.description}</td>
              <td className="text-right">{fmtRD(exp.amount)}</td>
              <td className="text-right capitalize text-stone-500">{exp.frequency}</td>
              <td className="text-right font-medium">{fmtRD(exp.amount * (FREQUENCY_MULTIPLIER[exp.frequency] || 1) / 12)}</td>
              <td className="text-right">{fmtRD(exp.amount * (FREQUENCY_MULTIPLIER[exp.frequency] || 1))}</td>
            </tr>
          ))}
          <tr className="font-bold border-t border-stone-300 print:border-t-black">
            <td className="py-1 print:py-0.5">TOTAL ESTRUCTURALES</td>
            <td colSpan={2}></td>
            <td className="text-right">{fmtRD(c.structuralMonthlyTotal)}</td>
            <td className="text-right">{fmtRD(c.structuralAnnualTotal)}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-4 print:mt-3 print:text-xs">BALANCE SIMPLIFICADO</h3>
      <div className="grid grid-cols-2 gap-4 text-xs print:text-xs">
        <div className="space-y-1 border p-3 rounded print:p-2">
          <p className="font-bold text-green-700 mb-1">ACTIVOS</p>
          <div className="flex justify-between"><span>Infraestructura (galpones)</span><span>{fmtRD(config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost)}</span></div>
          <div className="flex justify-between"><span>Aves en inventario</span><span>{fmtRD(c.totalHens * config.chickPrice)}</span></div>
          <div className="flex justify-between"><span>Inventario de alimento (est.)</span><span>Ver inventario</span></div>
        </div>
        <div className="space-y-1 border p-3 rounded print:p-2">
          <p className="font-bold text-red-700 mb-1">PASIVOS + CAPITAL</p>
          <div className="flex justify-between"><span>Prestamos bancarios</span><span>Pendiente</span></div>
          <div className="flex justify-between"><span>Cuentas por pagar</span><span>Pendiente</span></div>
          <div className="flex justify-between font-bold"><span>Capital propio (est.)</span><span>{fmtRD(config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost)}</span></div>
        </div>
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para el contable:</strong> Este es un resumen generado automaticamente. Los gastos estructurales estan prorrateados mensualmente.
        Verificar con facturas y comprobantes fiscales. La depreciacion es estimada a 10 anos lineal. Se recomienda llevar libro diario auxiliar por galpon.
      </div>
    </div>
  )
}

// ================================================================
// 2. REPORTE PARA EL INGENIERO
// ================================================================
function ReportIngeniero({ config, structuralExpenses, batches, calculations }: { config: ReportConfig; structuralExpenses: StructuralExpense[]; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const infraTotal = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const maintenanceItems = structuralExpenses.filter(e => e.isActive && (e.description.toLowerCase().includes('repar') || e.description.toLowerCase().includes('manten') || e.description.toLowerCase().includes('mejor') || e.description.toLowerCase().includes('equipo') || e.description.toLowerCase().includes('cerc') || e.description.toLowerCase().includes('tech') || e.description.toLowerCase().includes('electr') || e.description.toLowerCase().includes('plomer')))
  const biosegItems = structuralExpenses.filter(e => e.isActive && (e.description.toLowerCase().includes('desinf') || e.description.toLowerCase().includes('bioseg') || e.description.toLowerCase().includes('pediluv')))

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">ESTADO DE INFRAESTRUCTURA Y MANTENIMIENTO</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Galpones operativos</p>
          <p className="text-lg font-bold">{batches.length}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Inversion en infra</p>
          <p className="text-lg font-bold">{fmtRD(infraTotal)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Aves totales alojadas</p>
          <p className="text-lg font-bold">{fmtNum(calculations.totalHens)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Densidad est. (aves/m2)</p>
          <p className="text-lg font-bold">~{Math.round(calculations.totalHens / (batches.length * 200))}</p>
        </div>
      </div>

      <h3 className="text-xs font-bold text-stone-700 print:text-xs">ESTADO POR GALPON</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Galpon</th>
            <th className="text-right py-1 print:py-0.5">Aves</th>
            <th className="text-center py-1 print:py-0.5">Fase</th>
            <th className="text-center py-1 print:py-0.5">Mes Ciclo</th>
            <th className="text-right py-1 print:py-0.5">Feed Consumo (g/dia)</th>
            <th className="text-right py-1 print:py-0.5">Agua Est. (L/dia)</th>
            <th className="text-right py-1 print:py-0.5">Ventilacion Req.</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => {
            const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
            return (
              <tr key={b.id} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1.5 print:py-0.5 font-medium">{b.name}</td>
                <td className="text-right">{fmtNum(b.hens)}</td>
                <td className="text-center">{feed?.label || b.phase}</td>
                <td className="text-center">{b.cycleMonth}</td>
                <td className="text-right">{feed?.consumption || '-'}g</td>
                <td className="text-right">{Math.round(b.hens * 0.25)}</td>
                <td className="text-right">{b.hens >= 1500 ? 'Media-Alta' : 'Media'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">ITEMS DE MANTENIMIENTO REGISTRADOS</h3>
      {maintenanceItems.length === 0 ? (
        <p className="text-xs text-stone-400 print:text-xs">Sin items de mantenimiento registrados en gastos estructurales.</p>
      ) : (
        <table className="w-full text-xs print:text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-left py-1 print:py-0.5">Item</th>
              <th className="text-right py-1 print:py-0.5">Monto</th>
              <th className="text-center py-1 print:py-0.5">Frecuencia</th>
              <th className="text-right py-1 print:py-0.5">Anual Est.</th>
            </tr>
          </thead>
          <tbody>
            {maintenanceItems.map(exp => (
              <tr key={exp.id} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1 print:py-0.5">{exp.description}</td>
                <td className="text-right">{fmtRD(exp.amount)}</td>
                <td className="text-center capitalize">{exp.frequency}</td>
                <td className="text-right">{fmtRD(exp.amount * (FREQUENCY_MULTIPLIER[exp.frequency] || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">BIOSEGURIDAD</h3>
      {biosegItems.length > 0 ? (
        <table className="w-full text-xs print:text-xs border-collapse">
          <tbody>
            {biosegItems.map(exp => (
              <tr key={exp.id} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1 print:py-0.5">{exp.description}</td>
                <td className="text-right">{fmtRD(exp.amount)}</td>
                <td className="text-center capitalize">{exp.frequency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-xs text-stone-400 print:text-xs">Sin items de bioseguridad registrados.</p>
      )}

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">REQUISITOS POR GALPON (CHECKLIST)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 print:grid-cols-2">
        {['Sistema de bebederos funcional', 'Comederos en buen estado', 'Ventilacion adecuada', 'Iluminacion operativa', 'Cercado perimetral completo', 'Techo sin filtraciones', 'Piso limpio y seco', 'Pediluvio operativo', 'Almacen de alimento techado', 'Sistema electrico seguro'].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs print:text-xs border p-2 rounded print:p-1">
            <div className="w-4 h-4 rounded border-2 border-stone-300 print:border-black flex-shrink-0" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para ingeniero:</strong> Verificar densidad no exceda 10-12 aves/m2. Mantener temperatura 18-25C. Ventilacion minima 6 cambios/hora.
        Revisar estructuras cada 6 meses. Programar mantenimiento preventivo de bebederos y comederos trimestralmente.
      </div>
    </div>
  )
}

// ================================================================
// 3. REPORTE PARA EL VETERINARIO
// ================================================================
function ReportVeterinario({ batches, config, calculations }: { batches: ReportBatch[]; config: ReportConfig; calculations: ReportCalculations }) {
  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">ESTADO SANITARIO Y PRODUCCION</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Lotes activos</p>
          <p className="text-lg font-bold">{batches.length}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Lotes en postura</p>
          <p className="text-lg font-bold text-green-700">{calculations.layingBatches}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Total aves</p>
          <p className="text-lg font-bold">{fmtNum(calculations.totalHens)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">% Postura base</p>
          <p className="text-lg font-bold">{config.baseLayingRate}%</p>
        </div>
      </div>

      <h3 className="text-xs font-bold text-stone-700 print:text-xs">ESTADO POR LOTE</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Lote</th>
            <th className="text-center py-1 print:py-0.5">Poblacion</th>
            <th className="text-center py-1 print:py-0.5">Fase</th>
            <th className="text-center py-1 print:py-0.5">Edad (meses)</th>
            <th className="text-center py-1 print:py-0.5">% Postura</th>
            <th className="text-right py-1 print:py-0.5">Consumo Feed (g/dia)</th>
            <th className="text-right py-1 print:py-0.5">Agua (L/dia)</th>
            <th className="text-right py-1 print:py-0.5">Huevos/dia (esp.)</th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => {
            const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
            const ageWeeks = Math.round(b.cycleMonth * 4.33)
            const expectedEggs = b.isLaying ? Math.round(b.hens * (b.layingRate / 100)) : 0
            const feedConversion = expectedEggs > 0 ? (b.hens * (feed?.consumption || 0) / expectedEggs).toFixed(2) : '-'
            return (
              <tr key={b.id} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1.5 print:py-0.5 font-medium">{b.name}</td>
                <td className="text-center">{fmtNum(b.hens)}</td>
                <td className="text-center">{feed?.label || b.phase}</td>
                <td className="text-center">{b.cycleMonth}m ({ageWeeks}s)</td>
                <td className="text-center font-medium">{b.isLaying ? b.layingRate + '%' : 'N/A'}</td>
                <td className="text-right">{feed?.consumption || '-'}g</td>
                <td className="text-right">{Math.round(b.hens * 0.25)}</td>
                <td className="text-right">{expectedEggs || '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">PLAN VACUNAL WD80 (REFERENCIA)</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Vacuna</th>
            <th className="text-center py-1 print:py-0.5">Edad Aplicacion</th>
            <th className="text-center py-1 print:py-0.5">Refuerzo</th>
            <th className="text-center py-1 print:py-0.5">Via</th>
            <th className="text-center py-1 print:py-0.5">Costo Est./ave</th>
          </tr>
        </thead>
        <tbody>
          {[
            { name: 'Marek', age: 'Dia 1 (incubadora)', ref: '-', via: 'SC', cost: 'Incluido polla' },
            { name: 'Newcastle (B1)', age: 'Semana 1', ref: 'Semana 3', via: 'Ocular', cost: fmtRD(5) },
            { name: 'Gumboro', age: 'Semana 1-2', ref: 'Semana 3-4', via: 'Agua bebida', cost: fmtRD(8) },
            { name: 'Bronquitis Infecciosa', age: 'Semana 2', ref: 'Semana 5', via: 'Ocular', cost: fmtRD(6) },
            { name: 'Newcastle (Lasota)', age: 'Semana 6', ref: 'Cada 8 semanas', via: 'Agua bebida', cost: fmtRD(4) },
            { name: 'Coriza Infecciosa', age: 'Semana 5', ref: 'Semana 9', via: 'Inyectable', cost: fmtRD(10) },
            { name: 'Encefalomielitis', age: 'Semana 8', ref: 'Semana 14', via: 'Ala', cost: fmtRD(5) },
            { name: 'Gumboro (refuerzo)', age: 'Semana 14', ref: '-', via: 'Agua bebida', cost: fmtRD(6) },
          ].map((vac, i) => (
            <tr key={i} className="border-b border-stone-50 print:border-b-stone-200">
              <td className="py-1 print:py-0.5 font-medium">{vac.name}</td>
              <td className="text-center">{vac.age}</td>
              <td className="text-center">{vac.ref}</td>
              <td className="text-center">{vac.via}</td>
              <td className="text-right">{vac.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">INDICADORES DE CONVERSION</h3>
      <div className="grid grid-cols-2 gap-3 print:grid-cols-2 print:gap-2 text-xs print:text-xs">
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Costo de vacunas/ave</p>
          <p className="text-base font-bold">{fmtRD(config.vaccinesCostPerBird)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Mortalidad esperada (cria)</p>
          <p className="text-base font-bold">{config.mortalityRate}%</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Costo ave produc. (con mortalidad)</p>
          <p className="text-base font-bold">{fmtRD(calculations.newBatchInvestmentWithMortality / config.hensPerBatch)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Duracion ciclo postura</p>
          <p className="text-base font-bold">{config.layingCycleMonths} meses</p>
        </div>
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para veterinario:</strong> Monitorear mortalidad diaria. Alerta si supera 0.5% por dia.
        Verificar consumo de agua como indicador de salud. Evaluar calidad del huevo (cascara, yema, clara) semanalmente.
        La conversion feed/huevo ideal WD80 es 2.1-2.3g de feed por gramo de huevo. Temperatura ambiente ideal 18-25C.
      </div>
    </div>
  )
}

// ================================================================
// 4. REPORTE PARA LOS SOCIOS
// ================================================================
function ReportSocios({ c, config, batches, calculations }: { c: ReportCalculations; config: ReportConfig; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const totalInvestment = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost + batches.length * calculations.newBatchInvestmentWithMortality
  const monthlyROI = totalInvestment > 0 ? (c.netProfit / totalInvestment * 100) : 0
  const annualROI = monthlyROI * 12
  const paybackMonths = c.netProfit > 0 ? Math.ceil(totalInvestment / c.netProfit) : 999

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">RESUMEN EJECUTIVO PARA SOCIOS</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 print:grid-cols-4 print:gap-2">
        <div className="border-l-4 border-l-green-500 bg-green-50 p-3 rounded print:p-2 print:bg-white">
          <p className="text-[10px] text-stone-500">Utilidad Neta/Mes</p>
          <p className="text-xl font-bold text-green-700">{fmtRD(c.netProfit)}</p>
        </div>
        <div className="border-l-4 border-l-amber-500 bg-amber-50 p-3 rounded print:p-2 print:bg-white">
          <p className="text-[10px] text-stone-500">Margen de Ganancia</p>
          <p className="text-xl font-bold text-amber-700">{fmtPct(c.profitMargin)}</p>
        </div>
        <div className="border-l-4 border-l-violet-500 bg-violet-50 p-3 rounded print:p-2 print:bg-white">
          <p className="text-[10px] text-stone-500">ROI Anual Estimado</p>
          <p className="text-xl font-bold text-violet-700">{fmtPct(annualROI)}</p>
        </div>
        <div className="border-l-4 border-l-stone-500 bg-stone-50 p-3 rounded print:p-2 print:bg-white">
          <p className="text-[10px] text-stone-500">Recuperacion Inversion</p>
          <p className="text-xl font-bold">{paybackMonths === 999 ? 'N/A' : paybackMonths + ' meses'}</p>
        </div>
      </div>

      <h3 className="text-xs font-bold text-stone-700 print:text-xs">INVERSION TOTAL</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Concepto</th>
            <th className="text-right py-1 print:py-0.5">Monto</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Infraestructura ({batches.length} galpones)</td>
            <td className="text-right font-medium">{fmtRD(config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Aves ({batches.length} lotes x {fmtNum(config.hensPerBatch)} ave, c/mortalidad)</td>
            <td className="text-right font-medium">{fmtRD(batches.length * calculations.newBatchInvestmentWithMortality)}</td>
          </tr>
          <tr className="font-bold border-t-2 border-stone-300 print:border-t-black">
            <td className="py-1.5 print:py-0.5">TOTAL INVERTIDO</td>
            <td className="text-right text-base">{fmtRD(totalInvestment)}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">ESTADO DE RESULTADOS DEL MES</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5 text-green-700">Ingresos por huevos</td>
            <td className="text-right text-green-700 font-medium">{fmtRD(c.totalEggRevenue)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5 text-red-600">(-) Gastos totales</td>
            <td className="text-right text-red-600">{fmtRD(c.totalExpenses)}</td>
          </tr>
          <tr className="bg-green-50 font-bold print:bg-white">
            <td className="py-1.5 print:py-0.5 text-green-800">= Utilidad neta</td>
            <td className="text-right text-green-800">{fmtRD(c.netProfit)}</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">KPIs CLAVE</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:grid-cols-3 print:gap-1">
        {[
          { label: 'Costo por huevo', value: fmtRD(c.costPerEgg), ref: `Precio venta: ${fmtRD(config.eggPrice)}` },
          { label: 'Ganancia/ave/mes', value: fmtRD(c.revenuePerBirdMonthly - c.costPerBirdMonthly), ref: `${fmtNum(calculations.totalHens)} aves` },
          { label: 'Ingreso/ave/mes', value: fmtRD(c.revenuePerBirdMonthly), ref: 'Solo lotes en postura' },
          { label: 'Lotes en postura', value: `${calculations.layingBatches}/${batches.length}`, ref: 'Operativos' },
          { label: 'Total huevos/mes', value: fmtNum(calculations.totalEggs), ref: 'Produccion total' },
          { label: 'Pto. equilibrio', value: fmtNum(c.breakEvenEggsPerDay) + '/dia', ref: 'Huevos minimos' },
        ].map((kpi, i) => (
          <div key={i} className="border p-2.5 rounded print:p-1.5 text-xs print:text-xs">
            <p className="text-[10px] text-stone-500">{kpi.label}</p>
            <p className="font-bold text-sm">{kpi.value}</p>
            <p className="text-[9px] text-stone-400">{kpi.ref}</p>
          </div>
        ))}
      </div>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">PROYECCION ANUAL (ESCALADA)</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Concepto</th>
            <th className="text-right py-1 print:py-0.5">Mensual</th>
            <th className="text-right py-1 print:py-0.5">Anual</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Ingreso por huevos</td>
            <td className="text-right">{fmtRD(c.totalEggRevenue)}</td>
            <td className="text-right font-medium">{fmtRD(c.totalEggRevenue * 12)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Gastos totales</td>
            <td className="text-right">{fmtRD(c.totalExpenses)}</td>
            <td className="text-right">{fmtRD(c.totalExpenses * 12)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Utilidad neta</td>
            <td className="text-right text-green-700 font-medium">{fmtRD(c.netProfit)}</td>
            <td className="text-right text-green-700 font-bold">{fmtRD(c.netProfit * 12)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Venta gallinas desecho (est.)</td>
            <td className="text-right text-stone-400">-</td>
            <td className="text-right">{fmtRD(calculations.totalHens * config.henSalePrice)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para socios:</strong> La proyeccion anual es una estimacion basada en los precios y parametros actuales.
        Factores como variacion estacional de precios, mortalidad, y cambios en costo de alimento pueden afectar los resultados reales.
        Se recomienda revisar mensualmente y ajustar la proyeccion. ROI del {fmtPct(annualROI)} = {fmtPct(annualROI / 12)} mensual.
      </div>
    </div>
  )
}

// ================================================================
// 5. REPORTE PARA EL BANCO (PROYECCION)
// ================================================================
function ReportBanco({ c, config, batches, calculations }: { c: ReportCalculations; config: ReportConfig; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const totalInvestment = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost + batches.length * calculations.newBatchInvestmentWithMortality
  const infraValue = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const annualNet = c.netProfit * 12
  const debtServiceRatio = annualNet > 0 ? (annualNet / totalInvestment * 100) : 0

  // 12-month projection
  const projection = useMemo(() => {
    const months: { month: string; revenue: number; expenses: number; net: number; cumulative: number }[] = []
    let cumulative = -totalInvestment
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const monthName = d.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' })
      // Assume steady production, slight seasonal variation
      const seasonFactor = [0.98, 0.99, 1.0, 1.0, 0.99, 0.98, 1.01, 1.02, 1.0, 0.99, 0.98, 1.0][i]
      const rev = Math.round(c.totalEggRevenue * seasonFactor)
      const exp = Math.round(c.totalExpenses * (1 + (Math.random() * 0.04 - 0.02))) // slight variation
      const net = rev - exp
      cumulative += net
      months.push({ month: monthName, revenue: rev, expenses: exp, net, cumulative })
    }
    return months
  }, [c.totalEggRevenue, c.totalExpenses])

  const breakEvenMonth = projection.findIndex(m => m.cumulative >= 0)

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">PROYECCION FINANCIERA Y SOLVENCIA</h2>

      <h3 className="text-xs font-bold text-stone-700 print:text-xs">INFORMACION DEL PROYECTO</h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 text-xs print:text-xs">
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Tipo de negocio</p>
          <p className="font-bold">Produccion avicola (huevos)</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Raza</p>
          <p className="font-bold">Lohmann Brown WD80</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Capacidad instalada</p>
          <p className="font-bold">{fmtNum(calculations.totalHens)} aves / {batches.length} galpones</p>
        </div>
      </div>

      <h3 className="text-xs font-bold text-stone-700 print:text-xs">RESUMEN DE INVERSION</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Rubro</th>
            <th className="text-right py-1 print:py-0.5">Monto (RD$)</th>
            <th className="text-center py-1 print:py-0.5">Garantia Real</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Infraestructura (galpones)</td>
            <td className="text-right">{fmtRD(infraValue)}</td>
            <td className="text-center">Si</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 print:py-0.5">Capital de trabajo (aves + feed)</td>
            <td className="text-right">{fmtRD(batches.length * calculations.newBatchInvestmentWithMortality)}</td>
            <td className="text-center">No</td>
          </tr>
          <tr className="font-bold border-t-2 border-stone-300 print:border-t-black">
            <td className="py-1.5 print:py-0.5">TOTAL INVERSION SOLICITADA</td>
            <td className="text-right">{fmtRD(totalInvestment)}</td>
            <td className="text-center">-</td>
          </tr>
        </tbody>
      </table>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">PROYECCION DE FLUJO DE CAJA A 12 MESES</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 print:py-0.5">Mes</th>
              <th className="text-right py-1 print:py-0.5">Ingresos</th>
              <th className="text-right py-1 print:py-0.5">Gastos</th>
              <th className="text-right py-1 print:py-0.5">Neto</th>
              <th className="text-right py-1 print:py-0.5">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100 print:border-b-stone-300 bg-stone-50 print:bg-gray-100">
              <td className="py-1 print:py-0.5 font-medium">INVERSION INICIAL</td>
              <td></td><td></td><td></td>
              <td className="text-right font-bold text-red-700">{fmtRD(-totalInvestment)}</td>
            </tr>
            {projection.map((m, i) => (
              <tr key={i} className={`border-b border-stone-50 print:border-b-stone-200 ${m.cumulative >= 0 ? 'bg-green-50 print:bg-white font-bold' : ''}`}>
                <td className="py-1 print:py-0.5">{m.month}</td>
                <td className="text-right text-green-700">{fmtRD(m.revenue)}</td>
                <td className="text-right text-red-600">{fmtRD(m.expenses)}</td>
                <td className={`text-right ${m.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(m.net)}</td>
                <td className={`text-right font-medium ${m.cumulative >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(m.cumulative)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs">INDICADORES FINANCIEROS</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2 text-xs print:text-xs">
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Ingreso anual estimado</p>
          <p className="text-lg font-bold text-green-700">{fmtRD(c.totalEggRevenue * 12)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Utilidad neta anual</p>
          <p className="text-lg font-bold text-green-700">{fmtRD(annualNet)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Garantia real (infra)</p>
          <p className="text-lg font-bold">{fmtRD(infraValue)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Relacion ingreso/inversion</p>
          <p className="text-lg font-bold">{((c.totalEggRevenue * 12) / totalInvestment).toFixed(2)}x</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Capacidad de pago anual</p>
          <p className="text-lg font-bold text-green-700">{fmtPct(debtServiceRatio)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Break-even estimado</p>
          <p className="text-lg font-bold">{breakEvenMonth >= 0 ? `Mes ${breakEvenMonth + 1}` : 'N/A'}</p>
        </div>
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para el banco:</strong> Esta proyeccion se basa en precios y parametros actuales. La granja avicola WD80 tiene una demanda estable de huevos.
        La infraestructura (galpones) sirve como garantia real con valor de {fmtRD(infraValue)}.
        Se recomienda financiamiento a {Math.max(24, paybackMonths(batches, config, calculations, totalInvestment))} meses con cuotas mensuales no mayores a {fmtRD(annualNet / 12 * 0.4)} (40% de la utilidad neta mensual).
        Incluir seguro de aves e infraestructura como requisito.
      </div>
    </div>
  )
}

function paybackMonths(batches: ReportBatch[], config: ReportConfig, calculations: ReportCalculations, totalInvestment: number): number {
  return calculations.netProfit > 0 ? Math.ceil(totalInvestment / calculations.netProfit) : 999
}

// ================================================================
// MAIN REPORTS PANEL
// ================================================================
export default function ReportsPanel({ batches, config, calculations, structuralExpenses, farmName }: ReportsPanelProps) {
  const [activeReport, setActiveReport] = useState('contable')

  const reports = [
    { key: 'contable', label: 'Contable', icon: <DollarSign className="w-4 h-4" />, color: 'text-green-600' },
    { key: 'ingeniero', label: 'Ingeniero', icon: <Building2 className="w-4 h-4" />, color: 'text-amber-600' },
    { key: 'veterinario', label: 'Veterinario', icon: <Heart className="w-4 h-4" />, color: 'text-sky-600' },
    { key: 'socios', label: 'Socios', icon: <Users className="w-4 h-4" />, color: 'text-violet-600' },
    { key: 'banco', label: 'Banco', icon: <Landmark className="w-4 h-4" />, color: 'text-stone-600' },
  ]

  return (
    <div className="space-y-4">
      {/* Report selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 print:hidden">
        {reports.map(r => (
          <Button key={r.key}
            variant={activeReport === r.key ? 'default' : 'outline'}
            size="sm"
            className={`gap-1.5 text-xs justify-start ${activeReport === r.key ? 'bg-stone-900' : ''}`}
            onClick={() => setActiveReport(r.key)}>
            <span className={activeReport !== r.key ? r.color : 'text-white'}>{r.icon}</span>
            {r.label}
          </Button>
        ))}
      </div>

      {/* Report content */}
      <Card className="print:shadow-none print:border-0 print:p-0">
        <CardContent className="p-4 sm:p-6 print:p-4">
          {activeReport === 'contable' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title={`Granja Gallinas WD80 - Reporte Contable`} subtitle="Estado de resultados y balance simplificado" icon={<DollarSign className="w-5 h-5 text-green-600 print:hidden" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Contable" subtitle="Estado de resultados y balance simplificado" icon={<DollarSign className="w-5 h-5 text-green-600" />} />
              </div>
              <ReportContable c={calculations} config={config} structuralExpenses={structuralExpenses} batches={batches} />
            </>
          )}

          {activeReport === 'ingeniero' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte de Mantenimiento" subtitle="Infraestructura, equipos y bioseguridad" icon={<Building2 className="w-5 h-5 text-amber-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte de Mantenimiento" subtitle="Infraestructura, equipos y bioseguridad" icon={<Building2 className="w-5 h-5 text-amber-600" />} />
              </div>
              <ReportIngeniero config={config} structuralExpenses={structuralExpenses} batches={batches} calculations={calculations} />
            </>
          )}

          {activeReport === 'veterinario' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Veterinario" subtitle="Estado sanitario, produccion y plan vacunal" icon={<Heart className="w-5 h-5 text-sky-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Veterinario" subtitle="Estado sanitario, produccion y plan vacunal" icon={<Heart className="w-5 h-5 text-sky-600" />} />
              </div>
              <ReportVeterinario batches={batches} config={config} calculations={calculations} />
            </>
          )}

          {activeReport === 'socios' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte para Socios" subtitle="Resumen ejecutivo, KPIs y proyeccion" icon={<Users className="w-5 h-5 text-violet-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte para Socios" subtitle="Resumen ejecutivo, KPIs y proyeccion" icon={<Users className="w-5 h-5 text-violet-600" />} />
              </div>
              <ReportSocios c={calculations} config={config} batches={batches} calculations={calculations} />
            </>
          )}

          {activeReport === 'banco' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Proyeccion Financiera" subtitle="Solicitud de financiamiento y flujo de caja proyectado" icon={<Landmark className="w-5 h-5 text-stone-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Proyeccion Financiera" subtitle="Solicitud de financiamiento y flujo de caja proyectado" icon={<Landmark className="w-5 h-5 text-stone-600" />} />
              </div>
              <ReportBanco c={calculations} config={config} batches={batches} calculations={calculations} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Print hint */}
      <div className="print:hidden">
        <p className="text-[10px] text-stone-400 text-center">
          Al imprimir, solo se muestra el reporte activo. Los graficos y botones se ocultan automaticamente.
        </p>
      </div>
    </div>
  )
}
