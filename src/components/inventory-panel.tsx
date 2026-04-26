'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Wheat, Plus, ArrowDownCircle, ArrowUpCircle, Settings2, AlertTriangle,
  CheckCircle2, Package, TrendingUp, TrendingDown, FileText, Truck, Clock,
} from 'lucide-react'
import { getFarmId } from '@/lib/supabase'

// ================================================================
// TYPES
// ================================================================
interface FeedInventory {
  id: string
  phaseKey: string
  phase: string
  currentStockKg: number
  reorderLevelKg: number
  lastPurchase: string
  supplier: string
  pricePerQuintal: number
}

interface InventoryMovement {
  id: string
  farm_id: string
  phase_key: string
  movement_type: 'entrada' | 'salida' | 'ajuste'
  quantity_kg: number
  unit_price: number
  supplier: string
  reference: string
  notes: string
  created_at: string
}

interface InventoryPanelProps {
  batches: { id: string; name: string; hens: number; phase: string }[]
  config: {
    feedPhases: Record<string, { label: string; consumption: number; price: number; weeks: string }>
  }
  fmtRD: (v: number) => string
  fmtNum: (v: number) => string
  goBack: () => void
}

const ALL_FEED_PHASES = [
  { key: 'pre_inicio', label: 'Pre-Inicio' },
  { key: 'inicio', label: 'Inicio' },
  { key: 'crecimiento', label: 'Crecimiento' },
  { key: 'pre_postura', label: 'Pre-Postura' },
  { key: 'postura', label: 'Postura' },
]

