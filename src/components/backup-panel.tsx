'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Progress } from '@/components/ui/progress'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Download, Upload, FileJson, ChevronLeft, Loader2, Shield,
  Database, Calendar, HardDrive, AlertTriangle, CheckCircle2, FileSpreadsheet,
} from 'lucide-react'

const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || ''

interface BackupEntry {
  date: string
  size_mb: string
  records: number
  tables: number
  mode: string
}

export default function BackupPanel({ goBack, isSuperadmin }: { goBack: () => void; isSuperadmin: boolean }) {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [confirmImport, setConfirmImport] = useState(false)

  // Backup history (stored in localStorage)
  const [backupHistory, setBackupHistory] = useState<BackupEntry[]>([])

  // Weekly schedule
  const [weeklySchedule, setWeeklySchedule] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('granja-nidal-backup-history')
    if (saved) {
      try { setBackupHistory(JSON.parse(saved)) } catch { /* ignore */ }
    }
    const schedule = localStorage.getItem('granja-nidal-weekly-backup')
    setWeeklySchedule(schedule === 'true')
  }, [])

  const saveHistory = (entry: BackupEntry) => {
    const updated = [entry, ...backupHistory].slice(0, 20)
    setBackupHistory(updated)
    localStorage.setItem('granja-nidal-backup-history', JSON.stringify(updated))
  }

  // Export all data as JSON
  const handleExportJSON = async () => {
    if (!FARM_ID) return
    setExporting(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/backup?farm_id=${FARM_ID}`)
      if (!res.ok) throw new Error('Error al exportar datos')
      const data = await res.json()

      // Download JSON file
      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `granja-nidal-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      saveHistory({
        date: new Date().toISOString(),
        size_mb: data._stats.size_mb,
        records: data._stats.records,
        tables: data._stats.tables,
        mode: 'json',
      })

      setSuccess(`Backup exitoso: ${data._stats.records} registros en ${data._stats.size_mb} MB`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setExporting(false)
    }
  }

  // Export key data as CSV
  const handleExportCSV = async () => {
    if (!FARM_ID) return
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/backup?farm_id=${FARM_ID}`)
      if (!res.ok) throw new Error('Error al exportar')
      const data = await res.json()
      const backup = data.backup

      // Create CSV with key data
      const rows: string[] = []
      rows.push('=== LOTES ===')
      rows.push('Nombre,Aves,Tasa Postura,En Postura,Mes Ciclo,Fase')
      for (const b of (backup.batches || [])) {
        rows.push(`${b.name},${b.hens},${b.laying_rate},${b.is_laying},${b.cycle_month},${b.phase}`)
      }

      rows.push('')
      rows.push('=== ENTRADAS DIARIAS ===')
      rows.push('Fecha,Lote,Huevos,Rotos,Mortalidad,Feed(kg),Agua(L),Notas')
      const batchMap: Record<string, string> = {}
      for (const b of (backup.batches || [])) {
        batchMap[b.id] = b.name
      }
      for (const e of (backup.daily_entries || []).slice(-500)) {
        rows.push(`${e.date},${batchMap[e.batch_id] || e.batch_id},${e.eggs_collected},${e.eggs_broken},${e.mortality},${e.feed_kg},${e.water_liters},"${(e.notes || '').replace(/"/g, '""')}"`)
      }

      rows.push('')
      rows.push('=== FACTURAS ===')
      rows.push('Numero,Cliente,RNC,Subtotal,ITBIS,Total,Estado,Fecha')
      for (const inv of (backup.invoices || [])) {
        rows.push(`${inv.number},"${inv.client_name}",${inv.client_rnc || ''},${inv.subtotal},${inv.itbis},${inv.total},${inv.status},${inv.created_at?.split('T')[0] || ''}`)
      }

      const csvContent = rows.join('\n')
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `granja-nidal-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess('Exportacion CSV completada exitosamente')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setExporting(false)
    }
  }

  // Import from JSON
  const handleImport = async () => {
    if (!importFile || !FARM_ID) return
    setImporting(true)
    setImportProgress(10)
    setError('')
    setSuccess('')

    try {
      const text = await importFile.text()
      const json = JSON.parse(text)

      setImportProgress(30)

      const res = await fetch(`/api/backup?farm_id=${FARM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: json, mode: importMode }),
      })

      setImportProgress(80)

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Error al importar')
      }

      const result = await res.json()
      setImportProgress(100)

      const totalInserted = Object.values(result.results as Record<string, { inserted: number }>)
        .reduce((sum, r) => sum + r.inserted, 0)

      saveHistory({
        date: new Date().toISOString(),
        size_mb: (importFile.size / (1024 * 1024)).toFixed(2),
        records: totalInserted,
        tables: Object.keys(result.results).length,
        mode: importMode,
      })

      setSuccess(`Importacion completada: ${totalInserted} registros restaurados`)
      setImportOpen(false)
      setImportFile(null)
      setConfirmImport(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar datos')
    } finally {
      setImporting(false)
      setImportProgress(0)
    }
  }

  const toggleWeeklyBackup = () => {
    const newVal = !weeklySchedule
    setWeeklySchedule(newVal)
    localStorage.setItem('granja-nidal-weekly-backup', String(newVal))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Backup y Restauracion</h2>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-400 hover:text-green-600">&times;</button>
        </div>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-green-600" /> Exportar Datos
          </CardTitle>
          <CardDescription className="text-[11px]">Descargue una copia de seguridad de todos los datos de la granja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleExportJSON}
              disabled={exporting}
              className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 bg-white hover:border-green-300 hover:bg-green-50/50 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-green-700" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-stone-700">Exportar JSON</h3>
                <p className="text-[11px] text-stone-400">Backup completo en formato JSON</p>
              </div>
              {exporting && <Loader2 className="w-4 h-4 animate-spin text-green-600 ml-auto" />}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-3 p-4 rounded-xl border border-stone-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-amber-700" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-stone-700">Exportar CSV</h3>
                <p className="text-[11px] text-stone-400">Datos clave en formato hoja de calculo</p>
              </div>
              {exporting && <Loader2 className="w-4 h-4 animate-spin text-amber-600 ml-auto" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-orange-600" /> Importar Datos
          </CardTitle>
          <CardDescription className="text-[11px]">Restaurar datos desde un archivo de backup JSON</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setImportOpen(true)}
              disabled={!isSuperadmin}
              variant="outline"
              className="gap-1.5 text-sm"
            >
              <Upload className="w-4 h-4" />
              Seleccionar Archivo
            </Button>
            {!isSuperadmin && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px] gap-1">
                <Shield className="w-3 h-3" /> Solo superadmins pueden importar
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Import Progress */}
      {importing && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-stone-500" />
                <span className="text-sm text-stone-700">Importando datos...</span>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-[11px] text-stone-400">{importProgress}% completado</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-600" /> Programacion
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-700">Backup Semanal Automatico</p>
              <p className="text-[11px] text-stone-400">Recordatorio semanal para exportar datos</p>
            </div>
            <button
              onClick={toggleWeeklyBackup}
              className={`relative w-11 h-6 rounded-full transition-colors ${weeklySchedule ? 'bg-green-500' : 'bg-stone-300'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${weeklySchedule ? 'translate-x-5.5' : 'translate-x-0.5'}`}
                style={{ transform: weeklySchedule ? 'translateX(22px)' : 'translateX(2px)' }} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="w-4 h-4 text-stone-600" /> Historial de Backups
          </CardTitle>
          <CardDescription className="text-[11px]">Ultimos {backupHistory.length} backups realizados</CardDescription>
        </CardHeader>
        <CardContent>
          {backupHistory.length === 0 ? (
            <div className="text-center py-6 text-stone-400">
              <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Sin historial de backups.</p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Tamano</TableHead>
                    <TableHead className="text-[10px] text-right">Registros</TableHead>
                    <TableHead className="text-[10px]">Tipo</TableHead>
                    <TableHead className="text-[10px]">Modo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupHistory.map((entry, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[11px]">
                        {new Date(entry.date).toLocaleString('es-DO', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-[11px]">{entry.size_mb} MB</TableCell>
                      <TableCell className="text-[11px] text-right">{entry.records.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px]">{entry.tables} tablas</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[9px] ${entry.mode === 'json' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {entry.mode === 'json' ? 'Export' : 'Import'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" /> Importar Backup
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Seleccione un archivo JSON de backup previamente exportado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-stone-400 transition-colors"
              onClick={() => document.getElementById('import-file-input')?.click()}
            >
              <input
                id="import-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) setImportFile(file)
                }}
              />
              {importFile ? (
                <div>
                  <FileJson className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-medium">{importFile.name}</p>
                  <p className="text-[11px] text-stone-400">{(importFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  <p className="text-sm text-stone-500">Haga clic para seleccionar archivo</p>
                  <p className="text-[11px] text-stone-400">Solo archivos .json</p>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] text-stone-500">Modo de importacion</Label>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportMode('merge')}
                  className={`flex-1 p-2 rounded-lg border text-xs transition-colors ${importMode === 'merge' ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-stone-500'}`}
                >
                  <strong>Fusionar</strong>
                  <p className="text-[9px] mt-0.5">Mantiene datos existentes</p>
                </button>
                <button
                  onClick={() => setImportMode('replace')}
                  className={`flex-1 p-2 rounded-lg border text-xs transition-colors ${importMode === 'replace' ? 'border-red-500 bg-red-50 text-red-700' : 'border-stone-200 text-stone-500'}`}
                >
                  <strong>Reemplazar</strong>
                  <p className="text-[9px] mt-0.5">Borra datos existentes</p>
                </button>
              </div>
            </div>

            {importMode === 'replace' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-[11px] text-red-700">
                <strong>Advertencia:</strong> El modo reemplazar eliminara todos los datos existentes antes de importar. Esta accion no se puede deshacer.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImportOpen(false)} className="text-sm">Cancelar</Button>
              <Button
                onClick={() => setConfirmImport(true)}
                disabled={!importFile}
                className="bg-orange-600 hover:bg-orange-700 text-white text-sm gap-1.5"
              >
                <Upload className="w-4 h-4" /> Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Import */}
      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Importacion</AlertDialogTitle>
            <AlertDialogDescription>
              {importMode === 'replace'
                ? 'Se eliminaran TODOS los datos existentes y se reemplazaran con los del archivo. Esta accion es irreversible.'
                : 'Se fusionaran los datos del archivo con los datos existentes. Los registros duplicados se actualizaran.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport} className="bg-orange-600 hover:bg-orange-700 text-white">
              Confirmar Importacion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={className}>{children}</p>
}
