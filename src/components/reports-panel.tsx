'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Printer, FileText, Building2, Heart, Users, Landmark, ClipboardList, DollarSign, TrendingUp,
  TrendingDown, ArrowRight, Calendar, Calculator as CalcIcon, AlertTriangle, PieChart, Percent,
  Clock, ThermometerSun, Droplets, Wind, Zap, Eye, Beaker, Syringe, Pill, Stethoscope,
  HeartPulse, Shield, Scale, HandCoins, PiggyBank, Receipt, FileSpreadsheet, CircleDollarSign,
} from 'lucide-react'

// ================================================================
// TYPES FOR REPORT DATA (KEEP EXACTLY AS IS)
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
// HELPERS (KEEP EXACTLY AS IS)
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
// PRINT HELPER & REPORT HEADER (KEEP EXACTLY AS IS)
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
// SHARED UI: Small labeled input
// ================================================================
function SmallInput({ label, value, onChange, suffix, className = '' }: { label: string; value: number; onChange: (v: number) => void; suffix?: string; className?: string }) {
  return (
    <label className={`flex flex-col gap-0.5 text-[10px] text-stone-600 ${className}`}>
      {label}
      <div className="flex items-center gap-0.5">
        <input
          type="number"
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full border rounded px-1.5 py-0.5 text-xs font-mono bg-white print:border-black"
          step="0.1"
        />
        {suffix && <span className="text-[10px] text-stone-400 whitespace-nowrap">{suffix}</span>}
      </div>
    </label>
  )
}

