'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus, Trash2, ChevronLeft, Loader2, Edit, Search, Filter,
  ClipboardCheck, Sparkles, Wrench, AlertTriangle, Eye, Camera,
} from 'lucide-react'

import { FARM_ID } from '@/lib/constants'

interface ShedLogEntry {
  id: string
  batch_id: string | null
  batch_name: string
  activity_type: string
  description: string
  cost: number
  performed_by: string
  performed_at: string
  notes: string
  photos: string[]
  created_at: string
}

const ACTIVITY_TYPES = [
  { value: 'limpieza', label: 'Limpieza', icon: Sparkles, color: 'bg-green-100 text-green-700' },
  { value: 'desinfeccion', label: 'Desinfeccion', icon: AlertTriangle, color: 'bg-purple-100 text-purple-700' },
  { value: 'mantenimiento', label: 'Mantenimiento', icon: Wrench, color: 'bg-amber-100 text-amber-700' },
  { value: 'reparacion', label: 'Reparacion', icon: Wrench, color: 'bg-red-100 text-red-700' },
  { value: 'inspeccion', label: 'Inspeccion', icon: Eye, color: 'bg-sky-100 text-sky-700' },
  { value: 'otros', label: 'Otros', icon: ClipboardCheck, color: 'bg-stone-100 text-stone-700' },
]

