'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Banknote, TrendingUp, TrendingDown, Plus, Trash2, Printer, ChevronLeft, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Wallet, Landmark, Hammer, Calendar,
  Filter, CheckCircle2, CircleDollarSign, FileSpreadsheet, ClipboardList, Sparkles,
} from 'lucide-react'

// ================================================================
// TYPES
// ================================================================
type CashFlowCategory =
  // Operativas - Ingresos
  | 'venta_huevos'
  | 'venta_aves'
  | 'venta_pollitos'
  | 'otros_ingresos_op'
  // Operativas - Egresos
  | 'alimento'
  | 'nomina'
  | 'servicios_publicos'
  | 'veterinaria'
  | 'transporte'
  | 'empaque'
  | 'mantenimiento'
  | 'limpieza'
  | 'gastos_admin'
  // Inversion
  | 'infraestructura'
  | 'equipos'
  | 'vehiculos'
  | 'otros_activos'
  // Financiamiento
  | 'prestamo_recibido'
  | 'pago_prestamo'
  | 'aporte_capital'
  | 'retiro_capital'

type ActivityType = 'operativa' | 'inversion' | 'financiamiento'
type EntryType = 'inflow' | 'outflow'

interface CashFlowEntry {
  id: string
  date: string
  category: CashFlowCategory
  description: string
  amount: number
  type: EntryType
  reference: string
  createdAt: string
}

// ================================================================
// CONSTANTS
// ================================================================
const STORAGE_KEY = 'granja-wd80-cash-flow'
const BALANCE_KEY = 'granja-wd80-cash-flow-balances'

const CATEGORIES: Record<CashFlowCategory, {
  label: string
  activity: ActivityType
  defaultType: EntryType
  icon: string
  group: string
}> = {
  // Operativas - Ingresos
  venta_huevos:        { label: 'Venta de Huevos',         activity: 'operativa',    defaultType: 'inflow',  icon: '🥚', group: 'Ingresos Operativos' },
  venta_aves:          { label: 'Venta de Aves',           activity: 'operativa',    defaultType: 'inflow',  icon: '🐔', group: 'Ingresos Operativos' },
  venta_pollitos:      { label: 'Venta de Pollitos',       activity: 'operativa',    defaultType: 'inflow',  icon: '🐣', group: 'Ingresos Operativos' },
  otros_ingresos_op:   { label: 'Otros Ingresos Op.',      activity: 'operativa',    defaultType: 'inflow',  icon: '💰', group: 'Ingresos Operativos' },
  // Operativas - Egresos
  alimento:            { label: 'Alimento Balanceado',     activity: 'operativa',    defaultType: 'outflow', icon: '🌾', group: 'Egresos Operativos' },
  nomina:              { label: 'Nomina / Salarios',       activity: 'operativa',    defaultType: 'outflow', icon: '👷', group: 'Egresos Operativos' },
  servicios_publicos:  { label: 'Servicios Publicos',      activity: 'operativa',    defaultType: 'outflow', icon: '💡', group: 'Egresos Operativos' },
  veterinaria:         { label: 'Insumos Veterinarios',    activity: 'operativa',    defaultType: 'outflow', icon: '💉', group: 'Egresos Operativos' },
  transporte:          { label: 'Transporte y Flete',      activity: 'operativa',    defaultType: 'outflow', icon: '🚛', group: 'Egresos Operativos' },
  empaque:             { label: 'Empaque y Embalaje',      activity: 'operativa',    defaultType: 'outflow', icon: '📦', group: 'Egresos Operativos' },
  mantenimiento:       { label: 'Mantenimiento y Repar.',  activity: 'operativa',    defaultType: 'outflow', icon: '🔧', group: 'Egresos Operativos' },
  limpieza:            { label: 'Limpieza y Desinfeccion',  activity: 'operativa',    defaultType: 'outflow', icon: '🧹', group: 'Egresos Operativos' },
  gastos_admin:        { label: 'Gastos Administrativos',  activity: 'operativa',    defaultType: 'outflow', icon: '📋', group: 'Egresos Operativos' },
  // Inversion
  infraestructura:     { label: 'Galpones / Infraestructura', activity: 'inversion', defaultType: 'outflow', icon: '🏗', group: 'Actividades de Inversion' },
  equipos:             { label: 'Equipos',                activity: 'inversion',    defaultType: 'outflow', icon: '⚙', group: 'Actividades de Inversion' },
  vehiculos:           { label: 'Vehiculos',              activity: 'inversion',    defaultType: 'outflow', icon: '🚗', group: 'Actividades de Inversion' },
  otros_activos:       { label: 'Otros Activos Fijos',    activity: 'inversion',    defaultType: 'outflow', icon: '📦', group: 'Actividades de Inversion' },
  // Financiamiento
  prestamo_recibido:   { label: 'Prestamos Recibidos',    activity: 'financiamiento', defaultType: 'inflow',  icon: '🏦', group: 'Actividades de Financiamiento' },
  pago_prestamo:       { label: 'Pagos de Prestamos',     activity: 'financiamiento', defaultType: 'outflow', icon: '🏦', group: 'Actividades de Financiamiento' },
  aporte_capital:      { label: 'Aportes de Capital',     activity: 'financiamiento', defaultType: 'inflow',  icon: '💼', group: 'Actividades de Financiamiento' },
  retiro_capital:      { label: 'Retiros de Capital',     activity: 'financiamiento', defaultType: 'outflow', icon: '💸', group: 'Actividades de Financiamiento' },
}

