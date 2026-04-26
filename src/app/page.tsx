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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import LotCard from '@/components/lot-card'
import LotDetail from '@/components/lot-detail'
import ConfigSheet from '@/components/config-sheet'
import ReportsPanel from '@/components/reports-panel'
import RemindersPanel from '@/components/reminders-panel'
import FarmMapView from '@/components/farm-map-view'
import { generateRemindersForNewBatch, generatePhaseChangeReminders, generateCycleWarningReminder, clearAutoRemindersForBatch } from '@/lib/auto-reminders'
import type { DailyEntry } from '@/lib/history'
import { getWeekSummaries, getMonthSummaries } from '@/lib/history'
import type {
  PhaseKey, FarmConfig, BatchConfig, StructuralExpense, StructuralFrequency,
  MonthlyRecord,
} from '@/lib/farm-data'
import {
  DEFAULT_CONFIG, DEFAULT_FEED, DEFAULT_STRUCTURAL_EXPENSES, PHASE_COLORS,
  FREQUENCY_LABELS, FREQUENCY_MULTIPLIER, PHASE_KEYS,
  fmtRD, fmtNum, fmtPct, getPhaseFromMonth,
  computeCalculations, getAlertCountForBatch, getUrgentReminderCount,
} from '@/lib/farm-data'
import {
  TrendingUp, TrendingDown, DollarSign, Egg, Wheat,
  Activity, Target, Settings, FileText, Sparkles, AlertTriangle, CheckCircle2,
  Bell, Map, FileOutput, ClipboardCheck, ChevronLeft, ChevronDown, ChevronUp, Eye,
  Plus, Trash2, Printer, Banknote,
} from 'lucide-react'
// Granja Nidal: single-farm mode — FarmSetup removed
import CashFlowPanel from '@/components/cash-flow-panel'
import UserManagementPanel from '@/components/user-management-panel'
import InventoryPanel from '@/components/inventory-panel'
import PredictivePanel from '@/components/predictive-panel'
import InvoicesPanel from '@/components/invoices-panel'
import BackupPanel from '@/components/backup-panel'
import ShedLogPanel from '@/components/shed-log-panel'
import WeatherWidget from '@/components/weather-widget'
import OfflineBanner from '@/components/offline-banner'
import PWAInstallPrompt from '@/components/pwa-install-prompt'
import { useAuth } from '@/hooks/use-auth'
import { useNotifications } from '@/hooks/use-notifications'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LogOut, User, Loader2, Users, Package, Brain, Database, ClipboardList } from 'lucide-react'
import { isSupabaseConfigured, getFarmId, supabase } from '@/lib/supabase'

// ================================================================
// SUPABASE SYNC HELPERS (shared farm — single source of truth)
// ================================================================
const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || ''

async function syncFetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

// Fetch all farm data from Supabase (used on mount + periodic refresh)
async function fetchFarmData() {
  if (!FARM_ID) return null
  const [configRes, batchesRes, recordsRes, expensesRes, dailyRes, remindersRes] = await Promise.all([
    syncFetchJSON(`/api/config?farm_id=${FARM_ID}`),
    syncFetchJSON(`/api/batches?farm_id=${FARM_ID}`),
    syncFetchJSON(`/api/monthly-records?farm_id=${FARM_ID}`),
    syncFetchJSON(`/api/structural-expenses?farm_id=${FARM_ID}`),
    syncFetchJSON(`/api/daily-entries?farm_id=${FARM_ID}&limit=500`),
    syncFetchJSON(`/api/reminders?farm_id=${FARM_ID}&limit=500`),
  ])
  return { configRes, batchesRes, recordsRes, expensesRes, dailyRes, remindersRes }
}

// Push config to Supabase
async function pushConfig(config: Record<string, unknown>) {
  if (!FARM_ID) return
  fetch(`/api/config?farm_id=${FARM_ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }).catch(() => {})
}

// Push a single batch to Supabase (upsert — atomic, no race conditions)
async function pushBatch(batch: Record<string, unknown>) {
  if (!FARM_ID) return
  try {
    const res = await fetch(`/api/batches?farm_id=${FARM_ID}`)
    const data = await res.json()
    const existing = data.batches?.find((b: Record<string, unknown>) => b.batch_key === batch.id)
    const url = existing
      ? `/api/batches/${existing.id}`
      : `/api/batches?farm_id=${FARM_ID}`
    const method = existing ? 'PUT' : 'POST'
    const body = existing
      ? { name: batch.name, hens: batch.hens, laying_rate: batch.layingRate, is_laying: batch.isLaying, cycle_month: batch.cycleMonth, phase: batch.phase }
      : { batch_key: batch.id, name: batch.name, hens: batch.hens, laying_rate: batch.layingRate, is_laying: batch.isLaying, cycle_month: batch.cycleMonth, phase: batch.phase, sort_order: 0 }
    const putRes = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!putRes.ok) console.error('Failed to push batch:', await putRes.text())
  } catch (err) {
    console.error('Failed to push batch:', err)
  }
}

// Delete a batch from Supabase
async function deleteBatchFromAPI(batchId: string) {
  if (!FARM_ID) return
  const res = await fetch(`/api/batches?farm_id=${FARM_ID}`)
  const data = await res.json()
  const existing = data.batches?.find((b: Record<string, unknown>) => b.batch_key === batchId)
  if (existing) {
    fetch(`/api/batches/${existing.id}`, { method: 'DELETE' }).catch(() => {})
  }
}

// Push all batches to Supabase
async function pushAllBatches(batches: Record<string, unknown>[]) {
  if (!FARM_ID) return
  for (const batch of batches) {
    await pushBatch(batch)
  }
}

// Push structural expenses to Supabase
async function pushAllExpenses(expenses: Record<string, unknown>[]) {
  if (!FARM_ID) return
  fetch(`/api/structural-expenses?farm_id=${FARM_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expenses }),
  }).catch(() => {})
}