// ================================================================
// INVENTORY PANEL COMPONENT
// ================================================================
export default function InventoryPanel({ batches, config, fmtRD, fmtNum, goBack }: InventoryPanelProps) {
  const farmId = getFarmId()
  const [loading, setLoading] = useState(true)
  const [feedInventory, setFeedInventory] = useState<FeedInventory[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [showMovementDialog, setShowMovementDialog] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPhase, setFilterPhase] = useState<string>('all')

  // New movement form
  const [newMovement, setNewMovement] = useState({
    phase_key: 'postura',
    movement_type: 'entrada' as 'entrada' | 'salida' | 'ajuste',
    quantity_kg: '',
    unit_price: '',
    supplier: '',
    reference: '',
    notes: '',
  })

  // ================================================================
  // FETCH DATA
  // ================================================================
  const fetchAllData = useCallback(async () => {
    if (!farmId) return
    try {
      const [feedRes, moveRes] = await Promise.all([
        fetch(`/api/feed-inventory?farm_id=${farmId}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/inventory-movements?farm_id=${farmId}&limit=200`).then(r => r.ok ? r.json() : null),
      ])

      if (feedRes?.inventory) {
        const mapped = feedRes.inventory.map((f: Record<string, unknown>) => ({
          id: f.id as string,
          phaseKey: f.phase_key as string,
          phase: f.phase as string,
          currentStockKg: f.current_stock_kg as number,
          reorderLevelKg: f.reorder_level_kg as number,
          lastPurchase: f.last_purchase as string || '',
          supplier: f.supplier as string || '',
          pricePerQuintal: (f.price_per_quintal as number) || config.feedPhases[(f.phase_key as string) || 'postura']?.price || 0,
        }))
        // Ensure all phases exist
        const merged = ALL_FEED_PHASES.map(phase => {
          const existing = mapped.find(fi => fi.phaseKey === phase.key)
          if (existing) return { ...existing, phase: phase.label, phaseKey: phase.key }
          return {
            id: `fi-${phase.key}`, phaseKey: phase.key, phase: phase.label,
            currentStockKg: 0, reorderLevelKg: 200,
            lastPurchase: '', supplier: '',
            pricePerQuintal: config.feedPhases[phase.key]?.price || 0,
          }
        })
        setFeedInventory(merged)
      }

      if (moveRes?.movements) {
        setMovements(moveRes.movements as InventoryMovement[])
      }
    } catch (err) {
      console.error('Failed to fetch inventory data:', err)
    } finally {
      setLoading(false)
    }
  }, [farmId, config.feedPhases])

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  // ================================================================
  // DERIVED CALCULATIONS
  // ================================================================
  const totalStock = useMemo(() => feedInventory.reduce((s, fi) => s + fi.currentStockKg, 0), [feedInventory])
  const lowStockItems = useMemo(() => feedInventory.filter(fi => fi.currentStockKg <= fi.reorderLevelKg), [feedInventory])
  const criticalItems = useMemo(() => feedInventory.filter(fi => fi.currentStockKg <= fi.reorderLevelKg * 0.5), [feedInventory])

  // Monthly consumption calculation
  const monthlyConsumption = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const salidas = movements.filter(m =>
      m.movement_type === 'salida' && m.created_at >= thirtyDaysAgo
    )
    return salidas.reduce((s, m) => s + m.quantity_kg, 0)
  }, [movements])

  // Total investment
  const totalInvestment = useMemo(() => {
    return feedInventory.reduce((s, fi) => s + (fi.currentStockKg / 100 * fi.pricePerQuintal), 0)
  }, [feedInventory])

  // Price history per supplier
  const priceHistory = useMemo(() => {
    const entradas = movements
      .filter(m => m.movement_type === 'entrada' && m.unit_price > 0)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20)
    return entradas
  }, [movements])

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      if (filterType !== 'all' && m.movement_type !== filterType) return false
      if (filterPhase !== 'all' && m.phase_key !== filterPhase) return false
      return true
    })
  }, [movements, filterType, filterPhase])

  // ================================================================
  // CRUD: CREATE MOVEMENT
  // ================================================================
  const createMovement = async () => {
    if (!newMovement.quantity_kg || parseFloat(newMovement.quantity_kg) <= 0) {
      alert('Ingresa una cantidad valida.')
      return
    }
    if (!farmId) return

    try {
      const res = await fetch(`/api/inventory-movements?farm_id=${farmId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase_key: newMovement.phase_key,
          movement_type: newMovement.movement_type,
          quantity_kg: parseFloat(newMovement.quantity_kg),
          unit_price: parseFloat(newMovement.unit_price) || 0,
          supplier: newMovement.supplier,
          reference: newMovement.reference,
          notes: newMovement.notes,
        }),
      })

      if (res.ok) {
        setShowMovementDialog(false)
        setNewMovement({
          phase_key: 'postura',
          movement_type: 'entrada',
          quantity_kg: '',
          unit_price: '',
          supplier: '',
          reference: '',
          notes: '',
        })
        fetchAllData()
      }
    } catch { /* ignore */ }
  }

  // ================================================================
  // HELPERS
  // ================================================================
  const getPhaseLabel = (key: string) => {
    const found = ALL_FEED_PHASES.find(p => p.key === key)
    return found?.label || key
  }

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'entrada':
        return <Badge className="bg-green-100 text-green-700 text-[10px]"><ArrowDownCircle className="w-2.5 h-2.5 mr-0.5" /> Entrada</Badge>
      case 'salida':
        return <Badge className="bg-red-100 text-red-700 text-[10px]"><ArrowUpCircle className="w-2.5 h-2.5 mr-0.5" /> Salida</Badge>
      case 'ajuste':
        return <Badge className="bg-amber-100 text-amber-700 text-[10px]"><Settings2 className="w-2.5 h-2.5 mr-0.5" /> Ajuste</Badge>
      default:
        return <Badge variant="outline" className="text-[10px]">{type}</Badge>
    }
  }

  // ================================================================
  // LOADING
  // ================================================================
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
            Volver
          </Button>
          <h2 className="text-lg font-bold text-stone-800">Inventario</h2>
        </div>
        <div className="flex items-center justify-center py-10 text-stone-400">
          <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-500 rounded-full animate-spin mr-3" />
          <span className="text-sm">Cargando inventario...</span>
        </div>
      </div>
    )
  }

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Inventario</h2>
        <Badge variant="outline" className="text-xs">{movements.length} movimientos</Badge>
        <div className="flex-1" />
        <Button size="sm" onClick={() => setShowMovementDialog(true)} className="gap-1.5 text-xs h-9 bg-green-600 hover:bg-green-700 text-white min-w-[44px] min-h-[44px]">
          <Plus className="w-4 h-4" /> Registrar Movimiento
        </Button>
      </div>

      {/* Alerts */}
      {criticalItems.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm text-red-800">
            <strong>Stock critico:</strong> {criticalItems.map(i => i.phase).join(', ')} — necesita reposicion urgente.
          </AlertDescription>
        </Alert>
      )}
      {lowStockItems.length > criticalItems.length && (
        <Alert className="border-amber-300 bg-amber-50">
          <Package className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            <strong>Stock bajo:</strong> {lowStockItems.filter(i => !criticalItems.includes(i)).map(i => i.phase).join(', ')} — proximo al nivel de reorden.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Package className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Stock Total</span>
            </div>
            <p className="text-lg font-bold text-green-700">{fmtNum(Math.round(totalStock))} kg</p>
            <p className="text-[10px] text-stone-400">5 fases de alimento</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Consumo Mensual</span>
            </div>
            <p className="text-lg font-bold text-amber-700">{fmtNum(Math.round(monthlyConsumption))} kg</p>
            <p className="text-[10px] text-stone-400">Ultimos 30 dias</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Wheat className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Inversion</span>
            </div>
            <p className="text-lg font-bold text-emerald-700">{fmtRD(totalInvestment)}</p>
            <p className="text-[10px] text-stone-400">Valor del stock actual</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Alertas</span>
            </div>
            <p className="text-lg font-bold text-violet-700">{lowStockItems.length}</p>
            <p className="text-[10px] text-stone-400">{criticalItems.length} criticos</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock by Phase */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wheat className="w-4 h-4 text-amber-600" />
            Stock por Fase
          </CardTitle>
          <CardDescription className="text-[11px]">Inventario actual con estados y niveles de reorden</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Fase</TableHead>
                  <TableHead className="text-[10px] text-right">Stock (kg)</TableHead>
                  <TableHead className="text-[10px] text-right">Reorden (kg)</TableHead>
                  <TableHead className="text-[10px] text-right">Precio/qq</TableHead>
                  <TableHead className="text-[10px] text-right">Valor</TableHead>
                  <TableHead className="text-[10px]">Estado</TableHead>
                  <TableHead className="text-[10px]">Proveedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedInventory.map(fi => {
                  const isLow = fi.currentStockKg <= fi.reorderLevelKg && fi.currentStockKg > fi.reorderLevelKg * 0.5
                  const isCritical = fi.currentStockKg <= fi.reorderLevelKg * 0.5
                  const value = (fi.currentStockKg / 100) * fi.pricePerQuintal
                  return (
                    <TableRow key={fi.id} className={isCritical ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}>
                      <TableCell className="text-xs font-medium">{fi.phase}</TableCell>
                      <TableCell className="text-xs text-right font-semibold">{fmtNum(Math.round(fi.currentStockKg))}</TableCell>
                      <TableCell className="text-xs text-right text-stone-500">{fmtNum(Math.round(fi.reorderLevelKg))}</TableCell>
                      <TableCell className="text-xs text-right">{fmtRD(fi.pricePerQuintal)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtRD(value)}</TableCell>
                      <TableCell>
                        {isCritical ? (
                          <Badge className="bg-red-100 text-red-700 text-[10px]">CRITICO</Badge>
                        ) : isLow ? (
                          <Badge className="bg-amber-100 text-amber-700 text-[10px]">REORDENAR</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] text-stone-500">{fi.supplier || '-'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Movement History */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-600" />
                Historial de Movimientos
              </CardTitle>
              <CardDescription className="text-[11px]">Entradas, salidas y ajustes de inventario</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="all">Todos los tipos</option>
              <option value="entrada">Entradas</option>
              <option value="salida">Salidas</option>
              <option value="ajuste">Ajustes</option>
            </select>
            <select
              value={filterPhase}
              onChange={e => setFilterPhase(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="all">Todas las fases</option>
              {ALL_FEED_PHASES.map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <Badge variant="outline" className="text-[10px] h-8 flex items-center">
              {filteredMovements.length} registros
            </Badge>
          </div>

          {filteredMovements.length > 0 ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Fase</TableHead>
                    <TableHead className="text-[10px]">Tipo</TableHead>
                    <TableHead className="text-[10px] text-right">Cantidad</TableHead>
                    <TableHead className="text-[10px] text-right">Precio/kg</TableHead>
                    <TableHead className="text-[10px] text-right">Total</TableHead>
                    <TableHead className="text-[10px]">Proveedor</TableHead>
                    <TableHead className="text-[10px]">Referencia</TableHead>
                    <TableHead className="text-[10px]">Notas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-[11px]">
                        {new Date(m.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}
                      </TableCell>
                      <TableCell className="text-[11px] font-medium">{getPhaseLabel(m.phase_key)}</TableCell>
                      <TableCell>{getMovementBadge(m.movement_type)}</TableCell>
                      <TableCell className="text-[11px] text-right font-medium">
                        {m.movement_type === 'salida' ? '-' : '+'}{fmtNum(m.quantity_kg)} kg
                      </TableCell>
                      <TableCell className="text-[11px] text-right">{m.unit_price > 0 ? fmtRD(m.unit_price) : '-'}</TableCell>
                      <TableCell className="text-[11px] text-right font-medium">
                        {m.unit_price > 0 ? fmtRD(m.quantity_kg * m.unit_price) : '-'}
                      </TableCell>
                      <TableCell className="text-[10px] text-stone-500">{m.supplier || '-'}</TableCell>
                      <TableCell className="text-[10px] text-stone-500">{m.reference || '-'}</TableCell>
                      <TableCell className="text-[10px] text-stone-400 max-w-[120px] truncate">{m.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-400">
              <Package className="w-8 h-8 mx-auto mb-1 opacity-30" />
              <p className="text-xs">Sin movimientos registrados.</p>
              <p className="text-[10px] mt-1">Haz clic en &quot;Registrar Movimiento&quot; para comenzar.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price History */}
      {priceHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Historial de Precios
            </CardTitle>
            <CardDescription className="text-[11px]">Ultimas {priceHistory.length} compras con precio registrado</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px]">Fase</TableHead>
                    <TableHead className="text-[10px] text-right">Precio/kg</TableHead>
                    <TableHead className="text-[10px] text-right">Precio/qq</TableHead>
                    <TableHead className="text-[10px]">Proveedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {priceHistory.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-[11px]">
                        {new Date(m.created_at).toLocaleDateString('es-DO', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </TableCell>
                      <TableCell className="text-[11px]">{getPhaseLabel(m.phase_key)}</TableCell>
                      <TableCell className="text-[11px] text-right font-medium">{fmtRD(m.unit_price)}/kg</TableCell>
                      <TableCell className="text-[11px] text-right font-bold">{fmtRD(m.unit_price * 100)}</TableCell>
                      <TableCell className="text-[10px] text-stone-500">{m.supplier || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Movement Dialog */}
      <Dialog open={showMovementDialog} onOpenChange={setShowMovementDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-green-600" />
              Registrar Movimiento
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              Registra una entrada, salida o ajuste de inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Tipo de Movimiento</Label>
                <select
                  value={newMovement.movement_type}
                  onChange={e => setNewMovement(p => ({ ...p, movement_type: e.target.value as 'entrada' | 'salida' | 'ajuste' }))}
                  className="h-9 text-xs rounded-md border border-input bg-background px-2 w-full"
                >
                  <option value="entrada">Entrada (Compra)</option>
                  <option value="salida">Salida (Consumo)</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Fase de Alimento</Label>
                <select
                  value={newMovement.phase_key}
                  onChange={e => setNewMovement(p => ({ ...p, phase_key: e.target.value }))}
                  className="h-9 text-xs rounded-md border border-input bg-background px-2 w-full"
                >
                  {ALL_FEED_PHASES.map(p => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Cantidad (kg)</Label>
                <Input
                  type="number"
                  value={newMovement.quantity_kg}
                  onChange={e => setNewMovement(p => ({ ...p, quantity_kg: e.target.value }))}
                  placeholder="0"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Precio por kg (RD$)</Label>
                <Input
                  type="number"
                  value={newMovement.unit_price}
                  onChange={e => setNewMovement(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="0.00"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {newMovement.quantity_kg && newMovement.unit_price && (
              <div className="p-2 bg-stone-50 rounded-lg text-xs text-stone-600">
                <strong>Total:</strong> {fmtRD(parseFloat(newMovement.quantity_kg) * parseFloat(newMovement.unit_price || '0'))}
                {' '}({fmtNum(parseFloat(newMovement.quantity_kg))} kg x {fmtRD(parseFloat(newMovement.unit_price || '0'))}/kg)
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px]">Proveedor</Label>
                <Input
                  value={newMovement.supplier}
                  onChange={e => setNewMovement(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="Ej: Nutriovo Sanut"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Referencia / Factura</Label>
                <Input
                  value={newMovement.reference}
                  onChange={e => setNewMovement(p => ({ ...p, reference: e.target.value }))}
                  placeholder="Ej: FAC-001"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px]">Notas</Label>
              <Textarea
                value={newMovement.notes}
                onChange={e => setNewMovement(p => ({ ...p, notes: e.target.value }))}
                placeholder="Observaciones..."
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowMovementDialog(false)}
                className="flex-1 h-10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={createMovement}
                className="flex-1 h-10 text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                {newMovement.movement_type === 'entrada' ? (
                  <><Truck className="w-3.5 h-3.5 mr-1" /> Registrar Entrada</>
                ) : newMovement.movement_type === 'salida' ? (
                  <><ArrowUpCircle className="w-3.5 h-3.5 mr-1" /> Registrar Salida</>
                ) : (
                  <><Settings2 className="w-3.5 h-3.5 mr-1" /> Registrar Ajuste</>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