const ACTIVITY_META: Record<ActivityType, {
  label: string
  color: string
  bgColor: string
  icon: React.ReactNode
}> = {
  operativa:    { label: 'Actividades Operativas',    color: 'text-blue-700',     bgColor: 'bg-blue-50',     icon: <Wallet className="w-4 h-4" /> },
  inversion:    { label: 'Actividades de Inversion',   color: 'text-amber-700',    bgColor: 'bg-amber-50',    icon: <Hammer className="w-4 h-4" /> },
  financiamiento: { label: 'Actividades de Financiamiento', color: 'text-violet-700', bgColor: 'bg-violet-50', icon: <Landmark className="w-4 h-4" /> },
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

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

function getPreviousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  const prev = new Date(year, month - 2, 1)
  return getMonthKey(prev)
}

function generateId(): string {
  return `cf-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
}

// ================================================================
// COMPONENT
// ================================================================
interface CashFlowPanelProps {
  goBack: () => void
  config: { eggPrice: number; fixedCostsMonthly: number }
  calculations: {
    totalEggRevenue: number
    totalFeedCost: number
    totalExpenses: number
    netProfit: number
    structuralMonthlyTotal: number
  }
}

export default function CashFlowPanel({ goBack, config, calculations }: CashFlowPanelProps) {
  // ---- State ----
  const [entries, setEntries] = useState<CashFlowEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : []
      } catch { /* ignore */ }
    }
    return []
  })

  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(BALANCE_KEY)
        return saved ? JSON.parse(saved) : {}
      } catch { /* ignore */ }
    }
    return {}
  })

  const [selectedMonth, setSelectedMonth] = useState(() => getMonthKey(new Date()))
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditBalance, setShowEditBalance] = useState(false)
  const [editBalanceValue, setEditBalanceValue] = useState(0)
  const [expandedActivities, setExpandedActivities] = useState<Set<ActivityType>>(
    new Set(['operativa', 'inversion', 'financiamiento'])
  )
  const [filterActivity, setFilterActivity] = useState<ActivityType | 'all'>('all')

  // Form state
  const [formType, setFormType] = useState<EntryType>('inflow')
  const [formCategory, setFormCategory] = useState<CashFlowCategory>('venta_huevos')
  const [formDescription, setFormDescription] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formReference, setFormReference] = useState('')

  // ---- Persistence ----
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) }, [entries])
  useEffect(() => { localStorage.setItem(BALANCE_KEY, JSON.stringify(openingBalances)) }, [openingBalances])

  // ---- Handlers ----
  const resetForm = useCallback(() => {
    setFormType('inflow')
    setFormCategory('venta_huevos')
    setFormDescription('')
    setFormAmount('')
    setFormDate(new Date().toISOString().split('T')[0])
    setFormReference('')
  }, [])

  const handleTypeChange = useCallback((type: EntryType) => {
    setFormType(type)
    // Switch to a default category for the type
    if (type === 'inflow') setFormCategory('venta_huevos')
    else setFormCategory('alimento')
  }, [])

  const handleAddEntry = useCallback(() => {
    const amount = parseFloat(formAmount)
    if (!amount || amount <= 0 || !formDescription.trim()) return

    const entry: CashFlowEntry = {
      id: generateId(),
      date: formDate,
      category: formCategory,
      description: formDescription.trim(),
      amount: Math.round(amount * 100) / 100,
      type: formType,
      reference: formReference.trim(),
      createdAt: new Date().toISOString(),
    }

    setEntries(prev => [entry, ...prev])
    setShowAddDialog(false)
    resetForm()
  }, [formAmount, formCategory, formDate, formDescription, formType, formReference, resetForm])

  const handleDeleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [])

  const handleSaveBalance = useCallback(() => {
    setOpeningBalances(prev => ({ ...prev, [selectedMonth]: Math.round(editBalanceValue * 100) / 100 }))
    setShowEditBalance(false)
  }, [selectedMonth, editBalanceValue])

  // ---- Computed Values ----
  const monthEntries = useMemo(() => {
    return entries
      .filter(e => e.date.startsWith(selectedMonth))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  }, [entries, selectedMonth])

  const filteredEntries = useMemo(() => {
    if (filterActivity === 'all') return monthEntries
    return monthEntries.filter(e => CATEGORIES[e.category].activity === filterActivity)
  }, [monthEntries, filterActivity])

  // Cash flow grouped by activity
  const cashFlowByActivity = useMemo(() => {
    const result: Record<ActivityType, {
      inflows: { category: CashFlowCategory; label: string; total: number; count: number }[]
      outflows: { category: CashFlowCategory; label: string; total: number; count: number }[]
      netFlow: number
    }> = {
      operativa: { inflows: [], outflows: [], netFlow: 0 },
      inversion: { inflows: [], outflows: [], netFlow: 0 },
      financiamiento: { inflows: [], outflows: [], netFlow: 0 },
    }

    const categoryTotals: Record<string, { total: number; count: number }> = {}

    for (const entry of monthEntries) {
      const cat = CATEGORIES[entry.category]
      const key = `${entry.category}-${entry.type}`
      if (!categoryTotals[key]) categoryTotals[key] = { total: 0, count: 0 }
      categoryTotals[key].total += entry.amount
      categoryTotals[key].count++

      if (entry.type === 'inflow') result[cat.activity].netFlow += entry.amount
      else result[cat.activity].netFlow -= entry.amount
    }

    for (const [key, data] of Object.entries(categoryTotals)) {
      const [catStr, typeStr] = key.split('-')
      const cat = catStr as CashFlowCategory
      const catInfo = CATEGORIES[cat]
      const item = { category: cat, label: catInfo.label, total: Math.round(data.total * 100) / 100, count: data.count }
      if (typeStr === 'inflow') result[catInfo.activity].inflows.push(item)
      else result[catInfo.activity].outflows.push(item)
    }

    // Sort by total descending
    for (const activity of Object.values(result)) {
      activity.inflows.sort((a, b) => b.total - a.total)
      activity.outflows.sort((a, b) => b.total - a.total)
    }

    return result
  }, [monthEntries])

  const openingBalance = openingBalances[selectedMonth] ?? 0
  const totalNetFlow = cashFlowByActivity.operativa.netFlow + cashFlowByActivity.inversion.netFlow + cashFlowByActivity.financiamiento.netFlow
  const closingBalance = openingBalance + totalNetFlow

  const totalInflows = monthEntries.filter(e => e.type === 'inflow').reduce((s, e) => s + e.amount, 0)
  const totalOutflows = monthEntries.filter(e => e.type === 'outflow').reduce((s, e) => s + e.amount, 0)

  // Previous month comparison
  const prevMonth = getPreviousMonthKey(selectedMonth)
  const prevMonthEntries = entries.filter(e => e.date.startsWith(prevMonth))
  const prevNetFlow = prevMonthEntries.reduce((s, e) => s + (e.type === 'inflow' ? e.amount : -e.amount), 0)
  const cashFlowChange = prevNetFlow !== 0 ? ((totalNetFlow - prevNetFlow) / Math.abs(prevNetFlow)) * 100 : 0

  // Available months
  const availableMonths = useMemo(() => {
    const months = new Set(entries.map(e => e.date.substring(0, 7)))
    months.add(selectedMonth)
    months.add(getMonthKey(new Date()))
    return Array.from(months).sort().reverse()
  }, [entries, selectedMonth])

  // ---- Toggle activity expansion ----
  const toggleActivity = useCallback((activity: ActivityType) => {
    setExpandedActivities(prev => {
      const next = new Set(prev)
      if (next.has(activity)) next.delete(activity)
      else next.add(activity)
      return next
    })
  }, [])

  // Category options filtered by type
  const categoryOptions = useMemo(() => {
    return Object.entries(CATEGORIES)
      .filter(([_, info]) => info.defaultType === formType)
      .map(([key, info]) => ({ value: key, label: `${info.icon} ${info.label}`, group: info.group }))
  }, [formType])

  // ---- Quick Auto-fill Suggestion ----
  const [showAutoFillHint, setShowAutoFillHint] = useState(false)
  const handleAutoFillFromConfig = useCallback(() => {
    if (monthEntries.length > 0) return // Don't auto-fill if entries already exist
    const today = new Date().toISOString().split('T')[0]
    const newEntries: CashFlowEntry[] = [
      {
        id: generateId(), date: today, category: 'venta_huevos',
        description: 'Venta de huevos (estimado mensual)',
        amount: Math.round(calculations.totalEggRevenue),
        type: 'inflow', reference: 'auto', createdAt: new Date().toISOString(),
      },
      {
        id: generateId(), date: today, category: 'alimento',
        description: 'Alimento balanceado (estimado mensual)',
        amount: Math.round(calculations.totalFeedCost),
        type: 'outflow', reference: 'auto', createdAt: new Date().toISOString(),
      },
      {
        id: generateId(), date: today, category: 'nomina',
        description: 'Nomina y salarios (gastos fijos)',
        amount: Math.round(config.fixedCostsMonthly),
        type: 'outflow', reference: 'auto', createdAt: new Date().toISOString(),
      },
      {
        id: generateId(), date: today, category: 'mantenimiento',
        description: 'Gastos estructurales (estimado mensual)',
        amount: Math.round(calculations.structuralMonthlyTotal),
        type: 'outflow', reference: 'auto', createdAt: new Date().toISOString(),
      },
    ]
    setEntries(prev => [...newEntries, ...prev])
    setShowAutoFillHint(false)
  }, [monthEntries.length, calculations, config])

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            Estado de Flujo de Caja
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1 text-xs print:hidden" onClick={() => window.print()}>
            <Printer className="w-3 h-3" /> Imprimir
          </Button>
          <Button size="sm" className="gap-1 text-xs bg-green-600 hover:bg-green-700 text-white print:hidden"
            onClick={() => { resetForm(); setShowAddDialog(true) }}>
            <Plus className="w-3 h-3" /> Registro
          </Button>
        </div>
      </div>

      {/* Report Header (Print) */}
      <div className="print:mb-4 mb-2 pb-3 border-b-2 border-stone-300 print:border-b-black">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="Granja Nidal" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-base font-bold text-stone-900 print:text-base">Estado de Flujo de Caja</h1>
              <p className="text-xs text-stone-500 print:text-xs">Granja Nidal — {getMonthLabel(selectedMonth)}</p>
            </div>
          </div>
          <div className="text-right print:text-right">
            <p className="text-xs text-stone-500">{new Date().toLocaleDateString('es-DO', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p className="text-[10px] text-stone-400">Generado automaticamente</p>
          </div>
        </div>
      </div>

      {/* Period Selector + Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="h-8 text-xs rounded-md border border-input bg-background px-2"
          >
            {availableMonths.map(m => (
              <option key={m} value={m}>{getMonthLabel(m)}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          <div className="flex gap-1">
            {[
              { key: 'all' as const, label: 'Todos' },
              { key: 'operativa' as const, label: 'Operativas' },
              { key: 'inversion' as const, label: 'Inversion' },
              { key: 'financiamiento' as const, label: 'Financiamiento' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterActivity(f.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${
                  filterActivity === f.key
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-fill hint */}
      {monthEntries.length === 0 && (
        <div className="print:hidden">
          <button
            onClick={() => setShowAutoFillHint(!showAutoFillHint)}
            className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <div className="text-left">
                <p className="text-sm font-bold text-stone-800">Llenar con datos estimados</p>
                <p className="text-[11px] text-stone-500">Auto-completar con valores calculados del mes actual</p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${showAutoFillHint ? 'rotate-180' : ''}`} />
          </button>
          {showAutoFillHint && (
            <Card className="mt-2 border-amber-200">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-stone-600">Se agregaran los siguientes registros estimados del mes:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>+ Venta de huevos (estimado)</span><span className="text-green-700 font-medium">{fmtRD(calculations.totalEggRevenue)}</span></div>
                  <div className="flex justify-between"><span>- Alimento balanceado (estimado)</span><span className="text-red-600 font-medium">{fmtRD(calculations.totalFeedCost)}</span></div>
                  <div className="flex justify-between"><span>- Nomina y salarios (gastos fijos)</span><span className="text-red-600 font-medium">{fmtRD(config.fixedCostsMonthly)}</span></div>
                  <div className="flex justify-between"><span>- Gastos estructurales (estimado)</span><span className="text-red-600 font-medium">{fmtRD(calculations.structuralMonthlyTotal)}</span></div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={handleAutoFillFromConfig}>
                    <CheckCircle2 className="w-3 h-3" /> Aplicar
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowAutoFillHint(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="border-l-4 border-l-stone-400">
          <CardContent className="p-3">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo Inicial</p>
            <p className="text-base font-bold text-stone-700">{fmtRD(openingBalance)}</p>
            <button onClick={() => { setEditBalanceValue(openingBalance); setShowEditBalance(true) }}
              className="text-[10px] text-stone-400 hover:text-stone-600 underline print:hidden mt-0.5">
              Editar
            </button>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-green-500" /> Total Entradas</p>
            <p className="text-base font-bold text-green-700">{fmtRD(totalInflows)}</p>
            <p className="text-[10px] text-stone-400">{monthEntries.filter(e => e.type === 'inflow').length} registros</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-red-500" /> Total Salidas</p>
            <p className="text-base font-bold text-red-600">{fmtRD(totalOutflows)}</p>
            <p className="text-[10px] text-stone-400">{monthEntries.filter(e => e.type === 'outflow').length} registros</p>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${totalNetFlow >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="p-3">
            <p className="text-[10px] text-stone-500 flex items-center gap-1">
              {totalNetFlow >= 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> : <TrendingDown className="w-3 h-3 text-red-500" />}
              Flujo Neto
            </p>
            <p className={`text-base font-bold ${totalNetFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtRD(totalNetFlow)}</p>
            {prevNetFlow !== 0 && (
              <p className={`text-[10px] ${cashFlowChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {cashFlowChange >= 0 ? '+' : ''}{cashFlowChange.toFixed(1)}% vs mes anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${closingBalance >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}>
          <CardContent className="p-3">
            <p className="text-[10px] text-stone-500 flex items-center gap-1"><CircleDollarSign className="w-3 h-3 text-blue-500" /> Saldo Final</p>
            <p className={`text-base font-bold ${closingBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmtRD(closingBalance)}</p>
            <p className="text-[10px] text-stone-400">Inicial + Neto</p>
          </CardContent>
        </Card>
      </div>

      {/* ====================== CASH FLOW STATEMENT ====================== */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-stone-500" />
            ESTADO DE FLUJO DE CAJA
          </CardTitle>
          <CardDescription className="text-[11px]">
            Periodo: {getMonthLabel(selectedMonth)} | {monthEntries.length} transacciones registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-xs print:text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-300 print:border-b-black">
                <th className="text-left py-1.5 print:py-1">Concepto</th>
                <th className="text-right py-1.5 print:py-1" style={{ width: '30%' }}>Monto (RD$)</th>
              </tr>
            </thead>
            <tbody>
              {/* ---- OPERATIVAS ---- */}
              <StatementActivityRow
                activity="operativa"
                data={cashFlowByActivity.operativa}
                isExpanded={expandedActivities.has('operativa')}
                onToggle={() => toggleActivity('operativa')}
              />

              {/* ---- INVERSION ---- */}
              <StatementActivityRow
                activity="inversion"
                data={cashFlowByActivity.inversion}
                isExpanded={expandedActivities.has('inversion')}
                onToggle={() => toggleActivity('inversion')}
              />

              {/* ---- FINANCIAMIENTO ---- */}
              <StatementActivityRow
                activity="financiamiento"
                data={cashFlowByActivity.financiamiento}
                isExpanded={expandedActivities.has('financiamiento')}
                onToggle={() => toggleActivity('financiamiento')}
              />

              {/* ---- SUMMARY ---- */}
              <tr className="border-t-2 border-stone-300 print:border-t-black">
                <td className="py-2 font-medium text-stone-600">Saldo Inicial del Periodo</td>
                <td className="text-right font-medium">{fmtRD(openingBalance)}</td>
              </tr>
              <tr>
                <td className="py-1 text-stone-500">+ Flujo Neto de Actividades Operativas</td>
                <td className={`text-right font-medium ${cashFlowByActivity.operativa.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtRD(cashFlowByActivity.operativa.netFlow)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-stone-500">+ Flujo Neto de Actividades de Inversion</td>
                <td className={`text-right font-medium ${cashFlowByActivity.inversion.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtRD(cashFlowByActivity.inversion.netFlow)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-stone-500">+ Flujo Neto de Actividades de Financiamiento</td>
                <td className={`text-right font-medium ${cashFlowByActivity.financiamiento.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {fmtRD(cashFlowByActivity.financiamiento.netFlow)}
                </td>
              </tr>
              <tr className={`border-t-2 border-stone-400 print:border-t-black ${closingBalance >= 0 ? 'bg-green-50 print:bg-white' : 'bg-red-50 print:bg-white'}`}>
                <td className="py-2.5 print:py-2 font-bold text-base print:text-sm">
                  SALDO FINAL DEL PERIODO
                </td>
                <td className={`text-right font-bold text-base print:text-sm ${closingBalance >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                  {fmtRD(closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ====================== TRANSACTIONS LIST ====================== */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-stone-500" />
                Detalle de Transacciones
              </CardTitle>
              <CardDescription className="text-[11px]">
                {filteredEntries.length} registros en {getMonthLabel(selectedMonth)}
              </CardDescription>
            </div>
            {entries.length > 0 && (
              <Button variant="outline" size="sm" className="text-[10px] h-7 text-red-500 print:hidden"
                onClick={() => { if (confirm('Eliminar TODAS las transacciones de flujo de caja?')) { setEntries([]); setOpeningBalances({}) } }}>
                <Trash2 className="w-3 h-3 mr-1" /> Borrar todo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <Banknote className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Sin transacciones para este periodo.</p>
              <p className="text-[10px] mt-1">
                {monthEntries.length === 0
                  ? 'Agrega registros reales o usa el auto-llenado con estimaciones.'
                  : 'No hay transacciones para el filtro seleccionado.'}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Tipo</TableHead>
                    <TableHead className="text-[10px]">Categoria</TableHead>
                    <TableHead className="text-[10px]">Descripcion</TableHead>
                    <TableHead className="text-[10px] text-right">Monto</TableHead>
                    <TableHead className="text-[10px] text-center">Ref.</TableHead>
                    <TableHead className="text-[10px] w-8 print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-[11px]">{entry.date}</TableCell>
                      <TableCell className="text-[11px]">
                        <Badge variant="outline" className={`text-[9px] ${entry.type === 'inflow' ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'}`}>
                          {entry.type === 'inflow' ? 'Entrada' : 'Salida'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <span className="mr-1">{CATEGORIES[entry.category].icon}</span>
                        {CATEGORIES[entry.category].label}
                      </TableCell>
                      <TableCell className="text-[11px] max-w-[200px] truncate">{entry.description}</TableCell>
                      <TableCell className={`text-[11px] text-right font-medium ${entry.type === 'inflow' ? 'text-green-700' : 'text-red-600'}`}>
                        {entry.type === 'inflow' ? '+' : '-'}{fmtRD(entry.amount)}
                      </TableCell>
                      <TableCell className="text-[11px] text-center text-stone-400">{entry.reference || '-'}</TableCell>
                      <TableCell className="text-right print:hidden">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-300 hover:text-red-500"
                          onClick={() => handleDeleteEntry(entry.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====================== ADD ENTRY DIALOG ====================== */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Agregar Transaccion</DialogTitle>
            <DialogDescription className="text-xs">Registra una entrada o salida de efectivo</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => handleTypeChange('inflow')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  formType === 'inflow' ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 inline mr-1" /> Entrada
              </button>
              <button
                onClick={() => handleTypeChange('outflow')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  formType === 'outflow' ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 inline mr-1" /> Salida
              </button>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={formCategory} onValueChange={v => setFormCategory(v as CashFlowCategory)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs">Descripcion</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Ej: Venta de huevos semana 3, Compra alimento purina..."
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Monto (RD$)</Label>
                <Input
                  type="number"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-sm font-mono"
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fecha</Label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label className="text-xs">Referencia (opcional)</Label>
              <Input
                value={formReference}
                onChange={e => setFormReference(e.target.value)}
                placeholder="Ej: Factura #001, Cheque..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="text-xs">Cancelar</Button>
            <Button
              onClick={handleAddEntry}
              disabled={!formAmount || parseFloat(formAmount) <= 0 || !formDescription.trim()}
              className={`text-xs ${formType === 'inflow' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'} text-white`}
            >
              <Plus className="w-3 h-3 mr-1" />
              Agregar {formType === 'inflow' ? 'Entrada' : 'Salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====================== EDIT BALANCE DIALOG ====================== */}
      <Dialog open={showEditBalance} onOpenChange={setShowEditBalance}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Saldo Inicial</DialogTitle>
            <DialogDescription className="text-xs">
              Ingresa el saldo de caja al inicio de {getMonthLabel(selectedMonth)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Monto (RD$)</Label>
              <Input
                type="number"
                value={editBalanceValue}
                onChange={e => setEditBalanceValue(parseFloat(e.target.value) || 0)}
                className="h-9 text-sm font-mono"
                step="0.01"
              />
            </div>
            <p className="text-[10px] text-stone-500">
              Este es el efectivo disponible al inicio del periodo. El saldo final de este mes se usara como saldo inicial del siguiente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBalance(false)} className="text-xs">Cancelar</Button>
            <Button onClick={handleSaveBalance} className="text-xs">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footnote */}
      <div className="p-2 bg-stone-50 rounded text-[10px] text-stone-500 print:text-[9px] print:p-1">
        <strong>Nota:</strong> Este Estado de Flujo de Caja muestra los movimientos reales de efectivo categorizados por actividad.
        Las categorias estan adaptadas a la operacion de una granja avicola. Verificar con comprobantes fiscales y registros bancarios.
        El saldo inicial debe configurarse manualmente el primer mes. Los saldos finales se sugieren automaticamente como saldo inicial del mes siguiente.
      </div>
    </div>
  )
}

// ================================================================
// SUB-COMPONENT: Statement Activity Row (Collapsible)
// ================================================================
function StatementActivityRow({
  activity,
  data,
  isExpanded,
  onToggle,
}: {
  activity: ActivityType
  data: { inflows: { category: CashFlowCategory; label: string; total: number; count: number }[]; outflows: { category: CashFlowCategory; label: string; total: number; count: number }[]; netFlow: number }
  isExpanded: boolean
  onToggle: () => void
}) {
  const meta = ACTIVITY_META[activity]
  const hasEntries = data.inflows.length > 0 || data.outflows.length > 0

  return (
    <>
      {/* Activity Header */}
      <tr className={`${meta.bgColor} print:bg-white cursor-pointer print:cursor-default`}
        onClick={onToggle}>
        <td className="py-2 px-1 print:py-1">
          <div className="flex items-center gap-2">
            {!hasEntries && <span className="w-3.5" />}
            {hasEntries && (
              isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-stone-400" /> : <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            )}
            <span className={`font-bold text-xs print:text-xs ${meta.color} print:font-bold print:text-black`}>
              {meta.label.toUpperCase()}
            </span>
          </div>
        </td>
        <td className={`text-right font-bold text-xs ${data.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {fmtRD(data.netFlow)}
        </td>
      </tr>

      {/* Expanded Detail */}
      {isExpanded && hasEntries && (
        <>
          {/* Inflows */}
          {data.inflows.map(item => (
            <tr key={`in-${item.category}`} className="border-b border-stone-50 print:border-b-stone-200">
              <td className="py-1 pl-8 text-[11px] print:py-0.5 text-green-700">
                + {item.label} <span className="text-stone-400">({item.count})</span>
              </td>
              <td className="text-right text-[11px] text-green-700">{fmtRD(item.total)}</td>
            </tr>
          ))}
          {/* Outflows */}
          {data.outflows.map(item => (
            <tr key={`out-${item.category}`} className="border-b border-stone-50 print:border-b-stone-200">
              <td className="py-1 pl-8 text-[11px] print:py-0.5 text-red-600">
                - {item.label} <span className="text-stone-400">({item.count})</span>
              </td>
              <td className="text-right text-[11px] text-red-600">({fmtRD(item.total)})</td>
            </tr>
          ))}
          {/* Subtotal */}
          <tr className="border-b-2 border-stone-200 print:border-b-stone-300">
            <td className="py-1 pl-4 text-[11px] font-medium print:py-0.5">
              Flujo Neto de {meta.label}
            </td>
            <td className={`text-right text-[11px] font-bold ${data.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {fmtRD(data.netFlow)}
            </td>
          </tr>
        </>
      )}
    </>
  )
}