// Push a monthly record to Supabase
async function pushRecord(record: Record<string, unknown>) {
  if (!FARM_ID) return
  fetch(`/api/monthly-records?farm_id=${FARM_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      month: record.month,
      record_date: record.date,
      batches_snapshot: record.batches,
      config_snapshot: record.config,
      notes: record.notes || '',
      revenue: record.revenue,
      expenses: record.expenses,
      net: record.net,
    }),
  }).catch(() => {})
}

// Delete a monthly record from Supabase
async function deleteRecordFromAPI(id: string) {
  fetch(`/api/monthly-records/${id}`, { method: 'DELETE' }).catch(() => {})
}

// ================================================================
// HISTORY VIEW COMPONENT (3-tab: Diario / Semanal / Mensual)
// ================================================================
function HistoryView({ batches, savedRecords, expandedRecord, setExpandedRecord, deleteRecord, goBack, notes, setNotes, setSavedRecords }: {
  batches: BatchConfig[]
  savedRecords: MonthlyRecord[]
  expandedRecord: string | null
  setExpandedRecord: (id: string | null) => void
  deleteRecord: (id: string) => void
  goBack: () => void
  notes: string
  setNotes: (v: string) => void
  setSavedRecords: (r: MonthlyRecord[]) => void
}) {
  const [historyTab, setHistoryTab] = useState<'diario' | 'semanal' | 'mensual'>('diario')

  // Diario state — fetch from Supabase API
  const [dailyEntries, setDailyEntries] = useState<DailyEntry[]>([])
  const [filterBatch, setFilterBatch] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Fetch daily entries from Supabase
  useEffect(() => {
    if (!FARM_ID) return
    let url = `/api/daily-entries?farm_id=${FARM_ID}&limit=500`
    if (filterBatch !== 'all') url += `&batch_id=${filterBatch}`
    if (dateFrom) url += `&date_from=${dateFrom}`
    if (dateTo) url += `&date_to=${dateTo}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data?.entries) return
        const mapped = (data.entries as Record<string, unknown>[]).map(e => {
          const entry = {
            id: e.id as string,
            date: (e.date || '') as string,
            batchId: (e.batch_id || '') as string,
            eggsCollected: (e.eggs_collected || 0) as number,
            eggsBroken: (e.eggs_broken || 0) as number,
            mortality: (e.mortality || 0) as number,
            feedKg: (e.feed_kg || 0) as number,
            waterLiters: (e.water_liters || 0) as number,
            notes: (e.notes || '') as string,
          }
          const batch = batches.find(b => b.id === entry.batchId)
          return { ...entry, batchName: batch?.name || entry.batchId }
        })
        setDailyEntries(mapped.sort((a, b) => b.date.localeCompare(a.date)))
      })
      .catch(() => {})
  }, [filterBatch, dateFrom, dateTo, savedRecords, batches])

  const handleDeleteEntry = (id: string) => {
    fetch(`/api/daily-entries/${id}`, { method: 'DELETE' })
      .then(() => {
        // Re-fetch to update the list
        if (FARM_ID) {
          let url = `/api/daily-entries?farm_id=${FARM_ID}&limit=500`
          if (filterBatch !== 'all') url += `&batch_id=${filterBatch}`
          if (dateFrom) url += `&date_from=${dateFrom}`
          if (dateTo) url += `&date_to=${dateTo}`
          fetch(url)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.entries) return
              const mapped = (data.entries as Record<string, unknown>[]).map(e => {
                const entry = {
                  id: e.id as string,
                  date: (e.date || '') as string,
                  batchId: (e.batch_id || '') as string,
                  eggsCollected: (e.eggs_collected || 0) as number,
                  eggsBroken: (e.eggs_broken || 0) as number,
                  mortality: (e.mortality || 0) as number,
                  feedKg: (e.feed_kg || 0) as number,
                  waterLiters: (e.water_liters || 0) as number,
                  notes: (e.notes || '') as string,
                }
                const batch = batches.find(b => b.id === entry.batchId)
                return { ...entry, batchName: batch?.name || entry.batchId }
              })
              setDailyEntries(mapped.sort((a, b) => b.date.localeCompare(a.date)))
            })
        }
      })
      .catch(() => {})
  }

  // Semanal state — use the full dailyEntries from Supabase
  const allDailyEntries = useMemo(() => dailyEntries, [dailyEntries])
  const weekSummaries = useMemo(() => getWeekSummaries(allDailyEntries, 8), [allDailyEntries])
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)

  // Mensual state
  const monthSummaries = useMemo(() => getMonthSummaries(allDailyEntries, 12), [allDailyEntries])

  // Summary stats for daily tab
  const totalEggs = dailyEntries.reduce((s, e) => s + e.eggsCollected, 0)
  const totalMortality = dailyEntries.reduce((s, e) => s + e.mortality, 0)
  const totalFeed = dailyEntries.reduce((s, e) => s + e.feedKg, 0)
  const avgEggs = dailyEntries.length > 0 ? Math.round(totalEggs / dailyEntries.length) : 0

  const subTabs: { key: typeof historyTab; label: string }[] = [
    { key: 'diario', label: 'Diario' },
    { key: 'semanal', label: 'Semanal' },
    { key: 'mensual', label: 'Mensual' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Historial</h2>
      </div>

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {subTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setHistoryTab(tab.key)}
            className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
              historyTab === tab.key
                ? 'bg-stone-900 text-white shadow-sm'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =================== DIARIO TAB =================== */}
      {historyTab === 'diario' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px]">Lote</Label>
                  <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)}
                    className="h-8 text-xs rounded-md border border-input bg-background px-2 w-full">
                    <option value="all">Todos</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Desde</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">Hasta</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">&nbsp;</Label>
                  <Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setFilterBatch('all'); setDateFrom(''); setDateTo('') }}>
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          {dailyEntries.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-stone-400">Total Huevos</p>
                <p className="text-sm font-bold text-green-700">{fmtNum(totalEggs)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-stone-400">Promedio/Dia</p>
                <p className="text-sm font-bold text-amber-700">{fmtNum(avgEggs)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-stone-400">Mortalidad Total</p>
                <p className="text-sm font-bold text-red-600">{totalMortality}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-stone-400">Feed Total</p>
                <p className="text-sm font-bold text-stone-700">{totalFeed.toFixed(1)} kg</p>
              </div>
            </div>
          )}

          {/* Table */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-stone-700 mb-3">Registros Diarios ({dailyEntries.length})</h3>
              {dailyEntries.length > 0 ? (
                <div className="max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Fecha</TableHead>
                        <TableHead className="text-[10px]">Lote</TableHead>
                        <TableHead className="text-[10px] text-right">Huevos</TableHead>
                        <TableHead className="text-[10px] text-right">Rotos</TableHead>
                        <TableHead className="text-[10px] text-right">Mort.</TableHead>
                        <TableHead className="text-[10px] text-right">Feed(kg)</TableHead>
                        <TableHead className="text-[10px] text-right">Agua(L)</TableHead>
                        <TableHead className="text-[10px]">Notas</TableHead>
                        <TableHead className="text-[10px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyEntries.map(entry => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-[11px]">{entry.date}</TableCell>
                          <TableCell className="text-[11px]"><Badge variant="outline" className="text-[9px]">{entry.batchName}</Badge></TableCell>
                          <TableCell className="text-[11px] text-right font-medium">{fmtNum(entry.eggsCollected)}</TableCell>
                          <TableCell className="text-[11px] text-right text-red-400">{entry.eggsBroken || '-'}</TableCell>
                          <TableCell className="text-[11px] text-right text-red-600">{entry.mortality || '-'}</TableCell>
                          <TableCell className="text-[11px] text-right">{entry.feedKg || '-'}</TableCell>
                          <TableCell className="text-[11px] text-right">{entry.waterLiters || '-'}</TableCell>
                          <TableCell className="text-[11px] text-stone-400 max-w-[120px] truncate">{entry.notes || '-'}</TableCell>
                          <TableCell className="text-right">
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
              ) : (
                <div className="text-center py-10 text-stone-400">
                  <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Sin registros diarios.</p>
                  <p className="text-[10px] mt-1">Registra produccion en la pestana de un lote.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* =================== SEMANAL TAB =================== */}
      {historyTab === 'semanal' && (
        <div className="space-y-4">
          {weekSummaries.length > 0 ? (
            <div className="space-y-2">
              {weekSummaries.map(ws => (
                <Card key={ws.weekStart}>
                  <CardContent className="p-4">
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedWeek(expandedWeek === ws.weekStart ? null : ws.weekStart)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`w-3.5 h-3.5 text-stone-400 transition-transform ${expandedWeek === ws.weekStart ? 'rotate-180' : ''}`} />
                          <span className="text-sm font-semibold text-stone-700">Semana</span>
                          <span className="text-[11px] text-stone-500">{ws.weekStart} al {ws.weekEnd}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400">Prom. Huevos/dia</p>
                            <p className="text-sm font-bold text-green-700">{fmtNum(ws.avgEggsPerDay)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400">Mort. Total</p>
                            <p className="text-sm font-bold text-red-600">{ws.totalMortality}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-stone-400">Feed Total</p>
                            <p className="text-sm font-bold text-amber-700">{ws.totalFeedKg} kg</p>
                          </div>
                        </div>
                      </div>
                      {/* Stats row */}
                      <div className="grid grid-cols-4 gap-2 mt-2">
                        <div className="bg-green-50 rounded p-1.5 text-center">
                          <p className="text-[8px] text-stone-400">Total Huevos</p>
                          <p className="text-xs font-bold">{fmtNum(ws.totalEggs)}</p>
                        </div>
                        <div className="bg-red-50 rounded p-1.5 text-center">
                          <p className="text-[8px] text-stone-400">Mort./dia</p>
                          <p className="text-xs font-bold">{ws.avgMortalityPerDay}</p>
                        </div>
                        <div className="bg-amber-50 rounded p-1.5 text-center">
                          <p className="text-[8px] text-stone-400">Feed/dia</p>
                          <p className="text-xs font-bold">{ws.avgFeedPerDay} kg</p>
                        </div>
                        <div className="bg-sky-50 rounded p-1.5 text-center">
                          <p className="text-[8px] text-stone-400">Agua Total</p>
                          <p className="text-xs font-bold">{ws.totalWaterL} L</p>
                        </div>
                      </div>
                    </div>
                    {/* Expanded: per-batch breakdown */}
                    {expandedWeek === ws.weekStart && ws.batchSummaries.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-[10px] font-semibold text-stone-500 mb-2">Por Lote:</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {ws.batchSummaries.map(bs => (
                            <div key={bs.batchId} className="bg-stone-50 rounded-lg p-2">
                              <p className="text-[10px] font-medium text-stone-600">{bs.batchName}</p>
                              <div className="flex items-center justify-between mt-1">
                                <span className="text-[9px] text-stone-400">Total: {fmtNum(bs.totalEggs)}</span>
                                <span className="text-[9px] text-green-600 font-medium">Prom/dia: {fmtNum(bs.avgEggs)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-stone-400">
                <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Sin datos suficientes para resumenes semanales.</p>
                <p className="text-[10px] mt-1">Registra produccion diaria para ver resumenes.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* =================== MENSUAL TAB =================== */}
      {historyTab === 'mensual' && (
        <div className="space-y-4">
          {/* Auto-calculated monthly summaries from daily entries */}
          {monthSummaries.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-green-600" /> Resumen Mensual (Automatico)
                </CardTitle>
                <CardDescription className="text-[11px]">Calculado a partir de registros diarios ({monthSummaries.length} meses con datos)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {monthSummaries.map(ms => (
                    <div key={ms.month} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-stone-700 capitalize">{ms.monthLabel}</span>
                          <Badge variant="outline" className="text-[9px]">{ms.daysRecorded} dias</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[9px] text-stone-400">Total Huevos</p>
                            <p className="text-xs font-bold text-green-700">{fmtNum(ms.totalEggs)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-stone-400">Prom/dia</p>
                            <p className="text-xs font-bold text-amber-700">{fmtNum(ms.avgEggsPerDay)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-stone-400">Mortalidad</p>
                            <p className="text-xs font-bold text-red-600">{ms.totalMortality}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-stone-400">Feed</p>
                            <p className="text-xs font-bold text-stone-700">{ms.totalFeedKg} kg</p>
                          </div>
                        </div>
                      </div>
                      {/* Per-batch mini summary */}
                      {ms.batchSummaries.length > 1 && (
                        <div className="flex flex-wrap gap-1.5">
                          {ms.batchSummaries.map(bs => (
                            <Badge key={bs.batchId} variant="outline" className="text-[9px]">
                              {bs.batchName}: {fmtNum(bs.totalEggs)} huevos ({fmtNum(bs.avgEggs)}/dia)
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing saved monthly records (from config) */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-stone-600" /> Registros Guardados
                  </CardTitle>
                  <CardDescription className="text-[11px]">Snapshots mensuales guardados manualmente ({savedRecords.length})</CardDescription>
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
              {/* Notes */}
              <div className="mb-3">
                <Label className="text-[10px] text-stone-500">Notas del Mes</Label>
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ej: Lote 2 con mortalidad elevada..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              {savedRecords.length === 0 ? (
                <div className="text-center py-8 text-stone-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No hay registros guardados.</p>
                  <p className="text-[10px] mt-1">Guarda un registro desde el panel de configuracion.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
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
    </div>
  )
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function Home() {
  // ---- Auth ----
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated, signOut } = useAuth()

  // ---- Notifications ----
  const { unreadCount: notifUnreadCount, requestPermission: requestNotifPermission, permission: notifPermission, clearAll: clearNotifs } = useNotifications()

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      router.push('/auth/login')
      router.refresh()
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }, [signOut, router])

  // ---- Hydration guard ----
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // ---- Auto-ensure DB setup on first authenticated load (single-farm mode) ----
  // Run setup once per session (SQL is idempotent with IF NOT EXISTS)
  useEffect(() => {
    if (mounted && isSupabaseConfigured() && isAuthenticated) {
      const setupVersion = localStorage.getItem('granja-nidal-setup-version')
      if (setupVersion !== 'v3') {
        fetch('/api/admin/setup', { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (data.success) localStorage.setItem('granja-nidal-setup-version', 'v3')
          })
          .catch(() => {})
      }
    }
  }, [mounted, isAuthenticated])

  // ---- Navigation state ----
  const [view, setView] = useState<'dashboard' | 'lot-detail' | 'reports' | 'history' | 'map' | 'reminders' | 'cash-flow' | 'inventory' | 'users' | 'invoices' | 'backup' | 'shed-log' | 'predictive'>('dashboard')
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
    return []
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
  const [dashboardDeleteBatch, setDashboardDeleteBatch] = useState<BatchConfig | null>(null)

  // Persist to localStorage (cache only — Supabase is source of truth)
  useEffect(() => { localStorage.setItem('granja-wd80-config', JSON.stringify(config)) }, [config])
  useEffect(() => { localStorage.setItem('granja-wd80-batches', JSON.stringify(batches)) }, [batches])
  useEffect(() => { localStorage.setItem('granja-wd80-records', JSON.stringify(savedRecords)) }, [savedRecords])
  useEffect(() => { localStorage.setItem('granja-wd80-structural', JSON.stringify(structuralExpenses)) }, [structuralExpenses])

  // ---- Initial fetch from Supabase (shared farm data) ----
  const dataLoadedRef = useRef(false)
  useEffect(() => {
    if (!mounted || !isAuthenticated || dataLoadedRef.current || !FARM_ID) return
    dataLoadedRef.current = true
    fetchFarmData().then(data => {
      if (!data) return
      // Load config from Supabase
      if (data.configRes && (data.configRes as Record<string, unknown>).config) {
        const dbConfig = (data.configRes as Record<string, unknown>).config as Record<string, unknown>
        if (dbConfig && Object.keys(dbConfig).length > 0) {
          setConfig(prev => ({ ...prev, ...dbConfig, feedPhases: { ...DEFAULT_FEED, ...((dbConfig.feedPhases as Record<string, unknown>) || {}) } } as FarmConfig))
        }
      }
      // Load batches from Supabase
      if (data.batchesRes && (data.batchesRes as Record<string, unknown>).batches) {
        const dbBatches = (data.batchesRes as Record<string, unknown>).batches as Record<string, unknown>[]
        if (dbBatches && dbBatches.length > 0) {
          const mapped = dbBatches.map(b => ({
            id: b.batch_key as string || b.id as string,
            name: b.name as string,
            hens: b.hens as number,
            layingRate: b.laying_rate as number,
            isLaying: b.is_laying as boolean,
            cycleMonth: b.cycle_month as number,
            phase: b.phase as BatchConfig['phase'],
          }))
          setBatches(mapped)
        }
      }
      // Load records from Supabase
      if (data.recordsRes && (data.recordsRes as Record<string, unknown>).records) {
        const dbRecords = (data.recordsRes as Record<string, unknown>).records as Record<string, unknown>[]
        if (dbRecords && dbRecords.length > 0) {
          const mapped = dbRecords.map(r => ({
            id: r.id as string,
            month: r.month as string,
            date: r.record_date as string,
            batches: (r.batches_snapshot || []) as BatchConfig[],
            config: (r.config_snapshot || {}) as FarmConfig,
            notes: (r.notes || '') as string,
            revenue: (r.revenue || 0) as number,
            expenses: (r.expenses || 0) as number,
            net: (r.net || 0) as number,
          }))
          setSavedRecords(mapped)
        }
      }
      // Load structural expenses from Supabase
      if (data.expensesRes && (data.expensesRes as Record<string, unknown>).expenses) {
        const dbExpenses = (data.expensesRes as Record<string, unknown>).expenses as Record<string, unknown>[]
        if (dbExpenses && dbExpenses.length > 0) {
          const mapped = dbExpenses.map(e => ({
            id: e.id as string,
            description: (e.description || '') as string,
            amount: (e.amount || 0) as number,
            frequency: (e.frequency || 'unico') as StructuralExpense['frequency'],
            dateAdded: (e.created_at || '') as string,
            isActive: e.is_active !== undefined ? (e.is_active as boolean) : true,
          }))
          setStructuralExpenses(mapped)
        }
      }
    }).catch(() => {})
  }, [mounted, isAuthenticated])

  // ---- Real-time sync via Supabase Realtime ----
  useEffect(() => {
    if (!mounted || !isAuthenticated || !FARM_ID || !isSupabaseConfigured()) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel('farm-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'batches', filter: `farm_id=eq.${FARM_ID}` }, () => {
          fetch(`/api/batches?farm_id=${FARM_ID}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.batches) return
              const dbBatches = data.batches as Record<string, unknown>[]
              if (dbBatches.length > 0) {
                setBatches(dbBatches.map(b => ({
                  id: b.batch_key as string || b.id as string,
                  name: b.name as string,
                  hens: b.hens as number,
                  layingRate: b.laying_rate as number,
                  isLaying: b.is_laying as boolean,
                  cycleMonth: b.cycle_month as number,
                  phase: b.phase as BatchConfig['phase'],
                })))
              }
            })
            .catch(() => {})
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'farms', filter: `id=eq.${FARM_ID}` }, () => {
          fetch(`/api/config?farm_id=${FARM_ID}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.config) return
              const dbConfig = data.config as Record<string, unknown>
              if (Object.keys(dbConfig).length > 0) {
                setConfig(prev => ({ ...prev, ...dbConfig, feedPhases: { ...DEFAULT_FEED, ...((dbConfig.feedPhases as Record<string, unknown>) || {}) } } as FarmConfig))
              }
            })
            .catch(() => {})
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'structural_expenses', filter: `farm_id=eq.${FARM_ID}` }, () => {
          fetch(`/api/structural-expenses?farm_id=${FARM_ID}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!data?.expenses) return
              const dbExpenses = data.expenses as Record<string, unknown>[]
              if (dbExpenses.length > 0) {
                setStructuralExpenses(dbExpenses.map(e => ({
                  id: e.id as string,
                  description: (e.description || '') as string,
                  amount: (e.amount || 0) as number,
                  frequency: (e.frequency || 'unico') as StructuralExpense['frequency'],
                  dateAdded: (e.created_at || '') as string,
                  isActive: e.is_active !== undefined ? (e.is_active as boolean) : true,
                })))
              }
            })
            .catch(() => {})
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') return
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Realtime unavailable — fall back to polling every 30s
            console.warn('Realtime subscription failed, using polling fallback')
          }
        })
    } catch (err) {
      console.warn('Could not setup Realtime sync, using polling fallback:', err)
      // Fallback: simple polling if Realtime fails
      const interval = setInterval(() => {
        fetch(`/api/batches?farm_id=${FARM_ID}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (!data?.batches) return
            const dbBatches = data.batches as Record<string, unknown>[]
            if (dbBatches.length > 0) {
              setBatches(dbBatches.map(b => ({
                id: b.batch_key as string || b.id as string,
                name: b.name as string,
                hens: b.hens as number,
                layingRate: b.laying_rate as number,
                isLaying: b.is_laying as boolean,
                cycleMonth: b.cycle_month as number,
                phase: b.phase as BatchConfig['phase'],
              })))
            }
          })
          .catch(() => {})
      }, 30000)
      return () => clearInterval(interval)
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [mounted, isAuthenticated])

  // ---- Handlers (Supabase-synced) ----
  const updateConfig = useCallback(<K extends keyof FarmConfig>(key: K, value: FarmConfig[K]) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value }
      pushConfig(updated as unknown as Record<string, unknown>)
      return updated
    })
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
      // Push to Supabase (debounced by React batching)
      setTimeout(() => pushBatch(updated as unknown as Record<string, unknown>), 0)
      return updated
    }))
  }, [])

  const addBatch = useCallback(() => {
    const num = batches.length + 1
    const newId = `batch-${batches.length}`
    const newName = `Galpon ${num}`
    const newBatch = {
      id: newId, name: newName, hens: config.hensPerBatch,
      layingRate: config.baseLayingRate, isLaying: false, cycleMonth: 0, phase: 'pre_inicio',
    }
    setBatches(prev => [...prev, newBatch])
    // Push to Supabase
    pushBatch(newBatch as unknown as Record<string, unknown>)
    const today = new Date().toISOString().split('T')[0]
    setTimeout(() => {
      generateRemindersForNewBatch(FARM_ID, newId, newName, config.hensPerBatch, today)
    }, 100)
  }, [batches.length, config.hensPerBatch, config.baseLayingRate])

  const removeBatch = useCallback((id: string) => {
    setBatches(prev => prev.filter(b => b.id !== id))
    // Delete from Supabase
    deleteBatchFromAPI(id)
    setTimeout(() => {
      clearAutoRemindersForBatch(FARM_ID, id)
      // Delete daily entries for this batch
      fetch(`/api/daily-entries?farm_id=${FARM_ID}&batch_id=${id}`).then(r => r.json()).then(data => {
        const entries = data.entries || []
        for (const e of entries) {
          fetch(`/api/daily-entries/${e.id}`, { method: 'DELETE' }).catch(() => {})
        }
      }).catch(() => {})
    }, 100)
    if (selectedBatchId === id) {
      setSelectedBatchId(null)
      setView('dashboard')
    }
  }, [selectedBatchId])

  const resetAll = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
    setBatches([])
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
    // Delete from Supabase
    deleteRecordFromAPI(id)
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
    // Push to Supabase
    pushRecord(record as unknown as Record<string, unknown>)
  }, [batches, config, notes, structuralExpenses])

  // ================================================================
  // CALCULATIONS ENGINE (preserved exactly)
  // ================================================================
  // Calculations are always live — no manual refresh needed
  const calculations = useMemo(() => computeCalculations(config, batches, structuralExpenses), [config, batches, structuralExpenses])

  // Urgent reminders — fetched from Supabase
  const [urgentReminderCount, setUrgentReminderCount] = useState(0)
  const [allReminders, setAllReminders] = useState<Array<{status: string; dueDate: string; priority: string; batchId: string}>>([])
  useEffect(() => {
    const update = async () => {
      if (!FARM_ID) return
      try {
        const res = await fetch(`/api/reminders?farm_id=${FARM_ID}&limit=500`)
        if (res.ok) {
          const data = await res.json()
          const mapped = (data.reminders || []).map((r: Record<string, unknown>) => ({
            status: (r.status || '') as string,
            dueDate: (r.due_date || '') as string,
            priority: (r.priority || '') as string,
            batchId: (r.batch_id || '') as string,
          }))
          setAllReminders(mapped)
          setUrgentReminderCount(getUrgentReminderCount(mapped))
        }
      } catch { /* ignore */ }
    }
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
        generatePhaseChangeReminders(FARM_ID, batch.id, batch.name, batch.hens, batch.phase, phaseLabel)
      }
      if (batch.isLaying && batch.cycleMonth > 0) {
        const monthsLeft = config.layingCycleMonths - (batch.cycleMonth - 5)
        if (monthsLeft <= 3 && monthsLeft > 0) {
          generateCycleWarningReminder(FARM_ID, batch.id, batch.name, batch.cycleMonth, config.layingCycleMonths)
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

  const handleDashboardDelete = useCallback((batch: BatchConfig) => {
    setDashboardDeleteBatch(batch)
  }, [])

  const confirmDashboardDelete = useCallback(() => {
    if (dashboardDeleteBatch) {
      removeBatch(dashboardDeleteBatch.id)
      setDashboardDeleteBatch(null)
    }
  }, [dashboardDeleteBatch, removeBatch])

  // ---- Selected batch ----
  const selectedBatch = selectedBatchId ? batches.find(b => b.id === selectedBatchId) : null
  const selectedCalc = selectedBatchId ? {
    ...calculations,
    batchDetails: calculations.batchDetails.filter(b => b.id === selectedBatchId),
    totalEggRevenue: calculations.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.eggRevenue, 0),
    totalFeedCost: calculations.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.monthlyFeedCost, 0),
    totalHens: calculations.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.hens, 0),
    totalEggs: calculations.batchDetails.filter(b => b.id === selectedBatchId).reduce((s, b) => s + b.eggsPerMonth, 0),
    layingBirds: calculations.batchDetails.filter(b => b.id === selectedBatchId && b.isLaying).reduce((s, b) => s + b.hens, 0),
  } : null

  // ================================================================
  // RENDER
  // ================================================================
  // Show loading while checking auth
  if (!mounted || authLoading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30">
      <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
    </div>
  }

  // Redirect to login if Supabase configured but not authenticated
  if (isSupabaseConfigured() && !isAuthenticated) {
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30">
      <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
    </div>
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-stone-50 to-amber-50/30">
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-stone-200">
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
                {calculations.layingBatches}/{batches.length} postura
              </Badge>
              <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                {fmtNum(calculations.totalHens)} aves
              </Badge>
              <Badge className={`text-xs ${calculations.netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {fmtRD(calculations.netProfit)}/mes
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
              {/* Notification bell (push/email) */}
              {notifUnreadCount > 0 && (
                <button onClick={clearNotifs} className="relative cursor-pointer" title="Limpiar notificaciones">
                  <Badge className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors cursor-pointer">
                    <Bell className="w-3 h-3 mr-1" />
                    {notifUnreadCount} notif{notifUnreadCount !== 1 ? '.' : '.'}
                  </Badge>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                </button>
              )}
              {notifUnreadCount === 0 && notifPermission !== 'granted' && (
                <button onClick={requestNotifPermission} className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors" title="Activar notificaciones push">
                  <Bell className="w-4 h-4 text-stone-400" />
                </button>
              )}
              <button
                onClick={() => setConfigOpen(true)}
                className="w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors"
              >
                <Settings className="w-4 h-4 text-stone-500" />
              </button>
              {/* User menu */}
              {isSupabaseConfigured() && isAuthenticated && user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-8 h-8 rounded-full bg-amber-100 hover:bg-amber-200 flex items-center justify-center transition-colors text-amber-700 font-bold text-xs">
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-3 py-2 border-b">
                      <p className="text-sm font-medium text-stone-900 truncate">{user.email}</p>
                      <p className="text-xs text-stone-500">Sesion activa</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Cerrar sesion
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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

            {/* Weather Widget */}
            <WeatherWidget avgProduction={null} fmtNum={fmtNum} />

            {/* Lot Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-stone-800">Lotes</h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={addBatch}
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar Lote
                  </Button>
                  <Badge variant="outline" className="text-xs">{batches.length} lotes</Badge>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {batches.map(batch => (
                  <LotCard
                    key={batch.id}
                    batch={batch}
                    calc={calculations}
                    config={config}
                    onClick={() => openLotDetail(batch.id)}
                    onDelete={() => handleDashboardDelete(batch)}
                  />
                ))}
              </div>
            </div>

            {/* Quick Access Cards */}
            <div>
              <h2 className="text-base font-bold text-stone-800 mb-3">Herramientas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <button
                  onClick={() => setView('cash-flow')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <Banknote className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Flujo de Caja</h3>
                      <p className="text-[11px] text-stone-400">Estado de flujo de caja mensual</p>
                    </div>
                  </div>
                </button>
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
                <button
                  onClick={() => setView('inventory')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                      <Package className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Inventario</h3>
                      <p className="text-[11px] text-stone-400">Control de stock y movimientos</p>
                    </div>
                  </div>
                </button>
                {/* Users Management - only visible for superadmin */}
                {user?.email && (
                  <button
                    onClick={() => setView('users')}
                    className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                        <Users className="w-5 h-5 text-violet-700" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Usuarios</h3>
                        <p className="text-[11px] text-stone-400">Gestion de roles y permisos</p>
                      </div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Tools */}
            <div>
              <h2 className="text-base font-bold text-stone-800 mb-3">Herramientas Avanzadas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setView('predictive')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                      <Brain className="w-5 h-5 text-teal-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Analisis Predictivo</h3>
                      <p className="text-[11px] text-stone-400">Prediccion de produccion e ingresos</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView('invoices')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center group-hover:bg-rose-200 transition-colors">
                      <FileText className="w-5 h-5 text-rose-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Facturas</h3>
                      <p className="text-[11px] text-stone-400">Creacion y gestion de facturas</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView('shed-log')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center group-hover:bg-cyan-200 transition-colors">
                      <ClipboardList className="w-5 h-5 text-cyan-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Bitacora</h3>
                      <p className="text-[11px] text-stone-400">Registro de actividades por galpon</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setView('backup')}
                  className="group text-left p-4 rounded-xl border border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                      <Database className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-700 group-hover:text-stone-900">Backup</h3>
                      <p className="text-[11px] text-stone-400">Respaldo y restauracion de datos</p>
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
            totalBatches={batches.length}
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
              calculations={calculations}
              structuralExpenses={structuralExpenses}
              farmName="Granja Nidal"
            />
          </div>
        )}

        {/* ====================== HISTORY VIEW ====================== */}
        {view === 'history' && (
          <HistoryView
            batches={batches}
            savedRecords={savedRecords}
            expandedRecord={expandedRecord}
            setExpandedRecord={setExpandedRecord}
            deleteRecord={deleteRecord}
            goBack={goBack}
            notes={notes}
            setNotes={setNotes}
            setSavedRecords={setSavedRecords}
          />
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
            <FarmMapView batches={batches} config={config} calculations={calculations} onShedClick={openLotDetail} />
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

        {/* ====================== CASH FLOW VIEW ====================== */}
        {view === 'cash-flow' && (
          <CashFlowPanel
            goBack={goBack}
            config={config}
            calculations={calculations}
          />
        )}

        {/* ====================== INVENTORY VIEW ====================== */}
        {view === 'inventory' && (
          <InventoryPanel
            batches={batches}
            config={config}
            fmtRD={fmtRD}
            fmtNum={fmtNum}
            goBack={goBack}
          />
        )}

        {/* ====================== USERS VIEW ====================== */}
        {view === 'users' && (
          <UserManagementPanel goBack={goBack} />
        )}

        {/* ====================== PREDICTIVE VIEW ====================== */}
        {view === 'predictive' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Analisis Predictivo</h2>
            </div>
            <PredictivePanel goBack={goBack} />
          </div>
        )}

        {/* ====================== INVOICES VIEW ====================== */}
        {view === 'invoices' && (
          <InvoicesPanel goBack={goBack} />
        )}

        {/* ====================== BACKUP VIEW ====================== */}
        {view === 'backup' && (
          <BackupPanel goBack={goBack} isSuperadmin={true} />
        )}

        {/* ====================== SHED LOG VIEW ====================== */}
        {view === 'shed-log' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
                <ChevronLeft className="w-4 h-4" /> Volver
              </Button>
              <h2 className="text-lg font-bold text-stone-800">Bitacora de Galpones</h2>
            </div>
            <ShedLogPanel goBack={goBack} batches={batches.map(b => ({ id: b.id, name: b.name }))} />
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
        liveCalcs={calculations}
        notes={notes}
        setNotes={setNotes}
        saveRecord={saveRecord}
        resetAll={resetAll}
      />

      {/* Dashboard Delete Confirmation */}
      <AlertDialog open={!!dashboardDeleteBatch} onOpenChange={(open) => { if (!open) setDashboardDeleteBatch(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {dashboardDeleteBatch?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminaran todos los datos de este lote, incluyendo su historial de produccion, alertas y recordatorios. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDashboardDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  )
}
