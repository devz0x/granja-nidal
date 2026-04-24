'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Syringe, Wheat, Wrench, DollarSign, Heart, ShieldCheck, Hammer, MoreHorizontal,
  Plus, Trash2, Edit3, Save, X, CheckCircle2, AlertTriangle, Clock, Bell,
  Calendar, ChevronDown, ChevronUp, Filter, Search, Printer, RotateCcw, Eye,
  Bug, ClipboardCheck, Timer, ArrowUpDown, Sparkles,
} from 'lucide-react'

// ================================================================
// TYPES
// ================================================================
type ReminderCategory = 'vacuna' | 'alimento' | 'mantenimiento' | 'pago' | 'veterinario' | 'plagas' | 'infraestructura' | 'otros'
type ReminderPriority = 'urgente' | 'alta' | 'media' | 'baja'
type ReminderStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
type ReminderRecurrence = 'unica' | 'diaria' | 'semanal' | 'mensual' | 'trimestral'

interface Reminder {
  id: string
  title: string
  description: string
  category: ReminderCategory
  priority: ReminderPriority
  status: ReminderStatus
  dueDate: string
  dueTime: string
  batchId: string
  recurrence: ReminderRecurrence
  recurrenceEnd: string
  completedAt: string
  createdAt: string
  notes: string
  estimatedCost: number
  assignedTo: string
  autoSource?: string  // 'batch-created', 'phase-change', 'phase-transition', 'cycle-warning', 'pest-control', 'batch-milestone'
}

interface RemindersProps {
  batches: { id: string; name: string; hens: number; phase: string; layingRate: number; isLaying: boolean; cycleMonth: number }[]
  config: {
    feedPhases: Record<string, { label: string; consumption: number; price: number; weeks: string }>
    hensPerBatch: number
    baseLayingRate: number
  }
  fmtRD: (v: number) => string
  fmtNum: (v: number) => string
}

// ================================================================
// CONSTANTS
// ================================================================
const LS_KEY = 'granja-wd80-reminders'

const AUTO_SOURCE_LABELS: Record<string, string> = {
  'batch-created': 'Lote Creado',
  'phase-change': 'Cambio Fase',
  'phase-transition': 'Transición',
  'cycle-warning': 'Fin Ciclo',
  'pest-control': 'Control Plagas',
  'batch-milestone': 'Hito',
}