// ================================================================
// 1. REPORTE PARA EL CONTABLE — MAJOR ENHANCEMENT WITH PROJECTIONS
// ================================================================
function ReportContable({ c, config, structuralExpenses, batches }: { c: ReportCalculations; config: ReportConfig; structuralExpenses: StructuralExpense[]; batches: ReportBatch[] }) {
  const activeStructural = structuralExpenses.filter(e => e.isActive)
  const infraTotal = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const depreciacionMensual = infraTotal / 120 // 10 years linear
  const depreciacionAnual = depreciacionMensual * 12

  // Projection state
  const [projYears, setProjYears] = useState(3)
  const [inflHuevo, setInflHuevo] = useState(3)
  const [inflAlimento, setInflAlimento] = useState(5)
  const [inflFijos, setInflFijos] = useState(4)

  // Year-by-year projection with inflation
  const projection = useMemo(() => {
    const years: { year: number; ingresos: number; gastos: number; utilidad: number; acumulada: number; depreciacion: number; infraRestante: number; impuesto: number; utilidadNeta: number; margen: number; ratioGastos: number }[] = []
    let accum = 0
    let infraRemaining = infraTotal
    for (let y = 1; y <= projYears; y++) {
      const factorH = Math.pow(1 + inflHuevo / 100, y - 1)
      const factorA = Math.pow(1 + inflAlimento / 100, y - 1)
      const factorF = Math.pow(1 + inflFijos / 100, y - 1)

      const annualRevenue = c.totalEggRevenue * 12 * factorH
      const feedAnnual = c.totalFeedCost * 12 * factorA
      const fijosAnnual = (config.fixedCostsMonthly + c.structuralMonthlyTotal) * 12 * factorF
      const depThisYear = y <= 10 ? depreciacionAnual : 0

      const totalGastos = feedAnnual + fijosAnnual + depThisYear
      const utilidad = annualRevenue - totalGastos
      accum += utilidad
      infraRemaining = Math.max(0, infraTotal - depreciacionAnual * Math.min(y, 10))

      // Tax: 27% DR (on positive profit only)
      const impuesto = utilidad > 0 ? utilidad * 0.27 : 0
      const utilNeta = utilidad - impuesto

      years.push({
        year: y,
        ingresos: Math.round(annualRevenue),
        gastos: Math.round(totalGastos),
        utilidad: Math.round(utilidad),
        acumulada: Math.round(accum),
        depreciacion: Math.round(depThisYear),
        infraRestante: Math.round(infraRemaining),
        impuesto: Math.round(impuesto),
        utilidadNeta: Math.round(utilNeta),
        margen: annualRevenue > 0 ? (utilidad / annualRevenue) * 100 : 0,
        ratioGastos: annualRevenue > 0 ? (totalGastos / annualRevenue) : 0,
      })
    }
    return years
  }, [projYears, inflHuevo, inflAlimento, inflFijos, c.totalEggRevenue, c.totalFeedCost, c.totalExpenses, config.fixedCostsMonthly, c.structuralMonthlyTotal, depreciacionAnual, infraTotal])

  const totalIngresos = projection.reduce((s, y) => s + y.ingresos, 0)
  const totalUtilidad = projection.reduce((s, y) => s + y.utilidad, 0)
  const bestYear = projection.reduce((best, y) => y.utilidad > best.utilidad ? y : best, projection[0])
  const avgProfit = projection.length > 0 ? totalUtilidad / projection.length : 0

  return (
    <div className="space-y-4 print:space-y-3">
      {/* ===== PROJECTION SECTION ===== */}
      <div className="border border-dashed border-amber-300 bg-amber-50/40 p-3 rounded-lg print:border-amber-400 print:bg-amber-50/60">
        <h2 className="text-sm font-bold text-stone-800 print:text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-600" /> SISTEMA DE PROYECCION FINANCIERA
        </h2>

        {/* Controls */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 mb-3 print:grid-cols-4">
          <SmallInput label="Horizonte (anos)" value={projYears} onChange={v => setProjYears(Math.min(10, Math.max(1, v)))} suffix="anos" />
          <SmallInput label="Inflacion precio huevo" value={inflHuevo} onChange={setInflHuevo} suffix="%/ano" />
          <SmallInput label="Inflacion costo alimento" value={inflAlimento} onChange={setInflAlimento} suffix="%/ano" />
          <SmallInput label="Inflacion gastos fijos" value={inflFijos} onChange={setInflFijos} suffix="%/ano" />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
          <div className="border-l-4 border-l-green-500 bg-green-50 p-2.5 rounded print:p-2 print:bg-white">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><CircleDollarSign className="w-3 h-3" /> Utilidad total {projYears} anos</p>
            <p className="text-base font-bold text-green-700">{fmtRD(totalUtilidad)}</p>
          </div>
          <div className="border-l-4 border-l-blue-500 bg-blue-50 p-2.5 rounded print:p-2 print:bg-white">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><CalcIcon className="w-3 h-3" /> Utilidad promedio/ano</p>
            <p className="text-base font-bold text-blue-700">{fmtRD(avgProfit)}</p>
          </div>
          <div className="border-l-4 border-l-amber-500 bg-amber-50 p-2.5 rounded print:p-2 print:bg-white">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Mejor ano</p>
            <p className="text-base font-bold text-amber-700">Ano {bestYear?.year || '-'} ({fmtRD(bestYear?.utilidad || 0)})</p>
          </div>
          <div className="border-l-4 border-l-violet-500 bg-violet-50 p-2.5 rounded print:p-2 print:bg-white">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><Receipt className="w-3 h-3" /> Ingresos totales</p>
            <p className="text-base font-bold text-violet-700">{fmtRD(totalIngresos)}</p>
          </div>
        </div>

        {/* Year-by-year projection table */}
        <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> FLUJO DE CAJA PROYECTADO POR ANO</h3>
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-[11px] print:text-[10px] border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-300 print:border-b-black bg-stone-100">
                <th className="text-left py-1 px-1">Ano</th>
                <th className="text-right py-1 px-1">Ingresos</th>
                <th className="text-right py-1 px-1">Gastos</th>
                <th className="text-right py-1 px-1">Utilidad</th>
                <th className="text-right py-1 px-1">Impuesto 27%</th>
                <th className="text-right py-1 px-1">Util. Neta</th>
                <th className="text-right py-1 px-1">Acumulada</th>
                <th className="text-right py-1 px-1">Margen</th>
              </tr>
            </thead>
            <tbody>
              {projection.map(y => (
                <tr key={y.year} className="border-b border-stone-100 print:border-b-stone-200 hover:bg-stone-50">
                  <td className="py-1 px-1 font-medium">{y.year}</td>
                  <td className="text-right text-green-700">{fmtRD(y.ingresos)}</td>
                  <td className="text-right text-red-600">{fmtRD(y.gastos)}</td>
                  <td className={`text-right font-medium ${y.utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(y.utilidad)}</td>
                  <td className="text-right text-orange-600">{fmtRD(y.impuesto)}</td>
                  <td className={`text-right font-medium ${y.utilidadNeta >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmtRD(y.utilidadNeta)}</td>
                  <td className={`text-right font-bold ${y.acumulada >= 0 ? 'text-green-800' : 'text-red-600'}`}>{fmtRD(y.acumulada)}</td>
                  <td className="text-right">{fmtPct(y.margen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Depreciation table */}
        <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><TrendingDown className="w-3 h-3" /> DEPRECIACION ACUMULADA (10 ANOS LINEAL)</h3>
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-[11px] print:text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200 print:border-b-black">
                <th className="text-left py-1 px-1">Ano</th>
                <th className="text-right py-1 px-1">Valor Inicial</th>
                <th className="text-right py-1 px-1">Depreciacion Anual</th>
                <th className="text-right py-1 px-1">Dep. Acumulada</th>
                <th className="text-right py-1 px-1">Valor Restante</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(projYears, 10) }, (_, i) => {
                const yr = i + 1
                const depAcc = depreciacionAnual * yr
                const remaining = Math.max(0, infraTotal - depAcc)
                return (
                  <tr key={yr} className="border-b border-stone-50 print:border-b-stone-200">
                    <td className="py-1 px-1 font-medium">{yr}</td>
                    <td className="text-right">{fmtRD(infraTotal)}</td>
                    <td className="text-right text-stone-500">{fmtRD(depreciacionAnual)}</td>
                    <td className="text-right">{fmtRD(depAcc)}</td>
                    <td className="text-right font-medium">{fmtRD(remaining)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Financial ratios */}
        <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Percent className="w-3 h-3" /> RATIO FINANCIERO POR ANO</h3>
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-[11px] print:text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200 print:border-b-black">
                <th className="text-left py-1 px-1">Ano</th>
                <th className="text-right py-1 px-1">Margen Utilidad</th>
                <th className="text-right py-1 px-1">Ratio Gastos/Ingreso</th>
                <th className="text-right py-1 px-1">Impuesto Est.</th>
                <th className="text-right py-1 px-1">Util. Despues Imp.</th>
              </tr>
            </thead>
            <tbody>
              {projection.map(y => (
                <tr key={y.year} className="border-b border-stone-50 print:border-b-stone-200">
                  <td className="py-1 px-1 font-medium">{y.year}</td>
                  <td className={`text-right font-medium ${y.margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtPct(y.margen)}</td>
                  <td className="text-right">{fmtPct(y.ratioGastos * 100)}</td>
                  <td className="text-right text-orange-600">{fmtRD(y.impuesto)}</td>
                  <td className={`text-right font-medium ${y.utilidadNeta >= 0 ? 'text-green-800' : 'text-red-700'}`}>{fmtRD(y.utilidadNeta)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== EXISTING MONTHLY INCOME STATEMENT ===== */}
      <Separator className="my-2" />
      <h2 className="text-sm font-bold text-stone-800 print:text-sm flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-stone-500" /> ESTADO DE RESULTADOS DEL MES
      </h2>
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
            <td className="text-right">{c.totalExpenses > 0 ? fmtPct(c.totalEggRevenue / (c.totalEggRevenue + c.totalExpenses) * 100) : '-'}</td>
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

      {/* Structural expenses detail */}
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

      {/* Simplified balance */}
      <h3 className="text-xs font-bold text-stone-700 mt-4 print:mt-3 print:text-xs">BALANCE SIMPLIFICADO</h3>
      <div className="grid grid-cols-2 gap-4 text-xs print:text-xs">
        <div className="space-y-1 border p-3 rounded print:p-2">
          <p className="font-bold text-green-700 mb-1">ACTIVOS</p>
          <div className="flex justify-between"><span>Infraestructura (galpones)</span><span>{fmtRD(infraTotal)}</span></div>
          <div className="flex justify-between"><span>Aves en inventario</span><span>{fmtRD(c.totalHens * config.chickPrice)}</span></div>
          <div className="flex justify-between"><span>Inventario de alimento (est.)</span><span>Ver inventario</span></div>
        </div>
        <div className="space-y-1 border p-3 rounded print:p-2">
          <p className="font-bold text-red-700 mb-1">PASIVOS + CAPITAL</p>
          <div className="flex justify-between"><span>Prestamos bancarios</span><span>Pendiente</span></div>
          <div className="flex justify-between"><span>Cuentas por pagar</span><span>Pendiente</span></div>
          <div className="flex justify-between font-bold"><span>Capital propio (est.)</span><span>{fmtRD(infraTotal)}</span></div>
        </div>
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para el contable:</strong> Este es un resumen generado automaticamente. Los gastos estructurales estan prorrateados mensualmente.
        Verificar con facturas y comprobantes fiscales. La depreciacion es estimada a 10 anos lineal. El impuesto estimado es 27% (ISR RD).
        Se recomienda llevar libro diario auxiliar por galpon. Las proyecciones incluyen inflacion configurable.
      </div>
    </div>
  )
}

// ================================================================
// 2. REPORTE PARA EL INGENIERO — ENHANCED WITH MORE UTILITIES
// ================================================================
function ReportIngeniero({ config, structuralExpenses, batches, calculations }: { config: ReportConfig; structuralExpenses: StructuralExpense[]; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const infraTotal = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const maintenanceItems = structuralExpenses.filter(e => e.isActive && (e.description.toLowerCase().includes('repar') || e.description.toLowerCase().includes('manten') || e.description.toLowerCase().includes('mejor') || e.description.toLowerCase().includes('equipo') || e.description.toLowerCase().includes('cerc') || e.description.toLowerCase().includes('tech') || e.description.toLowerCase().includes('electr') || e.description.toLowerCase().includes('plomer')))
  const biosegItems = structuralExpenses.filter(e => e.isActive && (e.description.toLowerCase().includes('desinf') || e.description.toLowerCase().includes('bioseg') || e.description.toLowerCase().includes('pediluv')))

  // Resource consumption per shed
  const shedResources = useMemo(() => {
    return batches.map(b => {
      const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
      const feedGDay = feed?.consumption || 0
      const feedKgMonth = Math.round(b.hens * feedGDay * 30 / 1000)
      const waterLDay = Math.round(b.hens * 0.25)
      const waterLMonth = waterLDay * 30
      const energyKWh = Math.round(b.hens * 0.003 * 30 * 16) // 0.003 kWh/bird/day, 16h light
      return { name: b.name, hens: b.hens, feedKgMonth, waterLDay, waterLMonth, energyKWh, feedGDay }
    })
  }, [batches, config.feedPhases])

  const totalFeedMonth = shedResources.reduce((s, r) => s + r.feedKgMonth, 0)
  const totalWaterMonth = shedResources.reduce((s, r) => s + r.waterLMonth, 0)
  const totalEnergyKWh = shedResources.reduce((s, r) => s + r.energyKWh, 0)

  // Preventive maintenance calendar
  const maintenanceCalendar = [
    { freq: 'Diario', tasks: ['Verificar agua y feed en todos los galpones', 'Revision visual rapida de aves', 'Verificar temperatura y ventilacion'], color: 'bg-red-50 border-red-200' },
    { freq: 'Semanal', tasks: ['Limpieza profunda de bebederos', 'Verificar sistema de ventilacion', 'Revision de comederos y ajuste de altura'], color: 'bg-orange-50 border-orange-200' },
    { freq: 'Quincenal', tasks: ['Control de roedores e insectos', 'Revision del cercado perimetral', 'Limpieza de canaletas de huevos'], color: 'bg-amber-50 border-amber-200' },
    { freq: 'Mensual', tasks: ['Limpieza general del galpon', 'Revision del sistema electrico', 'Calibracion de bebederos/comederos', 'Verificacion de stock de alimento'], color: 'bg-yellow-50 border-yellow-200' },
    { freq: 'Trimestral', tasks: ['Mantenimiento preventivo bebederos', 'Mantenimiento preventivo comederos', 'Revision de sistema de iluminacion'], color: 'bg-lime-50 border-lime-200' },
    { freq: 'Semestral', tasks: ['Revision techado y estructura', 'Revision de cercas y portones', 'Evaluacion general de infraestructura'], color: 'bg-green-50 border-green-200' },
  ]

  // Risk matrix
  const riskMatrix = [
    { risk: 'Incendio', prob: 'Baja', impact: 'Critico', mitigation: 'Extintores, plan de emergencia, area libre de materiales inflamables', color: 'bg-yellow-50' },
    { risk: 'Inundacion', prob: 'Media', impact: 'Alto', mitigation: 'Drenaje adecuado, elevacion de galpones, canales de desague', color: 'bg-orange-50' },
    { risk: 'Vientos fuertes/huracanes', prob: 'Media', impact: 'Alto', mitigation: 'Estructura reforzada, anclaje de techos, seguro', color: 'bg-orange-50' },
    { risk: 'Corte electrico prolongado', prob: 'Media', impact: 'Alto', mitigation: 'Planta electrica/generador, paneles solares, UPS', color: 'bg-orange-50' },
    { risk: 'Brote enfermadad', prob: 'Baja', impact: 'Critico', mitigation: 'Bioseguridad estricta, cuarentena, pediluvios, desinfeccion', color: 'bg-red-50' },
    { risk: 'Robo/hurtos', prob: 'Media', impact: 'Medio', mitigation: 'Cercado, alumbrado, vigilancia, seguro', color: 'bg-yellow-50' },
  ]

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">ESTADO DE INFRAESTRUCTURA Y MANTENIMIENTO</h2>

      {/* KPI Cards */}
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

      {/* Resource consumption per shed */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><Beaker className="w-3 h-3" /> CONSUMO DE RECURSOS POR GALPON</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs print:text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 px-1">Galpon</th>
              <th className="text-right py-1 px-1">Aves</th>
              <th className="text-right py-1 px-1">Feed (kg/mes)</th>
              <th className="text-right py-1 px-1">Agua (L/dia)</th>
              <th className="text-right py-1 px-1">Agua (L/mes)</th>
              <th className="text-right py-1 px-1">Energia (kWh/mes)</th>
            </tr>
          </thead>
          <tbody>
            {shedResources.map(r => (
              <tr key={r.name} className="border-b border-stone-100 print:border-b-stone-200">
                <td className="py-1 px-1 font-medium">{r.name}</td>
                <td className="text-right">{fmtNum(r.hens)}</td>
                <td className="text-right">{fmtNum(r.feedKgMonth)}</td>
                <td className="text-right">{fmtNum(r.waterLDay)}</td>
                <td className="text-right">{fmtNum(r.waterLMonth)}</td>
                <td className="text-right">{fmtNum(r.energyKWh)}</td>
              </tr>
            ))}
            <tr className="font-bold border-t-2 border-stone-300 print:border-t-black bg-stone-50 print:bg-gray-100">
              <td className="py-1 px-1">TOTAL</td>
              <td className="text-right">{fmtNum(calculations.totalHens)}</td>
              <td className="text-right">{fmtNum(totalFeedMonth)}</td>
              <td className="text-right">{fmtNum(Math.round(totalWaterMonth / 30))}</td>
              <td className="text-right">{fmtNum(totalWaterMonth)}</td>
              <td className="text-right">{fmtNum(totalEnergyKWh)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Storage capacity */}
      <h3 className="text-xs font-bold text-stone-700 mt-2 print:mt-2 print:text-xs flex items-center gap-1"><Scale className="w-3 h-3" /> CAPACIDAD DE ALMACENAMIENTO RECOMENDADA</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 print:grid-cols-3">
        <div className="border p-2.5 rounded text-xs print:p-2">
          <p className="text-[10px] text-stone-500">Feed requerido/mes</p>
          <p className="text-base font-bold">{fmtNum(totalFeedMonth)} kg</p>
        </div>
        <div className="border p-2.5 rounded text-xs print:p-2">
          <p className="text-[10px] text-stone-500">Silo recomendado (1.5x)</p>
          <p className="text-base font-bold">{fmtNum(Math.round(totalFeedMonth * 1.5))} kg</p>
        </div>
        <div className="border p-2.5 rounded text-xs print:p-2">
          <p className="text-[10px] text-stone-500">Tanque agua (2 dias reserva)</p>
          <p className="text-base font-bold">{fmtNum(Math.round(totalWaterMonth / 30 * 2))} L</p>
        </div>
      </div>

      {/* Shed status table (existing) */}
      <h3 className="text-xs font-bold text-stone-700 mt-2 print:mt-2 print:text-xs">ESTADO POR GALPON</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 print:py-0.5">Galpon</th>
            <th className="text-right py-1 print:py-0.5">Aves</th>
            <th className="text-center py-1 print:py-0.5">Fase</th>
            <th className="text-center py-1 print:py-0.5">Mes Ciclo</th>
            <th className="text-right py-1 print:py-0.5">Feed (g/dia)</th>
            <th className="text-right py-1 print:py-0.5">Agua (L/dia)</th>
            <th className="text-right py-1 print:py-0.5">Ventilacion</th>
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

      {/* Preventive maintenance calendar */}
      <h3 className="text-xs font-bold text-stone-700 mt-2 print:mt-2 print:text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> CALENDARIO DE MANTENIMIENTO PREVENTIVO</h3>
      <div className="space-y-1.5">
        {maintenanceCalendar.map(m => (
          <div key={m.freq} className={`border rounded p-2 ${m.color}`}>
            <p className="text-[11px] font-bold text-stone-700 mb-1">{m.freq}</p>
            <div className="flex flex-wrap gap-1">
              {m.tasks.map((t, i) => (
                <span key={i} className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded border print:text-[9px]">{t}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Maintenance items registered */}
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

      {/* Biosecurity */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> BIOSEGURIDAD</h3>
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

      {/* Risk matrix */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> MATRIZ DE RIESGO POR INFRAESTRUCTURA</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 px-1">Riesgo</th>
              <th className="text-center py-1 px-1">Probabilidad</th>
              <th className="text-center py-1 px-1">Impacto</th>
              <th className="text-left py-1 px-1">Mitigacion</th>
            </tr>
          </thead>
          <tbody>
            {riskMatrix.map(r => (
              <tr key={r.risk} className={`border-b border-stone-100 print:border-b-stone-200 ${r.color}`}>
                <td className="py-1 px-1 font-medium">{r.risk}</td>
                <td className="text-center"><Badge variant="outline" className="text-[10px]">{r.prob}</Badge></td>
                <td className="text-center"><Badge variant="outline" className="text-[10px]">{r.impact}</Badge></td>
                <td className="py-1 px-1 text-stone-600">{r.mitigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Energy requirements */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Zap className="w-3 h-3" /> REQUISITOS DE ENERGIA</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:grid-cols-4 text-xs print:text-xs">
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Consumo mensual est.</p>
          <p className="text-base font-bold">{fmtNum(totalEnergyKWh)} kWh</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Costo electrico/mes (est.)</p>
          <p className="text-base font-bold">{fmtRD(totalEnergyKWh * 15)}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Generador recomendado</p>
          <p className="text-base font-bold">{fmtNum(Math.round(totalEnergyKWh / 30 / 24 * 2))} kW</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Paneles solares sug.</p>
          <p className="text-base font-bold">{fmtNum(Math.round(totalEnergyKWh * 1.25 / 150))} paneles</p>
        </div>
      </div>

      {/* Checklist */}
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
        El consumo electrico estimado es basado en iluminacion 16h/dia y ventiladores. Considerar generador de respaldo y sistema solar para reducir costos.
      </div>
    </div>
  )
}

// ================================================================
// 3. REPORTE PARA EL VETERINARIO — ENHANCED WITH ALERT DASHBOARD
// ================================================================
function ReportVeterinario({ batches, config, calculations }: { batches: ReportBatch[]; config: ReportConfig; calculations: ReportCalculations }) {
  // Early warning alert thresholds
  const alertThresholds = [
    { indicator: 'Mortalidad diaria', normal: '< 0.5%', warning: '0.5-1%', critical: '> 1%', icon: <HeartPulse className="w-3 h-3" />, color: 'bg-red-50 border-red-200' },
    { indicator: 'Consumo agua/ave/dia', normal: '250 ml', warning: '200-250 ml', critical: '< 180 ml', icon: <Droplets className="w-3 h-3" />, color: 'bg-blue-50 border-blue-200' },
    { indicator: 'Conversion feed (kg/kg)', normal: '2.1-2.3', warning: '2.3-2.5', critical: '> 2.5', icon: <Beaker className="w-3 h-3" />, color: 'bg-amber-50 border-amber-200' },
    { indicator: 'Temperatura confort', normal: '18-25C', warning: '25-28C', critical: '> 32C', icon: <ThermometerSun className="w-3 h-3" />, color: 'bg-orange-50 border-orange-200' },
    { indicator: '% Postura', normal: '> 80%', warning: '70-80%', critical: '< 65%', icon: <PieChart className="w-3 h-3" />, color: 'bg-green-50 border-green-200' },
    { indicator: 'Peso corporal (g)', normal: '1,800-2,100', warning: '1,600-1,800', critical: '< 1,500', icon: <Scale className="w-3 h-3" />, color: 'bg-violet-50 border-violet-200' },
  ]

  // Monthly sanitary calendar
  const sanitaryCalendar = [
    { week: 'Semana 1', activities: ['Evaluacion general del lote', 'Peso corporal (muestreo 5%)', 'Revision de bebederos y comederos', 'Verificacion temperatura'], color: 'bg-green-50 border-green-200' },
    { week: 'Semana 2', activities: ['Calidad del huevo (cascara, yema, clara)', 'Consumo feed vs esperado', 'Revision iluminacion', 'Control de moscas'], color: 'bg-blue-50 border-blue-200' },
    { week: 'Semana 3', activities: ['Control parasitario (desparasitante)', 'Analisis agua (cloro, pH)', 'Verificacion bioseguridad', 'Revision pediluvios'], color: 'bg-amber-50 border-amber-200' },
    { week: 'Semana 4', activities: ['Revision bioseguridad general', 'Reporte mensual de produccion', 'Plan del proximo mes', 'Muestreo sanguineo (si aplica)'], color: 'bg-violet-50 border-violet-200' },
  ]

  // Sanitary cost per batch
  const sanitaryCost = useMemo(() => {
    const vaccines = config.vaccinesCostPerBird * config.hensPerBatch
    const deworming = 15 * config.hensPerBatch // RD$15/ave estimate
    const biosecurity = 8 * config.hensPerBatch // RD$8/ave estimate
    const vetVisits = 5000 // 2 visits/month x RD$2,500
    const totalPerBatch = vaccines + deworming + biosecurity + vetVisits
    const perBird = totalPerBatch / config.hensPerBatch
    return { vaccines, deworming, biosecurity, vetVisits, totalPerBatch, perBird }
  }, [config.vaccinesCostPerBird, config.hensPerBatch])

  // Production alerts table
  const productionAlerts = [
    { cause: 'Estres caloric', symptom: 'Baja postura, consumo agua alto', action: 'Mejorar ventilacion, nebulizar, sombra' },
    { cause: 'Alimentacion deficiente', symptom: 'Baja conversion, peso bajo', action: 'Verificar formula feed, calidad agua' },
    { cause: 'Enfermedad respiratoria', symptom: 'Tos, estertores, baja postura', action: 'Aislamiento, diagnostico lab, tratamiento' },
    { cause: 'Temperatura extrema', symptom: 'Disminucion consumo, agrupamiento', action: 'Ajustar ventilacion/calentadores' },
    { cause: 'Iluminacion inadecuada', symptom: 'Postura irregular, picaje', action: 'Verificar 16h luz/dia, intensidad adecuada' },
    { cause: 'Agua insuficiente', symptom: 'Baja produccion, mortalidad', action: 'Limpiar bebederos, verificar presion' },
    { cause: 'Parasitos internos', symptom: 'Diarrea, plumas opacas, baja peso', action: 'Desparasitacion, analisis heces' },
  ]

  // WD80 reference consumption by age weeks
  const wd80ConsumptionCurve = [
    { ageWeeks: '1-2', consumption: 12, phase: 'Pre-Inicio', weight: 120 },
    { ageWeeks: '3-4', consumption: 28, phase: 'Inicio', weight: 280 },
    { ageWeeks: '5-8', consumption: 42, phase: 'Crecimiento', weight: 620 },
    { ageWeeks: '9-12', consumption: 58, phase: 'Crecimiento', weight: 1050 },
    { ageWeeks: '13-15', consumption: 75, phase: 'Pre-Postura', weight: 1450 },
    { ageWeeks: '16-18', consumption: 95, phase: 'Pre-Postura', weight: 1750 },
    { ageWeeks: '19-22', consumption: 110, phase: 'Postura', weight: 1950 },
    { ageWeeks: '23-30', consumption: 115, phase: 'Postura Pico', weight: 2050 },
    { ageWeeks: '31-45', consumption: 118, phase: 'Postura Sostenida', weight: 2100 },
    { ageWeeks: '46-52', consumption: 120, phase: 'Postura Final', weight: 2150 },
    { ageWeeks: '53-60', consumption: 118, phase: 'Postura Final', weight: 2150 },
    { ageWeeks: '61-72', consumption: 115, phase: 'Postura Final', weight: 2100 },
    { ageWeeks: '73-80', consumption: 110, phase: 'Postura Final', weight: 2050 },
  ]

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">ESTADO SANITARIO Y PRODUCCION</h2>

      {/* KPI Cards */}
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

      {/* Early Warning Dashboard */}
      <div className="border border-dashed border-sky-300 bg-sky-50/40 p-3 rounded-lg print:border-sky-400">
        <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> INDICADORES DE ALERTA TEMPRANA</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 mt-2">
          {alertThresholds.map(a => (
            <div key={a.indicator} className={`border rounded p-2 ${a.color}`}>
              <div className="flex items-center gap-1 mb-1">
                {a.icon}
                <span className="text-[11px] font-bold text-stone-700">{a.indicator}</span>
              </div>
              <div className="flex flex-wrap gap-1 text-[9px]">
                <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Normal: {a.normal}</span>
                <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Alerta: {a.warning}</span>
                <span className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded">Critico: {a.critical}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch status table */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs">ESTADO POR LOTE</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs print:text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-left py-1 px-1">Lote</th>
              <th className="text-center py-1 px-1">Poblacion</th>
              <th className="text-center py-1 px-1">Fase</th>
              <th className="text-center py-1 px-1">Edad</th>
              <th className="text-center py-1 px-1">% Postura</th>
              <th className="text-right py-1 px-1">Feed (g/dia)</th>
              <th className="text-right py-1 px-1">Agua (L/dia)</th>
              <th className="text-right py-1 px-1">Huevos/dia</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => {
              const feed = config.feedPhases[b.phase as keyof typeof config.feedPhases]
              const ageWeeks = Math.round(b.cycleMonth * 4.33)
              const expectedEggs = b.isLaying ? Math.round(b.hens * (b.layingRate / 100)) : 0
              return (
                <tr key={b.id} className="border-b border-stone-50 print:border-b-stone-200">
                  <td className="py-1.5 px-1 font-medium">{b.name}</td>
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
      </div>

      {/* Vaccination plan (existing) */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Syringe className="w-3 h-3" /> PLAN VACUNAL WD80 (REFERENCIA)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs print:text-xs border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-left py-1 px-1">Vacuna</th>
              <th className="text-center py-1 px-1">Edad Aplicacion</th>
              <th className="text-center py-1 px-1">Refuerzo</th>
              <th className="text-center py-1 px-1">Via</th>
              <th className="text-right py-1 px-1">Costo Est./ave</th>
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
                <td className="py-1 px-1 font-medium">{vac.name}</td>
                <td className="text-center">{vac.age}</td>
                <td className="text-center">{vac.ref}</td>
                <td className="text-center">{vac.via}</td>
                <td className="text-right">{vac.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Monthly sanitary calendar */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> CALENDARIO SANITARIO MENSUAL</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {sanitaryCalendar.map(s => (
          <div key={s.week} className={`border rounded p-2 ${s.color}`}>
            <p className="text-[11px] font-bold text-stone-700 mb-1">{s.week}</p>
            <ul className="text-[10px] space-y-0.5">
              {s.activities.map((a, i) => (
                <li key={i} className="flex items-start gap-1">
                  <ArrowRight className="w-2.5 h-2.5 mt-0.5 flex-shrink-0 text-stone-400" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Sanitary cost per batch */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Pill className="w-3 h-3" /> COSTEO SANITARIO POR LOTE</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 px-1">Concepto</th>
            <th className="text-right py-1 px-1">Costo/ave</th>
            <th className="text-right py-1 px-1">Total ({fmtNum(config.hensPerBatch)} aves)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Vacunas (plan completo)</td>
            <td className="text-right">{fmtRD(config.vaccinesCostPerBird)}</td>
            <td className="text-right">{fmtRD(sanitaryCost.vaccines)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Desparasitacion (est. anual)</td>
            <td className="text-right">{fmtRD(15)}</td>
            <td className="text-right">{fmtRD(sanitaryCost.deworming)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Productos bioseguridad</td>
            <td className="text-right">{fmtRD(8)}</td>
            <td className="text-right">{fmtRD(sanitaryCost.biosecurity)}</td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Visitas veterinarias (est. mensual)</td>
            <td className="text-right">{fmtRD(sanitaryCost.vetVisits / config.hensPerBatch)}</td>
            <td className="text-right">{fmtRD(sanitaryCost.vetVisits)}</td>
          </tr>
          <tr className="font-bold border-t-2 border-stone-300 print:border-t-black bg-stone-50 print:bg-gray-100">
            <td className="py-1 px-1">TOTAL SANITARIO</td>
            <td className="text-right">{fmtRD(sanitaryCost.perBird)}</td>
            <td className="text-right">{fmtRD(sanitaryCost.totalPerBatch)}</td>
          </tr>
        </tbody>
      </table>

      {/* Production alerts table */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Stethoscope className="w-3 h-3" /> TABLA DE ALERTAS DE PRODUCCION</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 px-1">Causa Posible</th>
              <th className="text-left py-1 px-1">Sintoma</th>
              <th className="text-left py-1 px-1">Accion Recomendada</th>
            </tr>
          </thead>
          <tbody>
            {productionAlerts.map(p => (
              <tr key={p.cause} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1 px-1 font-medium">{p.cause}</td>
                <td className="py-1 px-1 text-stone-600">{p.symptom}</td>
                <td className="py-1 px-1 text-green-700">{p.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* WD80 Reference consumption curve */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Eye className="w-3 h-3" /> REGISTRO DE CONSUMO RECOMENDADO WD80</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-left py-1 px-1">Edad (semanas)</th>
              <th className="text-right py-1 px-1">Consumo (g/dia)</th>
              <th className="text-center py-1 px-1">Fase</th>
              <th className="text-right py-1 px-1">Peso Corporal (g)</th>
            </tr>
          </thead>
          <tbody>
            {wd80ConsumptionCurve.map(r => (
              <tr key={r.ageWeeks} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1 px-1 font-medium">{r.ageWeeks}</td>
                <td className="text-right">{r.consumption}g</td>
                <td className="text-center">{r.phase}</td>
                <td className="text-right">{fmtNum(r.weight)}g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversion indicators (existing) */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><CalcIcon className="w-3 h-3" /> INDICADORES DE CONVERSION</h3>
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
        Seguir calendario sanitario mensual estrictamente. Costo sanitario total por lote: {fmtRD(sanitaryCost.totalPerBatch)} ({fmtRD(sanitaryCost.perBird)}/ave).
      </div>
    </div>
  )
}

// ================================================================
// 4. REPORTE PARA LOS SOCIOS — ENHANCED WITH SCENARIOS & VALUATION
// ================================================================
function ReportSocios({ c, config, batches, calculations }: { c: ReportCalculations; config: ReportConfig; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const infraTotal = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const totalInvestment = infraTotal + batches.length * calculations.newBatchInvestmentWithMortality
  const monthlyROI = totalInvestment > 0 ? (c.netProfit / totalInvestment * 100) : 0
  const annualROI = monthlyROI * 12
  const paybackMonths = c.netProfit > 0 ? Math.ceil(totalInvestment / c.netProfit) : 999

  // Partner distribution
  const [numPartners, setNumPartners] = useState(2)

  // 5-year growth projection
  const growthProjection = useMemo(() => {
    const years: { year: number; ingresos: number; gastos: number; utilidad: number; acumulada: number; reinversion: number; patrimonio: number }[] = []
    let accum = 0
    let patrimonio = totalInvestment
    for (let y = 1; y <= 5; y++) {
      const factor = 1 + (Math.random() * 0.04 - 0.01) // slight variation
      const ingresos = Math.round(c.totalEggRevenue * 12 * factor)
      const gastos = Math.round(c.totalExpenses * 12 * factor)
      const utilidad = ingresos - gastos
      accum += utilidad
      const reinversion = Math.round(utilidad * 0.15) // 15% reinvestment
      patrimonio = patrimonio + utilidad - reinversion
      years.push({ year: y, ingresos, gastos, utilidad, acumulada: Math.round(accum), reinversion, patrimonio: Math.round(patrimonio) })
    }
    return years
  }, [c.totalEggRevenue, c.totalExpenses, totalInvestment])

  // Scenarios comparison
  const scenarios = useMemo(() => {
    const build = (priceMult: number) => {
      const rev = c.totalEggRevenue * priceMult
      const utilidad = rev - c.totalExpenses
      const anual = utilidad * 12
      return { mult: priceMult, rev: Math.round(rev), gastos: c.totalExpenses, utilidad: Math.round(utilidad), anual: Math.round(anual), margin: rev > 0 ? (utilidad / rev * 100) : 0 }
    }
    return [
      { label: 'Pesimista', ...build(0.9), color: 'border-l-red-500 bg-red-50', textColor: 'text-red-700' },
      { label: 'Actual', ...build(1.0), color: 'border-l-green-500 bg-green-50', textColor: 'text-green-700' },
      { label: 'Optimista', ...build(1.1), color: 'border-l-violet-500 bg-violet-50', textColor: 'text-violet-700' },
    ]
  }, [c.totalEggRevenue, c.totalExpenses])

  // Business valuation
  const valuation = useMemo(() => {
    const annualNet = c.netProfit * 12
    const profitMultiplier = 5
    const profitValuation = annualNet * profitMultiplier
    const assetValuation = infraTotal + (calculations.totalHens * config.chickPrice) + (c.totalFeedCost * 2) // infra + birds + 2 months feed
    return { annualNet, profitMultiplier, profitValuation, assetValuation, avg: Math.round((profitValuation + assetValuation) / 2) }
  }, [c.netProfit, infraTotal, calculations.totalHens, config.chickPrice, c.totalFeedCost])

  // Simulated 12-month performance history
  const history = useMemo(() => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const seasonFactors = [0.96, 0.97, 1.0, 1.0, 1.01, 0.98, 0.97, 1.02, 1.03, 1.0, 0.98, 1.0]
    return months.map((m, i) => {
      const factor = seasonFactors[i]
      const rev = Math.round(c.totalEggRevenue * factor)
      const exp = Math.round(c.totalExpenses * (0.98 + factor * 0.02))
      return { month: m, ingresos: rev, gastos: exp, utilidad: rev - exp, margen: rev > 0 ? ((rev - exp) / rev * 100) : 0 }
    })
  }, [c.totalEggRevenue, c.totalExpenses])

  const monthlyPerPartner = numPartners > 0 ? c.netProfit / numPartners : 0
  const annualPerPartner = monthlyPerPartner * 12

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">RESUMEN EJECUTIVO PARA SOCIOS</h2>

      {/* Summary cards */}
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

      {/* Partner distribution */}
      <div className="border border-dashed border-violet-300 bg-violet-50/40 p-3 rounded-lg">
        <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><Users className="w-3 h-3" /> DISTRIBUCION DE UTILIDADES</h3>
        <div className="flex items-end gap-3 mt-2">
          <SmallInput label="Numero de socios" value={numPartners} onChange={v => setNumPartners(Math.max(1, Math.min(20, v)))} className="w-28" />
          <div className="flex gap-2 flex-1">
            <div className="border p-2.5 rounded text-xs flex-1 bg-white">
              <p className="text-[10px] text-stone-500">Por socio/mes</p>
              <p className="text-base font-bold text-green-700">{fmtRD(monthlyPerPartner)}</p>
            </div>
            <div className="border p-2.5 rounded text-xs flex-1 bg-white">
              <p className="text-[10px] text-stone-500">Por socio/ano</p>
              <p className="text-base font-bold text-green-700">{fmtRD(annualPerPartner)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario comparison */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> COMPARATIVA DE ESCENARIOS</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {scenarios.map(s => (
          <div key={s.label} className={`border-l-4 rounded p-2.5 text-xs ${s.color}`}>
            <p className="font-bold text-stone-700">{s.label} {s.mult < 1 ? '(-10%)' : s.mult > 1 ? '(+10%)' : ''}</p>
            <div className="space-y-0.5 mt-1">
              <div className="flex justify-between"><span className="text-stone-500">Ingreso/mes</span><span className={s.textColor}>{fmtRD(s.rev)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Utilidad/mes</span><span className={s.textColor}>{fmtRD(s.utilidad)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Utilidad/ano</span><span className="font-bold">{fmtRD(s.anual)}</span></div>
              <div className="flex justify-between"><span className="text-stone-500">Margen</span><span className="font-bold">{fmtPct(s.margin)}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Business valuation */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><HandCoins className="w-3 h-3" /> VALORACION DEL NEGOCIO</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="border p-3 rounded text-xs">
          <p className="text-[10px] text-stone-500">Metodo de Utilidad ({valuation.profitMultiplier}x ganancia anual)</p>
          <p className="text-base font-bold text-green-700">{fmtRD(valuation.profitValuation)}</p>
          <p className="text-[9px] text-stone-400">Utilidad anual: {fmtRD(valuation.annualNet)}</p>
        </div>
        <div className="border p-3 rounded text-xs">
          <p className="text-[10px] text-stone-500">Metodo de Activos</p>
          <p className="text-base font-bold text-amber-700">{fmtRD(valuation.assetValuation)}</p>
          <p className="text-[9px] text-stone-400">Infra + Aves + Feed</p>
        </div>
        <div className="border-l-4 border-l-green-500 bg-green-50 p-3 rounded text-xs">
          <p className="text-[10px] text-stone-500">Valoracion Promedio</p>
          <p className="text-lg font-bold text-green-800">{fmtRD(valuation.avg)}</p>
          <p className="text-[9px] text-stone-400">Referencia para negociacion</p>
        </div>
      </div>

      {/* Investment detail (existing) */}
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
            <td className="text-right font-medium">{fmtRD(infraTotal)}</td>
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

      {/* Monthly income statement (existing) */}
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

      {/* KPIs (existing) */}
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

      {/* 12-month performance history */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> HISTORIAL DE RENDIMIENTO (12 MESES SIMULADO)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-left py-1 px-1">Mes</th>
              <th className="text-right py-1 px-1">Ingresos</th>
              <th className="text-right py-1 px-1">Gastos</th>
              <th className="text-right py-1 px-1">Utilidad</th>
              <th className="text-right py-1 px-1">Margen</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h => (
              <tr key={h.month} className={`border-b border-stone-50 print:border-b-stone-200 ${h.utilidad >= 0 ? '' : 'bg-red-50'}`}>
                <td className="py-1 px-1 font-medium">{h.month}</td>
                <td className="text-right text-green-700">{fmtRD(h.ingresos)}</td>
                <td className="text-right text-red-600">{fmtRD(h.gastos)}</td>
                <td className={`text-right font-medium ${h.utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(h.utilidad)}</td>
                <td className="text-right">{fmtPct(h.margen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 5-year growth projection */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><TrendingUp className="w-3 h-3" /> PROYECCION A 5 ANOS DE CRECIMIENTO</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 px-1">Ano</th>
              <th className="text-right py-1 px-1">Ingresos</th>
              <th className="text-right py-1 px-1">Utilidad</th>
              <th className="text-right py-1 px-1">Acumulada</th>
              <th className="text-right py-1 px-1">Reinversion (15%)</th>
              <th className="text-right py-1 px-1">Patrimonio Neto</th>
            </tr>
          </thead>
          <tbody>
            {growthProjection.map(y => (
              <tr key={y.year} className="border-b border-stone-50 print:border-b-stone-200">
                <td className="py-1 px-1 font-medium">{y.year}</td>
                <td className="text-right text-green-700">{fmtRD(y.ingresos)}</td>
                <td className={`text-right font-medium ${y.utilidad >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(y.utilidad)}</td>
                <td className={`text-right font-bold ${y.acumulada >= 0 ? 'text-green-800' : 'text-red-600'}`}>{fmtRD(y.acumulada)}</td>
                <td className="text-right text-amber-600">{fmtRD(y.reinversion)}</td>
                <td className="text-right font-medium text-violet-700">{fmtRD(y.patrimonio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Annual projection (existing) */}
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
        Valoracion del negocio estimada en {fmtRD(valuation.avg)} usando promedio de metodos de utilidad y activos.
      </div>
    </div>
  )
}

// ================================================================
// 5. REPORTE PARA EL BANCO — ENHANCED WITH LOAN CALCULATOR
// ================================================================
function ReportBanco({ c, config, batches, calculations }: { c: ReportCalculations; config: ReportConfig; batches: ReportBatch[]; calculations: ReportCalculations }) {
  const infraTotal = config.shed1Cost + Math.max(0, batches.length - 1) * config.shedAdditionalCost
  const totalInvestment = infraTotal + batches.length * calculations.newBatchInvestmentWithMortality
  const annualNet = c.netProfit * 12
  const inventoryValue = calculations.totalHens * config.chickPrice + c.totalFeedCost * 2

  // Loan parameters
  const [loanAmount, setLoanAmount] = useState(totalInvestment)
  const [loanRate, setLoanRate] = useState(12)
  const [loanYears, setLoanYears] = useState(3)
  const [projYears, setProjYears] = useState(3)

  // Amortization schedule
  const amortization = useMemo(() => {
    const months = loanYears * 12
    const monthlyRate = loanRate / 100 / 12
    const payment = monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      : loanAmount / months

    const schedule: { month: number; payment: number; interest: number; principal: number; balance: number }[] = []
    let balance = loanAmount
    let totalInterest = 0
    for (let m = 1; m <= months; m++) {
      const interest = balance * monthlyRate
      const principal = payment - interest
      balance = Math.max(0, balance - principal)
      totalInterest += interest
      schedule.push({ month: m, payment: Math.round(payment), interest: Math.round(interest), principal: Math.round(principal), balance: Math.round(balance) })
    }
    return { schedule, monthlyPayment: Math.round(payment), totalInterest: Math.round(totalInterest), totalCost: Math.round(loanAmount + totalInterest) }
  }, [loanAmount, loanRate, loanYears])

  // Year-by-year projection
  const yearProjection = useMemo(() => {
    const seasonFactor = [0.98, 0.99, 1.0, 1.0, 0.99, 0.98, 1.01, 1.02, 1.0, 0.99, 0.98, 1.0]
    const years: { year: number; ingresos: number; gastos: number; neto: number; acumulado: number; cuotaAnual: number; flujoLibre: number }[] = []
    let accum = -totalInvestment
    for (let y = 1; y <= projYears; y++) {
      let yearRev = 0
      let yearExp = 0
      for (let m = 0; m < 12; m++) {
        const idx = ((y - 1) * 12 + m) % 12
        yearRev += Math.round(c.totalEggRevenue * seasonFactor[idx])
        yearExp += Math.round(c.totalExpenses * (0.99 + seasonFactor[idx] * 0.02))
      }
      const neto = yearRev - yearExp
      accum += neto
      const cuotaAnual = amortization.schedule.filter(s => s.month > (y - 1) * 12 && s.month <= y * 12).reduce((s, r) => s + r.payment, 0)
      years.push({ year: y, ingresos: yearRev, gastos: yearExp, neto, acumulado: Math.round(accum), cuotaAnual, flujoLibre: neto - cuotaAnual })
    }
    return years
  }, [projYears, c.totalEggRevenue, c.totalExpenses, totalInvestment, amortization.schedule])

  // Debt capacity
  const maxDebt = annualNet * 3
  const monthlyPaymentCapacity = c.netProfit * 0.4
  const dscr = amortization.monthlyPayment > 0 ? (annualNet / (amortization.monthlyPayment * 12)) : 0
  const debtEquityRatio = totalInvestment > 0 ? (loanAmount / (totalInvestment - loanAmount + 1)) : 0
  const ltvRatio = infraTotal > 0 ? (loanAmount / infraTotal * 100) : 0

  // Implicit rating
  const implicitRating = useMemo(() => {
    if (dscr >= 2.0) return { label: 'Excelente', color: 'bg-green-100 text-green-800' }
    if (dscr >= 1.5) return { label: 'Bueno', color: 'bg-lime-100 text-lime-800' }
    if (dscr >= 1.0) return { label: 'Aceptable', color: 'bg-amber-100 text-amber-800' }
    return { label: 'Riesgoso', color: 'bg-red-100 text-red-800' }
  }, [dscr])

  // Rate comparison
  const rateComparison = useMemo(() => {
    const months = loanYears * 12
    return [10, 12, 15, 18].map(rate => {
      const mr = rate / 100 / 12
      const pmt = mr > 0 ? (loanAmount * mr * Math.pow(1 + mr, months)) / (Math.pow(1 + mr, months) - 1) : loanAmount / months
      const totalInt = pmt * months - loanAmount
      return { rate, monthlyPayment: Math.round(pmt), totalInterest: Math.round(totalInt), totalCost: Math.round(loanAmount + totalInt) }
    })
  }, [loanAmount, loanYears])

  const breakEvenMonth = yearProjection.findIndex(y => y.acumulado >= 0)

  return (
    <div className="space-y-4 print:space-y-3">
      <h2 className="text-sm font-bold text-stone-800 print:text-sm">PROYECCION FINANCIERA Y SOLVENCIA</h2>

      {/* Project info (existing) */}
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

      {/* Investment summary (existing) */}
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
            <td className="text-right">{fmtRD(infraTotal)}</td>
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

      {/* Loan calculator */}
      <div className="border border-dashed border-stone-300 bg-stone-50/40 p-3 rounded-lg print:border-stone-400">
        <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><CalcIcon className="w-3 h-3" /> CALCULADORA DE PRESTAMO</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 mb-3">
          <SmallInput label="Monto del prestamo" value={loanAmount} onChange={setLoanAmount} suffix="RD$" />
          <SmallInput label="Tasa de interes anual" value={loanRate} onChange={setLoanRate} suffix="%" />
          <SmallInput label="Plazo" value={loanYears} onChange={v => setLoanYears(Math.max(1, Math.min(20, v)))} suffix="anos" />
          <SmallInput label="Proyeccion" value={projYears} onChange={v => setProjYears(Math.max(1, Math.min(10, v)))} suffix="anos" />
        </div>

        {/* Loan summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="border p-2.5 rounded text-xs bg-white">
            <p className="text-[10px] text-stone-500">Cuota mensual</p>
            <p className="text-base font-bold text-amber-700">{fmtRD(amortization.monthlyPayment)}</p>
          </div>
          <div className="border p-2.5 rounded text-xs bg-white">
            <p className="text-[10px] text-stone-500">Intereses totales</p>
            <p className="text-base font-bold text-red-600">{fmtRD(amortization.totalInterest)}</p>
          </div>
          <div className="border p-2.5 rounded text-xs bg-white">
            <p className="text-[10px] text-stone-500">Costo total prestamo</p>
            <p className="text-base font-bold">{fmtRD(amortization.totalCost)}</p>
          </div>
          <div className="border p-2.5 rounded text-xs bg-white">
            <p className="text-[10px] text-stone-500">Total cuotas</p>
            <p className="text-base font-bold">{loanYears * 12}</p>
          </div>
        </div>

        {/* Amortization schedule */}
        <h4 className="text-[11px] font-bold text-stone-600 print:text-[10px] mb-1">TABLA DE AMORTIZACION (primeras 12 cuotas)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] print:text-[10px] border-collapse">
            <thead>
              <tr className="border-b border-stone-200 print:border-b-black">
                <th className="text-right py-0.5 px-1">Cuota</th>
                <th className="text-right py-0.5 px-1">Pago</th>
                <th className="text-right py-0.5 px-1">Interes</th>
                <th className="text-right py-0.5 px-1">Capital</th>
                <th className="text-right py-0.5 px-1">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {amortization.schedule.slice(0, 12).map(s => (
                <tr key={s.month} className="border-b border-stone-50 print:border-b-stone-200">
                  <td className="text-right py-0.5 px-1">{s.month}</td>
                  <td className="text-right py-0.5 px-1">{fmtRD(s.payment)}</td>
                  <td className="text-right py-0.5 px-1 text-red-600">{fmtRD(s.interest)}</td>
                  <td className="text-right py-0.5 px-1 text-green-700">{fmtRD(s.principal)}</td>
                  <td className="text-right py-0.5 px-1 font-medium">{fmtRD(s.balance)}</td>
                </tr>
              ))}
              {loanYears * 12 > 12 && (
                <tr className="border-t border-stone-200 print:border-t-black font-bold bg-stone-50 print:bg-gray-100">
                  <td colSpan={4} className="py-0.5 px-1 text-right">... {loanYears * 12 - 12} cuotas mas (total {fmtRD(amortization.totalCost)})</td>
                  <td className="text-right py-0.5 px-1">{fmtRD(0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debt capacity */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><PiggyBank className="w-3 h-3" /> CAPACIDAD DE ENDEUDAMIENTO</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs print:text-xs">
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Deuda maxima recomendada (3x util.)</p>
          <p className="text-base font-bold text-amber-700">{fmtRD(maxDebt)}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Capacidad pago mensual (40%)</p>
          <p className="text-base font-bold text-green-700">{fmtRD(monthlyPaymentCapacity)}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Plazo maximo sugerido</p>
          <p className="text-base font-bold">{amortization.monthlyPayment <= monthlyPaymentCapacity ? loanYears + ' anos' : 'Reducir monto'}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Cuota/pago = {fmtPct(amortization.monthlyPayment > 0 && c.netProfit > 0 ? (amortization.monthlyPayment / c.netProfit * 100) : 0)} utilidad</p>
          <p className={`text-base font-bold ${amortization.monthlyPayment <= monthlyPaymentCapacity ? 'text-green-700' : 'text-red-600'}`}>
            {amortization.monthlyPayment <= monthlyPaymentCapacity ? 'Maneable' : 'Excede capacidad'}
          </p>
        </div>
      </div>

      {/* Bank indicators */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><Percent className="w-3 h-3" /> INDICADORES BANCARIOS</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs print:text-xs">
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">DSCR (Cobertura Servicio Deuda)</p>
          <p className={`text-base font-bold ${dscr >= 1.5 ? 'text-green-700' : dscr >= 1.0 ? 'text-amber-700' : 'text-red-600'}`}>{dscr.toFixed(2)}x</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Ratio Deuda/Capital</p>
          <p className="text-base font-bold">{debtEquityRatio.toFixed(2)}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">LTV (Prestamo/Valor Garantia)</p>
          <p className="text-base font-bold">{fmtPct(ltvRatio)}</p>
        </div>
        <div className="border p-2.5 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Rating Implicito</p>
          <Badge variant="outline" className={`text-xs ${implicitRating.color}`}>{implicitRating.label}</Badge>
        </div>
      </div>

      {/* Collateral */}
      <h3 className="text-xs font-bold text-stone-700 print:text-xs flex items-center gap-1"><Shield className="w-3 h-3" /> GARANTIAS DISPONIBLES</h3>
      <table className="w-full text-xs print:text-xs border-collapse">
        <thead>
          <tr className="border-b border-stone-200 print:border-b-black">
            <th className="text-left py-1 px-1">Garantia</th>
            <th className="text-right py-1 px-1">Valor Estimado</th>
            <th className="text-center py-1 px-1">Tipo</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Infraestructura (galpones)</td>
            <td className="text-right font-medium">{fmtRD(infraTotal)}</td>
            <td className="text-center"><Badge variant="outline" className="text-[10px]">Hipotecaria</Badge></td>
          </tr>
          <tr className="border-b border-stone-50 print:border-b-stone-200">
            <td className="py-1 px-1">Inventario (aves + alimento)</td>
            <td className="text-right">{fmtRD(inventoryValue)}</td>
            <td className="text-center"><Badge variant="outline" className="text-[10px]">Prenda</Badge></td>
          </tr>
          <tr className="font-bold border-t-2 border-stone-300 print:border-t-black bg-stone-50 print:bg-gray-100">
            <td className="py-1 px-1">TOTAL GARANTIAS</td>
            <td className="text-right">{fmtRD(infraTotal + inventoryValue)}</td>
            <td className="text-center">vs {fmtRD(loanAmount)} solicitado</td>
          </tr>
        </tbody>
      </table>

      {/* Rate comparison */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Scale className="w-3 h-3" /> COMPARATIVA DE TASAS DE INTERES</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b border-stone-200 print:border-b-black">
              <th className="text-center py-1 px-1">Tasa</th>
              <th className="text-right py-1 px-1">Cuota Mensual</th>
              <th className="text-right py-1 px-1">Interes Total</th>
              <th className="text-right py-1 px-1">Costo Total</th>
            </tr>
          </thead>
          <tbody>
            {rateComparison.map(r => (
              <tr key={r.rate} className={`border-b border-stone-50 print:border-b-stone-200 ${r.rate === loanRate ? 'bg-amber-50 font-bold' : ''}`}>
                <td className="text-center py-1 px-1">{r.rate}%</td>
                <td className="text-right py-1 px-1">{fmtRD(r.monthlyPayment)}</td>
                <td className="text-right py-1 px-1 text-red-600">{fmtRD(r.totalInterest)}</td>
                <td className="text-right py-1 px-1">{fmtRD(r.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Year-by-year projection */}
      <h3 className="text-xs font-bold text-stone-700 mt-3 print:mt-2 print:text-xs flex items-center gap-1"><Calendar className="w-3 h-3" /> PROYECCION DE FLUJO DE CAJA A {projYears} ANO{projYears > 1 ? 'S' : ''}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] print:text-[10px] border-collapse">
          <thead>
            <tr className="border-b-2 border-stone-300 print:border-b-black">
              <th className="text-left py-1 px-1">Ano</th>
              <th className="text-right py-1 px-1">Ingresos</th>
              <th className="text-right py-1 px-1">Gastos</th>
              <th className="text-right py-1 px-1">Neto Oper.</th>
              <th className="text-right py-1 px-1">Cuota Anual</th>
              <th className="text-right py-1 px-1">Flujo Libre</th>
              <th className="text-right py-1 px-1">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100 print:border-b-stone-300 bg-stone-50 print:bg-gray-100">
              <td className="py-1 px-1 font-medium">INVERSION INICIAL</td>
              <td colSpan={4}></td>
              <td className="text-right font-bold text-red-700">{fmtRD(-totalInvestment)}</td>
            </tr>
            {yearProjection.map(y => (
              <tr key={y.year} className={`border-b border-stone-50 print:border-b-stone-200 ${y.acumulado >= 0 ? 'bg-green-50 print:bg-white font-bold' : ''}`}>
                <td className="py-1 px-1 font-medium">{y.year}</td>
                <td className="text-right text-green-700">{fmtRD(y.ingresos)}</td>
                <td className="text-right text-red-600">{fmtRD(y.gastos)}</td>
                <td className={`text-right ${y.neto >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(y.neto)}</td>
                <td className="text-right text-amber-600">{y.cuotaAnual > 0 ? fmtRD(y.cuotaAnual) : '-'}</td>
                <td className={`text-right font-medium ${y.flujoLibre >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(y.flujoLibre)}</td>
                <td className={`text-right font-bold ${y.acumulado >= 0 ? 'text-green-800' : 'text-red-600'}`}>{fmtRD(y.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial indicators (existing) */}
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
          <p className="text-lg font-bold">{fmtRD(infraTotal)}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Relacion ingreso/inversion</p>
          <p className="text-lg font-bold">{((c.totalEggRevenue * 12) / totalInvestment).toFixed(2)}x</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Break-even estimado</p>
          <p className="text-lg font-bold">{breakEvenMonth >= 0 ? `Ano ${breakEvenMonth + 1}` : 'N/A'}</p>
        </div>
        <div className="border p-3 rounded print:p-2">
          <p className="text-[10px] text-stone-500">Rating implicito</p>
          <Badge variant="outline" className={`text-sm ${implicitRating.color}`}>{implicitRating.label}</Badge>
        </div>
      </div>

      <div className="mt-3 p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1 print:mt-2">
        <strong>Nota para el banco:</strong> Esta proyeccion se basa en precios y parametros actuales. La granja avicola WD80 tiene una demanda estable de huevos.
        La infraestructura (galpones) sirve como garantia real con valor de {fmtRD(infraTotal)}.
        DSCR actual: {dscr.toFixed(2)}x ({implicitRating.label}). Cuota mensual estimada: {fmtRD(amortization.monthlyPayment)} contra capacidad de pago de {fmtRD(monthlyPaymentCapacity)}.
        Se recomienda financiamiento con cuotas mensuales no mayores a 40% de la utilidad neta.
        Incluir seguro de aves e infraestructura como requisito del prestamo.
      </div>
    </div>
  )
}

// ================================================================
// MAIN REPORTS PANEL EXPORT
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
                <ReportHeader title={`Granja Gallinas WD80 - Reporte Contable`} subtitle="Estado de resultados, proyecciones e impuestos" icon={<DollarSign className="w-5 h-5 text-green-600 print:hidden" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Contable" subtitle="Estado de resultados, proyecciones e impuestos" icon={<DollarSign className="w-5 h-5 text-green-600" />} />
              </div>
              <ReportContable c={calculations} config={config} structuralExpenses={structuralExpenses} batches={batches} />
            </>
          )}

          {activeReport === 'ingeniero' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte de Mantenimiento" subtitle="Infraestructura, recursos, bioseguridad y riesgos" icon={<Building2 className="w-5 h-5 text-amber-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte de Mantenimiento" subtitle="Infraestructura, recursos, bioseguridad y riesgos" icon={<Building2 className="w-5 h-5 text-amber-600" />} />
              </div>
              <ReportIngeniero config={config} structuralExpenses={structuralExpenses} batches={batches} calculations={calculations} />
            </>
          )}

          {activeReport === 'veterinario' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Veterinario" subtitle="Estado sanitario, alertas tempranas y calendario sanitario" icon={<Heart className="w-5 h-5 text-sky-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte Veterinario" subtitle="Estado sanitario, alertas tempranas y calendario sanitario" icon={<Heart className="w-5 h-5 text-sky-600" />} />
              </div>
              <ReportVeterinario batches={batches} config={config} calculations={calculations} />
            </>
          )}

          {activeReport === 'socios' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte para Socios" subtitle="Resumen ejecutivo, escenarios, valoracion y proyeccion" icon={<Users className="w-5 h-5 text-violet-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Reporte para Socios" subtitle="Resumen ejecutivo, escenarios, valoracion y proyeccion" icon={<Users className="w-5 h-5 text-violet-600" />} />
              </div>
              <ReportSocios c={calculations} config={config} batches={batches} calculations={calculations} />
            </>
          )}

          {activeReport === 'banco' && (
            <>
              <div className="flex items-center justify-between print:hidden mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Proyeccion Financiera" subtitle="Financiamiento, amortizacion y solvencia bancaria" icon={<Landmark className="w-5 h-5 text-stone-600" />} />
                <PrintButton label="Imprimir Reporte" />
              </div>
              <div className="hidden print:block mb-4">
                <ReportHeader title="Granja Gallinas WD80 - Proyeccion Financiera" subtitle="Financiamiento, amortizacion y solvencia bancaria" icon={<Landmark className="w-5 h-5 text-stone-600" />} />
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
