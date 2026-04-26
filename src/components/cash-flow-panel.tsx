'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  RefreshCw, Loader2, ArrowRightLeft, Egg, Wheat, AlertTriangle, DollarSign, Info,
  Pencil, Save, X,
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
const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || ''

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
  const [entries, setEntries] = useState<CashFlowEntry[]>([])
  const [openingBalances, setOpeningBalances] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

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

  // Edit state
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null)
  const [editFormType, setEditFormType] = useState<EntryType>('inflow')
  const [editFormCategory, setEditFormCategory] = useState<CashFlowCategory>('venta_huevos')
  const [editFormDescription, setEditFormDescription] = useState('')
  const [editFormAmount, setEditFormAmount] = useState('')
  const [editFormDate, setEditFormDate] = useState('')
  const [editFormReference, setEditFormReference] = useState('')

  // ---- Fetch from Supabase on mount ----
  useEffect(() => {
    if (!FARM_ID) {
      // Fallback to localStorage if no farm ID
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setEntries(JSON.parse(saved))
        const savedBalances = localStorage.getItem(BALANCE_KEY)
        if (savedBalances) setOpeningBalances(JSON.parse(savedBalances))
      } catch { /* ignore */ }
      setLoading(false)
      return
    }

    setLoading(true)
    fetch(`/api/cash-flow?farm_id=${FARM_ID}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          // Map Supabase entries to local format
          const mapped = (data.entries || []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            date: typeof e.date === 'string' ? e.date.substring(0, 10) : String(e.date),
            category: e.category as CashFlowCategory,
            description: (e.description || '') as string,
            amount: Number(e.amount),
            type: e.type as EntryType,
            reference: (e.reference || '') as string,
            createdAt: (e.createdAt || e.created_at || '') as string,
          }))
          setEntries(mapped)

          // Load balances from Supabase
          if (data.balances) {
            setOpeningBalances(data.balances as Record<string, number>)
          }

          // Also update localStorage as cache
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
          localStorage.setItem(BALANCE_KEY, JSON.stringify(data.balances || {}))
        } else {
          // Fallback to localStorage
          try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) setEntries(JSON.parse(saved))
            const savedBalances = localStorage.getItem(BALANCE_KEY)
            if (savedBalances) setOpeningBalances(JSON.parse(savedBalances))
          } catch { /* ignore */ }
        }
      })
      .catch(() => {
        // On error, fallback to localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) setEntries(JSON.parse(saved))
          const savedBalances = localStorage.getItem(BALANCE_KEY)
          if (savedBalances) setOpeningBalances(JSON.parse(savedBalances))
        } catch { /* ignore */ }
      })
      .finally(() => setLoading(false))
  }, [])

  // ---- Local persistence (cache) ----
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) }, [entries])
  useEffect(() => { localStorage.setItem(BALANCE_KEY, JSON.stringify(openingBalances)) }, [openingBalances])

  // ---- Inline Editing State ----
  const [inlineEdit, setInlineEdit] = useState<{ entryId: string; field: 'date' | 'description' | 'amount' | 'category' } | null>(null)
  const [inlineValue, setInlineValue] = useState('')
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Focus inline input when set
  useEffect(() => {
    if (inlineEdit && inlineInputRef.current) {
      inlineInputRef.current.focus()
      inlineInputRef.current.select()
    }
  }, [inlineEdit])

  const startInlineEdit = useCallback((entry: CashFlowEntry, field: 'date' | 'description' | 'amount' | 'category') => {
    setInlineEdit({ entryId: entry.id, field })
    setInlineValue(
      field === 'amount' ? String(entry.amount) :
      field === 'category' ? entry.category :
      field === 'date' ? entry.date :
      entry.description
    )
  }, [])

  const saveInlineEdit = useCallback((entryId: string, field: 'date' | 'description' | 'amount' | 'category', value: string) => {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return

    let updates: Partial<CashFlowEntry> = {}
    if (field === 'date') {
      updates.date = value
    } else if (field === 'description') {
      if (!value.trim()) { setInlineEdit(null); return }
      updates.description = value.trim()
    } else if (field === 'amount') {
      const num = parseFloat(value)
      if (!num || num <= 0) { setInlineEdit(null); return }
      updates.amount = Math.round(num * 100) / 100
    } else if (field === 'category') {
      updates.category = value as CashFlowCategory
    }

    const updated = { ...entry, ...updates }

    // Optimistic update
    setEntries(prev => prev.map(e => e.id === entryId ? updated : e))
    setInlineEdit(null)

    // Push to Supabase
    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow/${encodeURIComponent(entryId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
        .then(() => {})
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [entries])

  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null)
    setInlineValue('')
  }, [])

  // Keyboard handler for inline editing
  const handleInlineKeyDown = useCallback((e: React.KeyboardEvent, entryId: string, field: 'date' | 'description' | 'amount' | 'category') => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveInlineEdit(entryId, field, inlineValue)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelInlineEdit()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      saveInlineEdit(entryId, field, inlineValue)
      // Move to next field in same row
      const fields: Array<'date' | 'description' | 'amount' | 'category'> = ['date', 'category', 'description', 'amount']
      const currentIdx = fields.indexOf(field)
      if (currentIdx < fields.length - 1) {
        startInlineEdit({ id: entryId } as CashFlowEntry, fields[currentIdx + 1])
      }
    }
  }, [inlineValue, saveInlineEdit, cancelInlineEdit, startInlineEdit])

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
    if (type === 'inflow') setFormCategory('venta_huevos')
    else setFormCategory('alimento')
  }, [])

  const handleAddEntry = useCallback(() => {
    const amount = parseFloat(formAmount)
    if (!amount || amount <= 0 || !formDescription.trim()) return

    const entryId = generateId()
    const entry: CashFlowEntry = {
      id: entryId,
      date: formDate,
      category: formCategory,
      description: formDescription.trim(),
      amount: Math.round(amount * 100) / 100,
      type: formType,
      reference: formReference.trim(),
      createdAt: new Date().toISOString(),
    }

    // Optimistic update
    setEntries(prev => [entry, ...prev])
    setShowAddDialog(false)
    resetForm()

    // Push to Supabase
    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow?farm_id=${FARM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_key: entryId,
          date: entry.date,
          category: entry.category,
          description: entry.description,
          amount: entry.amount,
          type: entry.type,
          reference: entry.reference,
        }),
      })
        .then(() => {})
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [formAmount, formCategory, formDate, formDescription, formType, formReference, resetForm])

  const handleDeleteEntry = useCallback((id: string) => {
    // Optimistic update
    setEntries(prev => prev.filter(e => e.id !== id))

    // Delete from Supabase
    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow/${encodeURIComponent(id)}`, { method: 'DELETE' })
        .then(() => {})
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [])

  // ---- Edit Entry ----
  const openEditDialog = useCallback((entry: CashFlowEntry) => {
    setEditingEntry(entry)
    setEditFormType(entry.type)
    setEditFormCategory(entry.category)
    setEditFormDescription(entry.description)
    setEditFormAmount(String(entry.amount))
    setEditFormDate(entry.date)
    setEditFormReference(entry.reference || '')
  }, [])

  const handleEditTypeChange = useCallback((type: EntryType) => {
    setEditFormType(type)
    if (type === 'inflow') setEditFormCategory('venta_huevos')
    else setEditFormCategory('alimento')
  }, [])

  const editCategoryOptions = useMemo(() => {
    return Object.entries(CATEGORIES)
      .filter(([_, info]) => info.defaultType === editFormType)
      .map(([key, info]) => ({ value: key, label: `${info.icon} ${info.label}`, group: info.group }))
  }, [editFormType])

  const handleSaveEdit = useCallback(() => {
    if (!editingEntry) return
    const amount = parseFloat(editFormAmount)
    if (!amount || amount <= 0 || !editFormDescription.trim()) return

    const updated: CashFlowEntry = {
      ...editingEntry,
      date: editFormDate,
      category: editFormCategory,
      description: editFormDescription.trim(),
      amount: Math.round(amount * 100) / 100,
      type: editFormType,
      reference: editFormReference.trim(),
    }

    // Optimistic update
    setEntries(prev => prev.map(e => e.id === editingEntry.id ? updated : e))
    setEditingEntry(null)

    // Push to Supabase
    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow/${encodeURIComponent(editingEntry.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: updated.date,
          category: updated.category,
          description: updated.description,
          amount: updated.amount,
          type: updated.type,
          reference: updated.reference,
        }),
      })
        .then(() => {})
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [editingEntry, editFormAmount, editFormCategory, editFormDate, editFormDescription, editFormType, editFormReference])

  const handleSaveBalance = useCallback(() => {
    const newBalances = { ...openingBalances, [selectedMonth]: Math.round(editBalanceValue * 100) / 100 }
    setOpeningBalances(newBalances)
    setShowEditBalance(false)

    // Push to Supabase
    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow?farm_id=${FARM_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balances: newBalances }),
      })
        .then(() => {})
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [selectedMonth, editBalanceValue, openingBalances])

  const handleDeleteAll = useCallback(() => {
    setEntries([])
    setOpeningBalances({})

    if (FARM_ID) {
      setSyncing(true)
      fetch(`/api/cash-flow?farm_id=${FARM_ID}`, { method: 'DELETE' })
        .then(() => {
          localStorage.removeItem(STORAGE_KEY)
          localStorage.removeItem(BALANCE_KEY)
        })
        .catch(() => {})
        .finally(() => setSyncing(false))
    }
  }, [])

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
      if (!cat) continue
      const key = `${entry.category}|${entry.type}`
      if (!categoryTotals[key]) categoryTotals[key] = { total: 0, count: 0 }
      categoryTotals[key].total += entry.amount
      categoryTotals[key].count++

      if (entry.type === 'inflow') result[cat.activity].netFlow += entry.amount
      else result[cat.activity].netFlow -= entry.amount
    }

    for (const [key, data] of Object.entries(categoryTotals)) {
      const pipeIdx = key.indexOf('|')
      const catStr = key.substring(0, pipeIdx) as CashFlowCategory
      const typeStr = key.substring(pipeIdx + 1)
      const catInfo = CATEGORIES[catStr]
      if (!catInfo) continue
      const item = { category: catStr, label: catInfo.label, total: Math.round(data.total * 100) / 100, count: data.count }
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

  // ---- Sync from Operations ----
  const [syncData, setSyncData] = useState<null | {
    month: string
    entryCount: number
    totals: { eggsCollected: number; eggsSold: number; eggsBroken: number; mortality: number; feedKg: number }
    financial: { eggRevenue: number; feedCost: number; mortalityLoss: number; fixedCostsMonthly: number; structuralTotal: number }
    suggestions: Array<{ category: string; description: string; amount: number; type: 'inflow' | 'outflow'; source: string; existingAmount?: number }>
    hasChanges: boolean
    existingSyncCategories: string[]
  }>(null)
  const [syncingOps, setSyncingOps] = useState(false)
  const [showSyncPanel, setShowSyncPanel] = useState(false)

  const fetchSyncData = useCallback(async () => {
    if (!FARM_ID) return
    setSyncingOps(true)
    try {
      const res = await fetch(`/api/cash-flow/sync?farm_id=${FARM_ID}&month=${selectedMonth}`)
      if (res.ok) {
        const data = await res.json()
        setSyncData(data)
        if (data.suggestions.length > 0) {
          setShowSyncPanel(true)
        }
      }
    } catch { /* ignore */ }
    finally { setSyncingOps(false) }
  }, [FARM_ID, selectedMonth])

  const handleSyncConfirm = useCallback(async () => {
    if (!syncData || !FARM_ID) return
    setSyncingOps(true)
    try {
      const entriesToSync = syncData.suggestions.map(s => ({
        category: s.category,
        description: s.description,
        amount: s.amount,
        type: s.type,
      }))
      const res = await fetch(`/api/cash-flow/sync?farm_id=${FARM_ID}&month=${selectedMonth}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entriesToSync }),
      })
      if (res.ok) {
        setShowSyncPanel(false)
        setSyncData(null)
        // Re-fetch cash flow entries
        const cfRes = await fetch(`/api/cash-flow?farm_id=${FARM_ID}`)
        if (cfRes.ok) {
          const cfData = await cfRes.json()
          const mapped = (cfData.entries || []).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            date: typeof e.date === 'string' ? e.date.substring(0, 10) : String(e.date),
            category: e.category as CashFlowCategory,
            description: (e.description || '') as string,
            amount: Number(e.amount),
            type: e.type as EntryType,
            reference: (e.reference || '') as string,
            createdAt: (e.createdAt || e.created_at || '') as string,
          }))
          setEntries(mapped)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped))
        }
      }
    } catch { /* ignore */ }
    finally { setSyncingOps(false) }
  }, [syncData, FARM_ID, selectedMonth])

  // Fetch sync data when month changes (to check if there are unsynced operations)
  useEffect(() => {
    if (FARM_ID) {
      fetchSyncData()
    }
  }, [FARM_ID, selectedMonth, fetchSyncData])

  // ---- Quick Auto-fill Suggestion ----
  const [showAutoFillHint, setShowAutoFillHint] = useState(false)
  const handleAutoFillFromConfig = useCallback(() => {
    if (monthEntries.length > 0) return
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

    // Push to Supabase
    if (FARM_ID) {
      fetch(`/api/cash-flow?farm_id=${FARM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntries.map(e => ({
          entry_key: e.id,
          date: e.date,
          category: e.category,
          description: e.description,
          amount: e.amount,
          type: e.type,
          reference: e.reference,
        }))),
      }).catch(() => {})
    }
  }, [monthEntries.length, calculations, config])

  // ================================================================
  // RENDER
  // ================================================================
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-stone-400">
          <Banknote className="w-10 h-10 mx-auto mb-2 opacity-30 animate-pulse" />
          <p className="text-sm">Cargando flujo de caja...</p>
        </div>
      </div>
    )
  }

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
            {syncing && <span className="text-[10px] text-amber-500 font-normal">sincronizando...</span>}
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

      {/* Sync from Operations */}
      {FARM_ID && (
        <div className="print:hidden">
          {!showSyncPanel ? (
            <button
              onClick={() => { if (syncData) setShowSyncPanel(true); else fetchSyncData() }}
              disabled={syncingOps}
              className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                {syncingOps ? <Loader2 className="w-4 h-4 text-blue-500 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 text-blue-500" />}
                <div className="text-left">
                  <p className="text-sm font-bold text-stone-800">Sincronizar con operaciones</p>
                  <p className="text-[11px] text-stone-500">
                    {syncData?.entryCount
                      ? `${syncData.entryCount} registros operativos encontrados`
                      : 'Importar datos de produccion diaria al flujo de caja'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {syncData?.hasChanges && (
                  <Badge className="bg-green-100 text-green-700 text-[10px]">Actualizable</Badge>
                )}
                <RefreshCw className={`w-4 h-4 text-stone-400 ${syncingOps ? 'animate-spin' : ''}`} />
              </div>
            </button>
          ) : syncData && (
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                    Sincronizar con operaciones del mes
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowSyncPanel(false)}>
                    <ChevronUp className="w-3 h-3" />
                  </Button>
                </div>
                <CardDescription className="text-[11px]">
                  {syncData.entryCount} registros operativos en {getMonthLabel(selectedMonth)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Operations summary */}
                {syncData.entryCount > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded-lg bg-orange-50">
                      <Egg className="w-3.5 h-3.5 mx-auto text-orange-500 mb-1" />
                      <p className="text-xs font-bold text-stone-800">{syncData.totals.eggsCollected.toLocaleString()}</p>
                      <p className="text-[9px] text-stone-500">Huevos</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-red-50">
                      <AlertTriangle className="w-3.5 h-3.5 mx-auto text-red-400 mb-1" />
                      <p className="text-xs font-bold text-stone-800">{syncData.totals.eggsBroken}</p>
                      <p className="text-[9px] text-stone-500">Rotos</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-amber-50">
                      <Wheat className="w-3.5 h-3.5 mx-auto text-amber-500 mb-1" />
                      <p className="text-xs font-bold text-stone-800">{syncData.totals.feedKg.toLocaleString()} kg</p>
                      <p className="text-[9px] text-stone-500">Alimento</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-stone-50">
                      <AlertTriangle className="w-3.5 h-3.5 mx-auto text-stone-400 mb-1" />
                      <p className="text-xs font-bold text-stone-800">{syncData.totals.mortality}</p>
                      <p className="text-[9px] text-stone-500">Mortalidad</p>
                    </div>
                  </div>
                )}

                {/* Suggested entries */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-stone-600">Registros que se crearan en el flujo de caja:</p>
                  <div className="space-y-1">
                    {syncData.suggestions.map(s => (
                      <div key={s.category} className="flex items-center justify-between text-xs p-2 rounded-lg bg-stone-50">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{CATEGORIES[s.category as CashFlowCategory]?.icon || ''}</span>
                          <div>
                            <p className="font-medium text-stone-700">{CATEGORIES[s.category as CashFlowCategory]?.label || s.category}</p>
                            <p className="text-[10px] text-stone-400">{s.source}</p>
                          </div>
                        </div>
                        <span className={`font-bold ${s.type === 'inflow' ? 'text-green-700' : 'text-red-600'}`}>
                          {s.type === 'inflow' ? '+' : '-'}{fmtRD(s.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {syncData.existingSyncCategories.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-2 rounded-lg">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    <span>Se reemplazaran los registros anteriores sincronizados ({syncData.existingSyncCategories.length} categorias)</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSyncConfirm} disabled={syncingOps}>
                    {syncingOps ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    {syncingOps ? 'Sincronizando...' : 'Confirmar Sincronizacion'}
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowSyncPanel(false)}>Cancelar</Button>
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
              {(filterActivity === 'all' || filterActivity === 'operativa') && (
                <StatementActivityRow
                  activity="operativa"
                  data={cashFlowByActivity.operativa}
                  isExpanded={expandedActivities.has('operativa') || filterActivity === 'operativa'}
                  onToggle={() => toggleActivity('operativa')}
                />
              )}

              {/* ---- INVERSION ---- */}
              {(filterActivity === 'all' || filterActivity === 'inversion') && (
                <StatementActivityRow
                  activity="inversion"
                  data={cashFlowByActivity.inversion}
                  isExpanded={expandedActivities.has('inversion') || filterActivity === 'inversion'}
                  onToggle={() => toggleActivity('inversion')}
                />
              )}

              {/* ---- FINANCIAMIENTO ---- */}
              {(filterActivity === 'all' || filterActivity === 'financiamiento') && (
                <StatementActivityRow
                  activity="financiamiento"
                  data={cashFlowByActivity.financiamiento}
                  isExpanded={expandedActivities.has('financiamiento') || filterActivity === 'financiamiento'}
                  onToggle={() => toggleActivity('financiamiento')}
                />
              )}

              {/* ---- SUMMARY ---- */}
              <tr className="border-t-2 border-stone-300 print:border-t-black">
                <td className="py-2 font-medium text-stone-600">Saldo Inicial del Periodo</td>
                <td className="text-right font-medium">{fmtRD(openingBalance)}</td>
              </tr>
              {(filterActivity === 'all' || filterActivity === 'operativa') && (
                <tr>
                  <td className="py-1 text-stone-500">+ Flujo Neto de Actividades Operativas</td>
                  <td className={`text-right font-medium ${cashFlowByActivity.operativa.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtRD(cashFlowByActivity.operativa.netFlow)}
                  </td>
                </tr>
              )}
              {(filterActivity === 'all' || filterActivity === 'inversion') && (
                <tr>
                  <td className="py-1 text-stone-500">+ Flujo Neto de Actividades de Inversion</td>
                  <td className={`text-right font-medium ${cashFlowByActivity.inversion.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtRD(cashFlowByActivity.inversion.netFlow)}
                  </td>
                </tr>
              )}
              {(filterActivity === 'all' || filterActivity === 'financiamiento') && (
                <tr>
                  <td className="py-1 text-stone-500">+ Flujo Neto de Actividades de Financiamiento</td>
                  <td className={`text-right font-medium ${cashFlowByActivity.financiamiento.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmtRD(cashFlowByActivity.financiamiento.netFlow)}
                  </td>
                </tr>
              )}
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
                onClick={() => { if (confirm('Eliminar TODAS las transacciones de flujo de caja?')) handleDeleteAll() }}>
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
                    <TableHead className="text-[10px] w-16 print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map(entry => (
                    <TableRow key={entry.id} className="hover:bg-stone-50 group">
                      {/* Date cell — inline editable */}
                      <TableCell className="text-[11px] p-0.5">
                        {inlineEdit?.entryId === entry.id && inlineEdit?.field === 'date' ? (
                          <input
                            ref={inlineInputRef}
                            type="date"
                            value={inlineValue}
                            onChange={e => setInlineValue(e.target.value)}
                            onBlur={() => saveInlineEdit(entry.id, 'date', inlineValue)}
                            onKeyDown={e => handleInlineKeyDown(e, entry.id, 'date')}
                            className="w-full h-7 text-[11px] px-1 border border-blue-300 rounded bg-blue-50 outline-none"
                          />
                        ) : (
                          <div
                            className="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-stone-100 group-hover:ring-1 group-hover:ring-blue-200 transition-all min-w-[80px]"
                            onDoubleClick={() => startInlineEdit(entry, 'date')}
                          >
                            <span className="flex-1">{entry.date}</span>
                            <Pencil className="w-2.5 h-2.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </TableCell>
                      {/* Type badge */}
                      <TableCell className="text-[11px]">
                        <Badge variant="outline" className={`text-[9px] ${entry.type === 'inflow' ? 'border-green-300 text-green-700 bg-green-50' : 'border-red-300 text-red-700 bg-red-50'}`}>
                          {entry.type === 'inflow' ? 'Entrada' : 'Salida'}
                        </Badge>
                      </TableCell>
                      {/* Category cell — inline editable with select */}
                      <TableCell className="text-[11px] p-0.5">
                        {inlineEdit?.entryId === entry.id && inlineEdit?.field === 'category' ? (
                          <select
                            ref={inlineInputRef}
                            value={inlineValue}
                            onChange={e => { setInlineValue(e.target.value); saveInlineEdit(entry.id, 'category', e.target.value) }}
                            onBlur={() => cancelInlineEdit()}
                            onKeyDown={e => handleInlineKeyDown(e, entry.id, 'category')}
                            className="w-full h-7 text-[11px] px-1 border border-blue-300 rounded bg-blue-50 outline-none"
                          >
                            {Object.entries(CATEGORIES).map(([key, info]) => (
                              <option key={key} value={key}>{info.icon} {info.label}</option>
                            ))}
                          </select>
                        ) : (
                          <div
                            className="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-stone-100 group-hover:ring-1 group-hover:ring-blue-200 transition-all"
                            onDoubleClick={() => startInlineEdit(entry, 'category')}
                          >
                            <span className="mr-0.5">{CATEGORIES[entry.category]?.icon || ''}</span>
                            <span className="flex-1 truncate">{CATEGORIES[entry.category]?.label || entry.category}</span>
                            <Pencil className="w-2.5 h-2.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </TableCell>
                      {/* Description cell — inline editable */}
                      <TableCell className="text-[11px] p-0.5 max-w-[200px]">
                        {inlineEdit?.entryId === entry.id && inlineEdit?.field === 'description' ? (
                          <input
                            ref={inlineInputRef}
                            type="text"
                            value={inlineValue}
                            onChange={e => setInlineValue(e.target.value)}
                            onBlur={() => saveInlineEdit(entry.id, 'description', inlineValue)}
                            onKeyDown={e => handleInlineKeyDown(e, entry.id, 'description')}
                            className="w-full h-7 text-[11px] px-1 border border-blue-300 rounded bg-blue-50 outline-none"
                            placeholder="Descripcion..."
                          />
                        ) : (
                          <div
                            className="flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-stone-100 group-hover:ring-1 group-hover:ring-blue-200 transition-all truncate"
                            onDoubleClick={() => startInlineEdit(entry, 'description')}
                            title="Doble clic para editar"
                          >
                            <span className="flex-1 truncate">{entry.description}</span>
                            <Pencil className="w-2.5 h-2.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </TableCell>
                      {/* Amount cell — inline editable */}
                      <TableCell className={`text-[11px] p-0.5 ${entry.type === 'inflow' ? 'text-green-700' : 'text-red-600'}`}>
                        {inlineEdit?.entryId === entry.id && inlineEdit?.field === 'amount' ? (
                          <input
                            ref={inlineInputRef}
                            type="number"
                            step="0.01"
                            min="0"
                            value={inlineValue}
                            onChange={e => setInlineValue(e.target.value)}
                            onBlur={() => saveInlineEdit(entry.id, 'amount', inlineValue)}
                            onKeyDown={e => handleInlineKeyDown(e, entry.id, 'amount')}
                            className="w-full h-7 text-[11px] px-1 border border-blue-300 rounded bg-blue-50 outline-none text-right font-medium"
                          />
                        ) : (
                          <div
                            className="flex items-center justify-end gap-1 px-1 py-0.5 rounded cursor-pointer hover:bg-stone-100 group-hover:ring-1 group-hover:ring-blue-200 transition-all font-medium"
                            onDoubleClick={() => startInlineEdit(entry, 'amount')}
                            title="Doble clic para editar"
                          >
                            <span>{entry.type === 'inflow' ? '+' : '-'}{fmtRD(entry.amount)}</span>
                            <Pencil className="w-2.5 h-2.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                        )}
                      </TableCell>
                      {/* Reference cell */}
                      <TableCell className="text-[11px] text-center text-stone-400">{entry.reference || '-'}</TableCell>
                      {/* Actions */}
                      <TableCell className="text-right print:hidden">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-blue-600 hover:bg-blue-50"
                            onClick={(e) => { e.stopPropagation(); openEditDialog(entry) }}
                            title="Editar completo">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-300 hover:text-red-500 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
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

      {/* ====================== EDIT ENTRY DIALOG ====================== */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-500" />
              Editar Transaccion
            </DialogTitle>
            <DialogDescription className="text-xs">Modifica los datos del registro</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => handleEditTypeChange('inflow')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  editFormType === 'inflow' ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 inline mr-1" /> Entrada
              </button>
              <button
                onClick={() => handleEditTypeChange('outflow')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                  editFormType === 'outflow' ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 inline mr-1" /> Salida
              </button>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={editFormCategory} onValueChange={v => setEditFormCategory(v as CashFlowCategory)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editCategoryOptions.map(opt => (
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
                value={editFormDescription}
                onChange={e => setEditFormDescription(e.target.value)}
                placeholder="Descripcion del movimiento..."
                className="text-xs min-h-[60px]"
              />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Monto (RD$)</Label>
                <Input
                  type="number"
                  value={editFormAmount}
                  onChange={e => setEditFormAmount(e.target.value)}
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
                  value={editFormDate}
                  onChange={e => setEditFormDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-1.5">
              <Label className="text-xs">Referencia (opcional)</Label>
              <Input
                value={editFormReference}
                onChange={e => setEditFormReference(e.target.value)}
                placeholder="Ej: Factura #001, Cheque..."
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)} className="text-xs">Cancelar</Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editFormAmount || parseFloat(editFormAmount) <= 0 || !editFormDescription.trim()}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-3 h-3 mr-1" /> Guardar Cambios
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
              Este es el efectivo disponible al inicio del periodo. El saldo final de este mes se usara como saldo inicial del proximo.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditBalance(false)} className="text-xs">Cancelar</Button>
            <Button onClick={handleSaveBalance} className="text-xs bg-stone-900 hover:bg-stone-800 text-white">Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footnote */}
      <p className="text-[9px] text-stone-400 text-center print:hidden">
        Estado de Flujo de Caja — Granja Nidal. Los datos se sincronizan automaticamente entre usuarios.
      </p>
    </div>
  )
}

// ================================================================
// STATEMENT ACTIVITY ROW SUBCOMPONENT
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
  const allItems = [
    ...data.inflows.map(i => ({ ...i, type: 'inflow' as const })),
    ...data.outflows.map(o => ({ ...o, type: 'outflow' as const })),
  ]

  return (
    <>
      <tr
        className={`${meta.bgColor} cursor-pointer hover:brightness-95 transition-all`}
        onClick={onToggle}
      >
        <td className="py-2 px-2">
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
            <span className="font-semibold text-xs">{meta.label}</span>
          </div>
        </td>
        <td className={`text-right font-medium text-xs ${data.netFlow >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          {data.netFlow >= 0 ? '+' : ''}{fmtRD(data.netFlow)}
        </td>
      </tr>
      {isExpanded && allItems.length > 0 && allItems.map(item => (
        <tr key={`${item.category}-${item.type}`} className="border-b border-stone-100">
          <td className="py-1 px-6 text-[11px] text-stone-600">
            {item.type === 'inflow' ? '+' : '-'} {item.label}
            <span className="text-stone-400 ml-1">({item.count})</span>
          </td>
          <td className={`text-right text-[11px] ${item.type === 'inflow' ? 'text-green-600' : 'text-red-500'}`}>
            {fmtRD(item.total)}
          </td>
        </tr>
      ))}
      {isExpanded && allItems.length === 0 && (
        <tr className="border-b border-stone-100">
          <td className="py-1 px-6 text-[11px] text-stone-400 italic" colSpan={2}>
            Sin movimientos en esta categoria
          </td>
        </tr>
      )}
    </>
  )
}