function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ShedLogPanel({ goBack, batches }: { goBack: () => void; batches: Array<{ id: string; name: string }> }) {
  const [entries, setEntries] = useState<ShedLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formBatchId, setFormBatchId] = useState('')
  const [formActivityType, setFormActivityType] = useState('limpieza')
  const [formDescription, setFormDescription] = useState('')
  const [formCost, setFormCost] = useState(0)
  const [formPerformedBy, setFormPerformedBy] = useState('')
  const [formPerformedAt, setFormPerformedAt] = useState(new Date().toISOString().split('T')[0])
  const [formNotes, setFormNotes] = useState('')
  const [formPhotos, setFormPhotos] = useState<string[]>([])

  // Delete dialog
  const [deleteEntry, setDeleteEntry] = useState<ShedLogEntry | null>(null)

  // Stats
  const totalCost = entries.reduce((s, e) => s + e.cost, 0)

  const fetchEntries = useCallback(async () => {
    if (!FARM_ID) return
    setLoading(true)
    try {
      let url = `/api/shed-logs?farm_id=${FARM_ID}&limit=200`
      if (filterBatch) url += `&batch_id=${filterBatch}`
      if (filterType) url += `&activity_type=${filterType}`
      if (dateFrom) url += `&date_from=${dateFrom}`
      if (dateTo) url += `&date_to=${dateTo}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.shed_logs || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filterBatch, filterType, dateFrom, dateTo])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const resetForm = () => {
    setEditingId(null)
    setFormBatchId(batches[0]?.id || '')
    setFormActivityType('limpieza')
    setFormDescription('')
    setFormCost(0)
    setFormPerformedBy('')
    setFormPerformedAt(new Date().toISOString().split('T')[0])
    setFormNotes('')
    setFormPhotos([])
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (entry: ShedLogEntry) => {
    setEditingId(entry.id)
    setFormBatchId(entry.batch_id || '')
    setFormActivityType(entry.activity_type)
    setFormDescription(entry.description)
    setFormCost(entry.cost)
    setFormPerformedBy(entry.performed_by)
    setFormPerformedAt(entry.performed_at)
    setFormNotes(entry.notes)
    setFormPhotos(entry.photos || [])
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formDescription.trim()) return
    setSaving(true)
    try {
      const body = {
        batch_id: formBatchId || null,
        activity_type: formActivityType,
        description: formDescription,
        cost: formCost,
        performed_by: formPerformedBy,
        performed_at: formPerformedAt,
        notes: formNotes,
        photos: formPhotos,
      }

      if (editingId) {
        const res = await fetch(`/api/shed-logs/${editingId}?farm_id=${FARM_ID}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          setDialogOpen(false)
          fetchEntries()
        }
      } else {
        const res = await fetch(`/api/shed-logs?farm_id=${FARM_ID}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          setDialogOpen(false)
          fetchEntries()
        }
      }
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEntry || !FARM_ID) return
    try {
      await fetch(`/api/shed-logs/${deleteEntry.id}?farm_id=${FARM_ID}`, { method: 'DELETE' })
      setDeleteEntry(null)
      fetchEntries()
    } catch {
      // ignore
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const file = files[0]
    if (!file) return

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setFormPhotos(prev => [...prev, base64])
    }
    reader.readAsDataURL(file)
  }

  const removePhoto = (index: number) => {
    setFormPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const getActivityBadge = (type: string) => {
    const act = ACTIVITY_TYPES.find(a => a.value === type)
    if (!act) return <Badge variant="outline" className="text-[9px]">{type}</Badge>
    return <Badge className={`${act.color} text-[9px]`}>{act.label}</Badge>
  }

  const filteredEntries = search
    ? entries.filter(e =>
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.performed_by.toLowerCase().includes(search.toLowerCase()) ||
        e.batch_name.toLowerCase().includes(search.toLowerCase())
      )
    : entries

  // Group by date for timeline view
  const groupedByDate = filteredEntries.reduce<Record<string, ShedLogEntry[]>>((acc, entry) => {
    const date = entry.performed_at
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Bitacora de Galpones</h2>
        <Badge variant="outline" className="text-[10px]">{entries.length} registros</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-stone-400">Limpiezas</p>
          <p className="text-sm font-bold text-green-700">{entries.filter(e => e.activity_type === 'limpieza').length}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-stone-400">Mantenimiento</p>
          <p className="text-sm font-bold text-amber-700">{entries.filter(e => e.activity_type === 'mantenimiento').length}</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-stone-400">Inspecciones</p>
          <p className="text-sm font-bold text-purple-700">{entries.filter(e => e.activity_type === 'inspeccion').length}</p>
        </div>
        <div className="bg-stone-50 rounded-lg p-3 text-center">
          <p className="text-[9px] text-stone-400">Costo Total</p>
          <p className="text-sm font-bold text-stone-700">{fmtRD(totalCost)}</p>
        </div>
      </div>

      {/* Filters + Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2">
              <option value="">Todos los galpones</option>
              {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-8 text-xs rounded-md border border-input bg-background px-2">
              <option value="">Todas las actividades</option>
              {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="flex items-center justify-between mt-3">
            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setFilterBatch(''); setFilterType(''); setDateFrom(''); setDateTo(''); setSearch('') }}>
              <Filter className="w-3 h-3 mr-1" /> Limpiar
            </Button>
            <Button onClick={openCreate} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Nuevo Registro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timeline View */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-stone-400">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Sin registros de actividades.</p>
              <p className="text-[10px] mt-1">Registre limpieza, mantenimiento u otras actividades.</p>
            </CardContent>
          </Card>
        ) : (
          sortedDates.map(date => (
            <Card key={date}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold text-stone-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {new Date(date + 'T12:00:00').toLocaleDateString('es-DO', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  <Badge variant="outline" className="text-[9px] ml-auto">
                    {groupedByDate[date].length} actividad{groupedByDate[date].length !== 1 ? 'es' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-2">
                {groupedByDate[date].map(entry => (
                  <div key={entry.id} className="border rounded-lg p-3 hover:bg-stone-50/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getActivityBadge(entry.activity_type)}
                          {entry.batch_name && (
                            <Badge variant="outline" className="text-[9px]">{entry.batch_name}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-stone-800">{entry.description}</p>
                        {entry.notes && (
                          <p className="text-[11px] text-stone-400 mt-1">{entry.notes}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          {entry.performed_by && (
                            <span className="text-[10px] text-stone-500">Por: {entry.performed_by}</span>
                          )}
                          {entry.cost > 0 && (
                            <span className="text-[10px] font-medium text-amber-700">Costo: {fmtRD(entry.cost)}</span>
                          )}
                          {entry.photos && entry.photos.length > 0 && (
                            <span className="text-[10px] text-stone-500 flex items-center gap-0.5">
                              <Camera className="w-3 h-3" /> {entry.photos.length} foto{entry.photos.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {entry.photos && entry.photos.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {entry.photos.slice(0, 3).map((photo, i) => (
                              <img
                                key={i}
                                src={photo}
                                alt={`Foto ${i + 1}`}
                                className="w-16 h-16 object-cover rounded border"
                              />
                            ))}
                            {entry.photos.length > 3 && (
                              <div className="w-16 h-16 rounded border bg-stone-100 flex items-center justify-center text-[10px] text-stone-500">
                                +{entry.photos.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => openEdit(entry)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-stone-300 hover:text-red-500"
                          onClick={() => setDeleteEntry(entry)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {editingId ? 'Editar Registro' : 'Nuevo Registro'}
            </DialogTitle>
            <DialogDescription className="text-[11px]">Registre una actividad de mantenimiento, limpieza, etc.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px]">Galpon *</Label>
                <select
                  value={formBatchId}
                  onChange={e => setFormBatchId(e.target.value)}
                  className="h-9 text-sm rounded-md border border-input bg-background px-2 w-full"
                >
                  <option value="">Sin asignar</option>
                  {batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Tipo de Actividad *</Label>
                <select
                  value={formActivityType}
                  onChange={e => setFormActivityType(e.target.value)}
                  className="h-9 text-sm rounded-md border border-input bg-background px-2 w-full"
                >
                  {ACTIVITY_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Fecha</Label>
                <Input
                  type="date"
                  value={formPerformedAt}
                  onChange={e => setFormPerformedAt(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Costo (RD$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formCost}
                  onChange={e => setFormCost(parseFloat(e.target.value) || 0)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Descripcion *</Label>
              <Textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                placeholder="Describa la actividad realizada..."
                className="text-sm min-h-[80px]"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Realizado por</Label>
              <Input
                value={formPerformedBy}
                onChange={e => setFormPerformedBy(e.target.value)}
                placeholder="Nombre de quien realizo la actividad"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Notas adicionales</Label>
              <Textarea
                value={formNotes}
                onChange={e => setFormNotes(e.target.value)}
                placeholder="Observaciones, detalles adicionales..."
                className="text-sm min-h-[60px]"
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label className="text-[11px]">Fotos</Label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 px-3 py-2 border rounded-md cursor-pointer hover:bg-stone-50 text-xs">
                  <Camera className="w-4 h-4" />
                  Agregar Foto
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-stone-400">{formPhotos.length} foto{formPhotos.length !== 1 ? 's' : ''}</span>
              </div>
              {formPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {formPhotos.map((photo, i) => (
                    <div key={i} className="relative group">
                      <img src={photo} alt={`Foto ${i + 1}`} className="w-20 h-20 object-cover rounded border" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="text-sm">Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formDescription.trim()}
                className="bg-green-600 hover:bg-green-700 text-white text-sm gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(open) => { if (!open) setDeleteEntry(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Registro</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara permanentemente este registro de la bitacora. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