const AUTO_SOURCE_COLORS: Record<string, string> = {
  'batch-created': 'bg-violet-100 text-violet-700 border-violet-200',
  'phase-change': 'bg-amber-100 text-amber-700 border-amber-200',
  'phase-transition': 'bg-sky-100 text-sky-700 border-sky-200',
  'cycle-warning': 'bg-red-100 text-red-700 border-red-200',
  'pest-control': 'bg-orange-100 text-orange-700 border-orange-200',
  'batch-milestone': 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const CATEGORY_CONFIG: Record<ReminderCategory, { label: string; icon: typeof Syringe; color: string }> = {
  vacuna: { label: 'Vacunación', icon: Syringe, color: 'text-violet-600' },
  alimento: { label: 'Compra de Alimento', icon: Wheat, color: 'text-amber-600' },
  mantenimiento: { label: 'Mantenimiento', icon: Wrench, color: 'text-stone-600' },
  pago: { label: 'Pago de Servicios', icon: DollarSign, color: 'text-green-600' },
  veterinario: { label: 'Visita Veterinaria', icon: Heart, color: 'text-red-500' },
  plagas: { label: 'Control de Plagas', icon: ShieldCheck, color: 'text-orange-600' },
  infraestructura: { label: 'Infraestructura', icon: Hammer, color: 'text-yellow-700' },
  otros: { label: 'Otros', icon: MoreHorizontal, color: 'text-slate-500' },
}

const PRIORITY_CONFIG: Record<ReminderPriority, { label: string; badge: string; border: string; bg: string }> = {
  urgente: { label: 'Urgente', badge: 'bg-red-100 text-red-700', border: 'border-l-red-500', bg: 'bg-red-50/50' },
  alta: { label: 'Alta', badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400', bg: 'bg-orange-50/30' },
  media: { label: 'Media', badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-400', bg: 'bg-amber-50/20' },
  baja: { label: 'Baja', badge: 'bg-blue-100 text-blue-700', border: 'border-l-blue-400', bg: 'bg-blue-50/20' },
}

const STATUS_CONFIG: Record<ReminderStatus, { label: string; badge: string }> = {
  pendiente: { label: 'Pendiente', badge: 'bg-slate-100 text-slate-700' },
  en_progreso: { label: 'En Progreso', badge: 'bg-blue-100 text-blue-700' },
  completada: { label: 'Completada', badge: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', badge: 'bg-red-100 text-red-500' },
}

const RECURRENCE_LABELS: Record<ReminderRecurrence, string> = {
  unica: 'Única',
  diaria: 'Diaria',
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
}

type SortField = 'dueDate' | 'priority' | 'category' | 'createdAt'
type SortDir = 'asc' | 'desc'

const PRIORITY_ORDER: Record<ReminderPriority, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }
const STATUS_ORDER: Record<ReminderStatus, number> = { pendiente: 0, en_progreso: 1, completada: 2, cancelada: 3 }

// ================================================================
// HELPERS
// ================================================================
function generateId(): string {
  return `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function daysBetween(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1)
  const d2 = new Date(dateStr2)
  d1.setHours(0, 0, 0, 0)
  d2.setHours(0, 0, 0, 0)
  return Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function addRecurrenceDays(dateStr: string, recurrence: ReminderRecurrence): string {
  switch (recurrence) {
    case 'diaria': return addDays(dateStr, 1)
    case 'semanal': return addDays(dateStr, 7)
    case 'mensual': return addDays(dateStr, 30)
    case 'trimestral': return addDays(dateStr, 90)
    default: return dateStr
  }
}

function getCountdownText(dueDate: string): { text: string; className: string } {
  const today = new Date().toISOString().split('T')[0]
  const diff = daysBetween(today, dueDate)

  if (diff < 0) {
    return { text: `VENCIDA hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`, className: 'text-red-600 font-bold' }
  }
  if (diff === 0) return { text: 'Hoy', className: 'text-amber-600 font-bold' }
  if (diff === 1) return { text: 'Mañana', className: 'text-amber-600 font-semibold' }
  if (diff <= 7) return { text: `Vence en ${diff} días`, className: 'text-amber-600' }
  return { text: `Vence en ${diff} días`, className: 'text-stone-500' }
}

function createEmptyReminder(): Reminder {
  return {
    id: '',
    title: '',
    description: '',
    category: 'mantenimiento',
    priority: 'media',
    status: 'pendiente',
    dueDate: new Date().toISOString().split('T')[0],
    dueTime: '08:00',
    batchId: '',
    recurrence: 'unica',
    recurrenceEnd: '',
    completedAt: '',
    createdAt: new Date().toISOString(),
    notes: '',
    estimatedCost: 0,
    assignedTo: '',
  }
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function RemindersPanel({ batches, config, fmtRD, fmtNum }: RemindersProps) {
  const today = new Date().toISOString().split('T')[0]

  // ---- State ----
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(LS_KEY)
        if (saved) return JSON.parse(saved) as Reminder[]
      } catch { /* ignore */ }
    }
    return []
  })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Reminder>(createEmptyReminder())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  const [now, setNow] = useState(new Date())

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterBatch, setFilterBatch] = useState<string>('all')
  const [filterOrigin, setFilterOrigin] = useState<string>('all') // 'all' | 'auto' | 'manual'
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('dueDate')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Ref for print container
  const printRef = useRef<HTMLDivElement>(null)

  // ---- Persist ----
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(reminders))
  }, [reminders])

  // ---- Auto-refresh every minute for overdue detection ----
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // ---- Derived: Stats ----
  const stats = useMemo(() => {
    const active = reminders.filter(r => r.status !== 'completada' && r.status !== 'cancelada')
    const overdue = active.filter(r => daysBetween(today, r.dueDate) < 0)
    const dueToday = active.filter(r => daysBetween(today, r.dueDate) === 0)
    const urgenteCount = active.filter(r => r.priority === 'urgente' && (daysBetween(today, r.dueDate) <= 1))
    const completedThisMonth = reminders.filter(r => {
      if (r.status !== 'completada' || !r.completedAt) return false
      const d = new Date(r.completedAt)
      const now2 = new Date()
      return d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear()
    })
    const next7 = active.filter(r => {
      const diff = daysBetween(today, r.dueDate)
      return diff >= 0 && diff <= 7
    })
    const autoActive = active.filter(r => r.autoSource)
    const manualActive = active.filter(r => !r.autoSource)
    return {
      active: active.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      urgente: urgenteCount.length,
      completedThisMonth: completedThisMonth.length,
      next7: next7.length,
      autoActive: autoActive.length,
      manualActive: manualActive.length,
    }
  }, [reminders, today])

  // ---- Derived: Filtered & sorted ----
  const filteredReminders = useMemo(() => {
    let list = reminders.filter(r => {
      if (filterCategory !== 'all' && r.category !== filterCategory) return false
      if (filterPriority !== 'all' && r.priority !== filterPriority) return false
      if (filterStatus !== 'all' && r.status !== filterStatus) return false
      if (filterBatch !== 'all' && r.batchId !== filterBatch) return false
      if (filterOrigin === 'auto' && !r.autoSource) return false
      if (filterOrigin === 'manual' && r.autoSource) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!r.title.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q)) return false
      }
      return true
    })

    list.sort((a, b) => {
      // Always push completed/cancelled to bottom
      const aActive = a.status !== 'completada' && a.status !== 'cancelada' ? 0 : 1
      const bActive = b.status !== 'completada' && b.status !== 'cancelada' ? 0 : 1
      if (aActive !== bActive) return aActive - bActive

      let cmp = 0
      switch (sortField) {
        case 'dueDate': {
          cmp = daysBetween(a.dueDate, b.dueDate)
          break
        }
        case 'priority': {
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
          break
        }
        case 'category': {
          cmp = a.category.localeCompare(b.category)
          break
        }
        case 'createdAt': {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        }
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [reminders, filterCategory, filterPriority, filterStatus, filterBatch, filterOrigin, searchQuery, sortField, sortDir])

  const activeReminders = useMemo(() => filteredReminders.filter(r => r.status !== 'completada' && r.status !== 'cancelada'), [filteredReminders])
  const completedReminders = useMemo(() => filteredReminders.filter(r => r.status === 'completada' || r.status === 'cancelada'), [filteredReminders])

  const hasUrgentAlert = stats.overdue > 0 || stats.urgente > 0

  // ---- CRUD Handlers ----
  const openAddForm = () => {
    setEditingId(null)
    setFormData(createEmptyReminder())
    setShowForm(true)
  }

  const openEditForm = (r: Reminder) => {
    setEditingId(r.id)
    setFormData({ ...r })
    setShowForm(true)
    setExpandedId(null)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(createEmptyReminder())
  }

  const saveReminder = () => {
    if (!formData.title.trim()) return
    if (!formData.dueDate) return

    if (editingId) {
      setReminders(prev => prev.map(r => r.id === editingId ? { ...formData } : r))
    } else {
      const newReminder: Reminder = {
        ...formData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      }
      setReminders(prev => [newReminder, ...prev])
    }
    cancelForm()
  }

  const deleteReminder = (id: string) => {
    if (!confirm('¿Eliminar este recordatorio?')) return
    setReminders(prev => prev.filter(r => r.id !== id))
    if (editingId === id) cancelForm()
  }

  const completeReminder = (id: string) => {
    setReminders(prev => prev.map(r => {
      if (r.id !== id) return r
      const completedAt = new Date().toISOString()
      const updated = { ...r, status: 'completada' as ReminderStatus, completedAt }

      // Recurrence logic: create next instance
      if (r.recurrence !== 'unica' && r.recurrenceEnd) {
        const nextDate = addRecurrenceDays(r.dueDate, r.recurrence)
        if (nextDate <= r.recurrenceEnd) {
          const nextReminder: Reminder = {
            ...r,
            id: generateId(),
            dueDate: nextDate,
            status: 'pendiente',
            completedAt: '',
            createdAt: new Date().toISOString(),
          }
          setTimeout(() => {
            setReminders(prev2 => [nextReminder, ...prev2])
          }, 0)
        }
      } else if (r.recurrence !== 'unica') {
        const nextDate = addRecurrenceDays(r.dueDate, r.recurrence)
        const nextReminder: Reminder = {
          ...r,
          id: generateId(),
          dueDate: nextDate,
          status: 'pendiente',
          completedAt: '',
          createdAt: new Date().toISOString(),
        }
        setTimeout(() => {
          setReminders(prev2 => [nextReminder, ...prev2])
        }, 0)
      }

      return updated
    }))
  }

  const snoozeReminder = (id: string) => {
    setReminders(prev => prev.map(r =>
      r.id === id ? { ...r, dueDate: addDays(r.dueDate, 1) } : r
    ))
  }

  const completeAllOverdue = () => {
    const overdueIds = reminders
      .filter(r => r.status === 'pendiente' && daysBetween(today, r.dueDate) < 0)
      .map(r => r.id)
    if (overdueIds.length === 0) return
    if (!confirm(`¿Marcar ${overdueIds.length} recordatorio(s) vencido(s) como completados?`)) return
    setReminders(prev => prev.map(r =>
      overdueIds.includes(r.id)
        ? { ...r, status: 'completada' as ReminderStatus, completedAt: new Date().toISOString() }
        : r
    ))
  }

  const clearOldCompleted = () => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const oldIds = reminders.filter(r => {
      if (r.status !== 'completada' && r.status !== 'cancelada') return false
      if (!r.completedAt) return true
      return new Date(r.completedAt) < thirtyDaysAgo
    }).map(r => r.id)
    if (oldIds.length === 0) return
    if (!confirm(`¿Eliminar ${oldIds.length} recordatorio(s) completados/cancelados de hace más de 30 días?`)) return
    setReminders(prev => prev.filter(r => !oldIds.includes(r.id)))
  }

  const handlePrint = () => {
    setPrintMode(true)
    setTimeout(() => {
      window.print()
      setPrintMode(false)
    }, 200)
  }

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const getBatchName = (batchId: string) => {
    if (!batchId) return null
    const b = batches.find(b2 => b2.id === batchId)
    return b ? b.name : null
  }

  // ---- Render helper for a single reminder card ----
  const renderReminderCard = (r: Reminder, isOverdue: boolean) => {
    const catConfig = CATEGORY_CONFIG[r.category]
    const priConfig = PRIORITY_CONFIG[r.priority]
    const staConfig = STATUS_CONFIG[r.status]
    const countdown = getCountdownText(r.dueDate)
    const CatIcon = catConfig.icon
    const isExpanded = expandedId === r.id
    const batchName = getBatchName(r.batchId)
    const isCancelled = r.status === 'cancelada'

    return (
      <div
        key={r.id}
        className={`rounded-lg border ${priConfig.border} border-l-4 ${priConfig.bg} ${
          isOverdue && r.status === 'pendiente' ? 'ring-2 ring-red-200 ring-offset-1' : ''
        } ${isCancelled ? 'opacity-60' : ''} transition-all`}
      >
        <div className="p-3">
          {/* Top row: icon, title, badges */}
          <div className="flex items-start gap-2">
            <CatIcon className={`w-4 h-4 mt-0.5 shrink-0 ${catConfig.color}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-bold ${isCancelled ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                  {r.title}
                </span>
                <Badge className={`${priConfig.badge} text-[9px] px-1.5 py-0 border-0 font-medium`}>
                  {priConfig.label}
                </Badge>
                <Badge className={`${staConfig.badge} text-[9px] px-1.5 py-0 border-0 font-medium`}>
                  {r.status === 'completada' && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                  {staConfig.label}
                </Badge>
                {r.autoSource && (
                  <Badge className={`${AUTO_SOURCE_COLORS[r.autoSource] || 'bg-stone-100 text-stone-500'} text-[8px] px-1.5 py-0 border font-medium flex items-center gap-0.5`}>
                    <Sparkles className="w-2 h-2" />
                    {AUTO_SOURCE_LABELS[r.autoSource] || 'Auto'}
                  </Badge>
                )}
              </div>
              {r.description && (
                <p className="text-[10px] text-stone-500 mt-0.5 line-clamp-1">
                  {r.description}
                </p>
              )}
            </div>
          </div>

          {/* Second row: date, batch, cost, recurrence */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={`text-[10px] flex items-center gap-0.5 ${countdown.className}`}>
              <Calendar className="w-3 h-3" />
              {r.dueDate}
              {r.dueTime && <Timer className="w-2.5 h-2.5 ml-0.5" />}
              {r.dueTime && <span>{r.dueTime}</span>}
              <span className="ml-1">· {countdown.text}</span>
            </span>
            {batchName && (
              <Badge variant="outline" className="text-[8px] px-1 py-0">{batchName}</Badge>
            )}
            {r.estimatedCost > 0 && (
              <span className="text-[10px] text-green-700 font-medium">{fmtRD(r.estimatedCost)}</span>
            )}
            {r.recurrence !== 'unica' && (
              <span className="text-[9px] text-stone-400 flex items-center gap-0.5">
                <RotateCcw className="w-2.5 h-2.5" />
                {RECURRENCE_LABELS[r.recurrence]}
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 mt-2">
            {r.status !== 'completada' && r.status !== 'cancelada' && (
              <>
                <Button
                  variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => completeReminder(r.id)} title="Completar"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="sm" className="h-6 w-6 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                  onClick={() => snoozeReminder(r.id)} title="Posponer 24h"
                >
                  <Clock className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-stone-600 hover:bg-stone-50"
              onClick={() => openEditForm(r)} title="Editar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-red-500 hover:bg-red-50"
              onClick={() => deleteReminder(r.id)} title="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0 text-stone-400 hover:text-stone-600 hover:bg-stone-50 ml-auto"
              onClick={() => setExpandedId(isExpanded ? null : r.id)}
              title="Ver detalles"
            >
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {/* Expanded details */}
          {isExpanded && (
            <div className="mt-2 pt-2 border-t border-stone-200 space-y-1.5">
              {r.assignedTo && (
                <p className="text-[10px] text-stone-500">
                  <span className="font-medium text-stone-600">Asignado a:</span> {r.assignedTo}
                </p>
              )}
              {r.notes && (
                <p className="text-[10px] text-stone-500">
                  <span className="font-medium text-stone-600">Notas:</span> {r.notes}
                </p>
              )}
              {r.recurrence !== 'unica' && r.recurrenceEnd && (
                <p className="text-[10px] text-stone-400">
                  Recurrencia hasta: {r.recurrenceEnd}
                </p>
              )}
              <p className="text-[9px] text-stone-300">
                Creado: {new Date(r.createdAt).toLocaleString('es-DO')}
                {r.completedAt && ` · Completado: ${new Date(r.completedAt).toLocaleString('es-DO')}`}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ================================================================
  // PRINT VIEW
  // ================================================================
  if (printMode) {
    return (
      <div ref={printRef} className="p-6 bg-white text-black print:m-0 print:p-4">
        <div className="text-center mb-6">
          <h1 className="text-lg font-bold">Granja Nidal — Recordatorios Activos</h1>
          <p className="text-xs text-stone-500">Impreso: {new Date().toLocaleDateString('es-DO')}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px]">Categoría</TableHead>
              <TableHead className="text-[10px]">Título</TableHead>
              <TableHead className="text-[10px]">Prioridad</TableHead>
              <TableHead className="text-[10px]">Estado</TableHead>
              <TableHead className="text-[10px]">Fecha Venc.</TableHead>
              <TableHead className="text-[10px]">Lote</TableHead>
              <TableHead className="text-[10px] text-right">Costo</TableHead>
              <TableHead className="text-[10px]">Asignado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeReminders.map(r => {
              const batchName = getBatchName(r.batchId)
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-[10px]">{CATEGORY_CONFIG[r.category].label}</TableCell>
                  <TableCell className="text-[10px] font-medium">{r.title}</TableCell>
                  <TableCell className="text-[10px]">
                    <Badge className={`${PRIORITY_CONFIG[r.priority].badge} text-[8px] border-0`}>
                      {PRIORITY_CONFIG[r.priority].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px]">
                    <Badge className={`${STATUS_CONFIG[r.status].badge} text-[8px] border-0`}>
                      {STATUS_CONFIG[r.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px]">{r.dueDate} {r.dueTime}</TableCell>
                  <TableCell className="text-[10px]">{batchName || '-'}</TableCell>
                  <TableCell className="text-[10px] text-right">{r.estimatedCost > 0 ? fmtRD(r.estimatedCost) : '-'}</TableCell>
                  <TableCell className="text-[10px]">{r.assignedTo || '-'}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {activeReminders.length === 0 && (
          <p className="text-center text-sm text-stone-400 py-8">No hay recordatorios activos.</p>
        )}
        <div className="mt-4 text-[9px] text-stone-400 text-center">
          Total activos: {stats.active} · Urgentes: {stats.urgente} · Vencidos: {stats.overdue}
        </div>
        <style jsx>{`
          @media print {
            body * { visibility: hidden; }
            div[class*="print"] > * { visibility: visible; }
          }
        `}</style>
      </div>
    )
  }

  // ================================================================
  // MAIN RENDER
  // ================================================================
  return (
    <div className="space-y-4" id="reminders-panel">
      {/* ---- Alert Banner ---- */}
      {hasUrgentAlert && (
        <Alert className="border-red-300 bg-red-50 animate-pulse">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-xs text-red-800">
            <strong>¡Atención!</strong> Tienes{' '}
            <button
              className="underline font-bold"
              onClick={() => { setFilterPriority('urgente'); setFilterStatus('pendiente') }}
            >
              {stats.overdue + stats.urgente} recordatorio(s) urgente(s)
            </button>
            {stats.overdue > 0 && ` (${stats.overdue} vencido${stats.overdue !== 1 ? 's' : ''})`}
            {stats.dueToday > 0 && ` (${stats.dueToday} para hoy)`}.
          </AlertDescription>
        </Alert>
      )}

      {/* ---- Stats Dashboard ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Bell className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-medium text-stone-500">Activos</span>
            </div>
            <p className="text-lg font-bold text-blue-700">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-[10px] font-medium text-stone-500">Urgentes</span>
            </div>
            <p className="text-lg font-bold text-red-700">{stats.urgente + stats.overdue}</p>
            <p className="text-[9px] text-stone-400">{stats.overdue} vencidos</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-medium text-stone-500">Próx. 7 días</span>
            </div>
            <p className="text-lg font-bold text-amber-700">{stats.next7}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span className="text-[10px] font-medium text-stone-500">Completadas/Mes</span>
            </div>
            <p className="text-lg font-bold text-green-700">{stats.completedThisMonth}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500 hidden lg:block">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <ClipboardCheck className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[10px] font-medium text-stone-500">Vencidos</span>
            </div>
            <p className="text-lg font-bold text-red-600">{stats.overdue}</p>
            {stats.overdue > 0 && (
              <button
                className="text-[9px] text-violet-600 hover:underline cursor-pointer"
                onClick={completeAllOverdue}
              >
                Completar todos →
              </button>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-indigo-500 hidden lg:block">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-[10px] font-medium text-stone-500">Auto-generadas</span>
            </div>
            <p className="text-lg font-bold text-indigo-700">{stats.autoActive}</p>
            <p className="text-[9px] text-stone-400">{stats.manualActive} manuales</p>
            {stats.autoActive > 0 && (
              <button
                className="text-[9px] text-indigo-600 hover:underline cursor-pointer"
                onClick={() => setFilterOrigin('auto')}
              >
                Ver auto →
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Toolbar ---- */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[140px]">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-stone-400" />
              <Input
                placeholder="Buscar recordatorio..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-stone-400" />

              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="h-8 text-[10px] rounded-md border border-input bg-background px-2"
              >
                <option value="all">Todas categorías</option>
                {(Object.keys(CATEGORY_CONFIG) as ReminderCategory[]).map(k => (
                  <option key={k} value={k}>{CATEGORY_CONFIG[k].label}</option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="h-8 text-[10px] rounded-md border border-input bg-background px-2"
              >
                <option value="all">Toda prioridad</option>
                {(Object.keys(PRIORITY_CONFIG) as ReminderPriority[]).map(k => (
                  <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-8 text-[10px] rounded-md border border-input bg-background px-2"
              >
                <option value="all">Todo estado</option>
                {(Object.keys(STATUS_CONFIG) as ReminderStatus[]).map(k => (
                  <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
                ))}
              </select>

              {batches.length > 0 && (
                <select
                  value={filterBatch}
                  onChange={e => setFilterBatch(e.target.value)}
                  className="h-8 text-[10px] rounded-md border border-input bg-background px-2"
                >
                  <option value="all">Todos lotes</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
              <select
                value={filterOrigin}
                onChange={e => setFilterOrigin(e.target.value)}
                className="h-8 text-[10px] rounded-md border border-input bg-background px-2"
              >
                <option value="all">Todo origen</option>
                <option value="auto">Auto-generadas</option>
                <option value="manual">Manuales</option>
              </select>
            </div>

            {/* Sort */}
            <button
              onClick={() => toggleSort('dueDate')}
              className="h-8 text-[10px] rounded-md border border-input bg-background px-2 flex items-center gap-1 hover:bg-stone-50 transition-colors"
              title="Ordenar por fecha"
            >
              <ArrowUpDown className="w-3 h-3" />
              Fecha
              {sortField === 'dueDate' && <span className="text-stone-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>

            <button
              onClick={() => toggleSort('priority')}
              className="h-8 text-[10px] rounded-md border border-input bg-background px-2 flex items-center gap-1 hover:bg-stone-50 transition-colors"
              title="Ordenar por prioridad"
            >
              <ArrowUpDown className="w-3 h-3" />
              Prioridad
              {sortField === 'priority' && <span className="text-stone-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
            </button>
          </div>

          <Separator className="my-2.5" />

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={openAddForm} className="gap-1 text-xs h-8 bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-3.5 h-3.5" /> Agregar Recordatorio
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-[10px] h-7">
              <Printer className="w-3 h-3" /> Imprimir
            </Button>
            {stats.overdue > 0 && (
              <Button variant="outline" size="sm" onClick={completeAllOverdue} className="gap-1 text-[10px] h-7 text-red-600 border-red-200 hover:bg-red-50">
                <CheckCircle2 className="w-3 h-3" /> Completar todo vencido
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={clearOldCompleted} className="gap-1 text-[10px] h-7 text-stone-500">
              <Trash2 className="w-3 h-3" /> Limpiar completadas
            </Button>
            <span className="ml-auto text-[10px] text-stone-400">
              {filteredReminders.length} resultado{filteredReminders.length !== 1 ? 's' : ''}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ---- Add/Edit Form ---- */}
      <Collapsible open={showForm} onOpenChange={open => { if (!open) cancelForm() }}>
        <CollapsibleContent>
          <Card className="border-dashed border-2 border-green-300 bg-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs flex items-center gap-2">
                {editingId ? <Edit3 className="w-3.5 h-3.5 text-stone-600" /> : <Plus className="w-3.5 h-3.5 text-green-600" />}
                {editingId ? 'Editar Recordatorio' : 'Nuevo Recordatorio'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {/* Title */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[10px]">Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Ej: Comprar alimento postura"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[10px]">Descripción</Label>
                  <Input
                    value={formData.description}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Descripción breve..."
                  />
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Categoría</Label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData(p => ({ ...p, category: e.target.value as ReminderCategory }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full"
                  >
                    {(Object.keys(CATEGORY_CONFIG) as ReminderCategory[]).map(k => (
                      <option key={k} value={k}>{CATEGORY_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Prioridad</Label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData(p => ({ ...p, priority: e.target.value as ReminderPriority }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full"
                  >
                    {(Object.keys(PRIORITY_CONFIG) as ReminderPriority[]).map(k => (
                      <option key={k} value={k}>{PRIORITY_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>

                {/* Due Date */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Fecha Vencimiento *</Label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Due Time */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Hora (opcional)</Label>
                  <Input
                    type="time"
                    value={formData.dueTime}
                    onChange={e => setFormData(p => ({ ...p, dueTime: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>

                {/* Batch */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Lote (opcional)</Label>
                  <select
                    value={formData.batchId}
                    onChange={e => setFormData(p => ({ ...p, batchId: e.target.value }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full"
                  >
                    <option value="">Ninguno</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                {/* Recurrence */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Recurrencia</Label>
                  <select
                    value={formData.recurrence}
                    onChange={e => setFormData(p => ({ ...p, recurrence: e.target.value as ReminderRecurrence }))}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full"
                  >
                    {(Object.keys(RECURRENCE_LABELS) as ReminderRecurrence[]).map(k => (
                      <option key={k} value={k}>{RECURRENCE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>

                {/* Recurrence End */}
                {formData.recurrence !== 'unica' && (
                  <div className="space-y-1">
                    <Label className="text-[10px]">Fin Recurrencia</Label>
                    <Input
                      type="date"
                      value={formData.recurrenceEnd}
                      onChange={e => setFormData(p => ({ ...p, recurrenceEnd: e.target.value }))}
                      className="h-8 text-xs"
                      placeholder="Fecha límite"
                    />
                  </div>
                )}

                {/* Estimated Cost */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Costo Estimado (RD$)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.estimatedCost || ''}
                    onChange={e => setFormData(p => ({ ...p, estimatedCost: parseFloat(e.target.value) || 0 }))}
                    className="h-8 text-xs"
                    placeholder="0.00"
                  />
                </div>

                {/* Assigned To */}
                <div className="space-y-1">
                  <Label className="text-[10px]">Asignado a</Label>
                  <Input
                    value={formData.assignedTo}
                    onChange={e => setFormData(p => ({ ...p, assignedTo: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Nombre..."
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <Label className="text-[10px]">Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  className="text-xs min-h-[60px]"
                  placeholder="Notas adicionales..."
                  rows={2}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" onClick={saveReminder} className="gap-1 text-xs h-8 bg-green-600 hover:bg-green-700 text-white">
                  <Save className="w-3.5 h-3.5" /> {editingId ? 'Guardar Cambios' : 'Guardar'}
                </Button>
                <Button variant="outline" size="sm" onClick={cancelForm} className="gap-1 text-xs h-8">
                  <X className="w-3.5 h-3.5" /> Cancelar
                </Button>
                {/* Priority preview */}
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[9px] text-stone-400">Vista previa:</span>
                  <Badge className={`${PRIORITY_CONFIG[formData.priority].badge} text-[9px] px-1.5 py-0 border-0`}>
                    {PRIORITY_CONFIG[formData.priority].label}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* ---- Active Reminders List ---- */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-600" />
            Recordatorios Activos
            <Badge variant="outline" className="text-[9px] ml-1">{activeReminders.length}</Badge>
          </CardTitle>
          <CardDescription className="text-[11px]">
            Lista de recordatorios pendientes y en progreso. Haz clic en 👁 para ver detalles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeReminders.length > 0 ? (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {activeReminders.map(r => {
                const isOverdue = r.status === 'pendiente' && daysBetween(today, r.dueDate) < 0
                return renderReminderCard(r, isOverdue)
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-stone-400">
              <Bell className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">No hay recordatorios activos.</p>
              <p className="text-[10px] text-stone-300 mt-1">Haz clic en &quot;Agregar Recordatorio&quot; para crear uno.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Completed Section ---- */}
      <Collapsible open={showCompleted} onOpenChange={setShowCompleted}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <CardHeader className="pb-2 cursor-pointer hover:bg-stone-50/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2 text-stone-500">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Completadas y Canceladas
                  <Badge variant="outline" className="text-[9px] ml-1">{completedReminders.length}</Badge>
                </CardTitle>
                {showCompleted ? (
                  <ChevronUp className="w-4 h-4 text-stone-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-stone-400" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {completedReminders.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {completedReminders.map(r => renderReminderCard(r, false))}
                </div>
              ) : (
                <div className="text-center py-6 text-stone-300">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-1 opacity-20" />
                  <p className="text-[10px]">No hay recordatorios completados ni cancelados.</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ---- Print styles ---- */}
      <style jsx global>{`
        @media print {
          body > *:not(#reminders-panel) {
            display: none !important;
          }
          #reminders-panel > *:not(.print\\:block) {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  )
}
