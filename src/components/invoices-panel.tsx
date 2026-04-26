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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Plus, Trash2, ChevronLeft, Printer, FileText, Eye, Search,
  Loader2, X, Send, CheckCircle2, Ban,
} from 'lucide-react'

const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID || ''

interface InvoiceItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface Invoice {
  id: string
  number: string
  client_name: string
  client_rnc: string
  client_address: string
  client_phone: string
  items: InvoiceItem[]
  subtotal: number
  itbis: number
  total: number
  status: string
  notes: string
  created_at: string
}

function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const STATUS_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada',
  pagada: 'Pagada',
  anulada: 'Anulada',
}

const STATUS_COLORS: Record<string, string> = {
  borrador: 'bg-stone-100 text-stone-700',
  enviada: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  anulada: 'bg-red-100 text-red-700',
}

const EMPTY_ITEM = (): InvoiceItem => ({ description: '', quantity: 1, unit_price: 0, amount: 0 })

export default function InvoicesPanel({ goBack }: { goBack: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [clientName, setClientName] = useState('')
  const [clientRnc, setClientRnc] = useState('')
  const [clientAddress, setClientAddress] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([EMPTY_ITEM()])
  const [invoiceNotes, setInvoiceNotes] = useState('')

  // Preview dialog
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null)

  // Delete dialog
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null)

  const fetchInvoices = useCallback(async () => {
    if (!FARM_ID) return
    setLoading(true)
    try {
      let url = `/api/invoices?farm_id=${FARM_ID}&limit=200`
      if (statusFilter) url += `&status=${statusFilter}`
      if (search) url += `&search=${encodeURIComponent(search)}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setInvoices((data.invoices || []).map((inv: Record<string, unknown>) => ({
          id: inv.id,
          number: inv.number,
          client_name: inv.client_name,
          client_rnc: inv.client_rnc || '',
          client_address: inv.client_address || '',
          client_phone: inv.client_phone || '',
          items: (inv.items || []) as InvoiceItem[],
          subtotal: Number(inv.subtotal),
          itbis: Number(inv.itbis),
          total: Number(inv.total),
          status: inv.status,
          notes: inv.notes || '',
          created_at: inv.created_at,
        })))
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setInvoiceItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      updated[index].amount = updated[index].quantity * updated[index].unit_price
      return updated
    })
  }

  const addItem = () => {
    setInvoiceItems(prev => [...prev, EMPTY_ITEM()])
  }

  const removeItem = (index: number) => {
    if (invoiceItems.length <= 1) return
    setInvoiceItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = invoiceItems.reduce((s, item) => s + item.amount, 0)
  const itbis = Math.round(subtotal * 0.18 * 100) / 100
  const total = Math.round((subtotal + itbis) * 100) / 100

  const handleCreate = async () => {
    if (!clientName.trim()) return
    if (invoiceItems.some(i => !i.description.trim())) return

    setCreating(true)
    try {
      const res = await fetch(`/api/invoices?farm_id=${FARM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: clientName,
          client_rnc: clientRnc,
          client_address: clientAddress,
          client_phone: clientPhone,
          items: invoiceItems.filter(i => i.description.trim()),
          notes: invoiceNotes,
        }),
      })
      if (res.ok) {
        setCreateOpen(false)
        resetForm()
        fetchInvoices()
      }
    } catch {
      // ignore
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteInvoice || !FARM_ID) return
    try {
      await fetch(`/api/invoices/${deleteInvoice.id}?farm_id=${FARM_ID}`, { method: 'DELETE' })
      setDeleteInvoice(null)
      fetchInvoices()
    } catch {
      // ignore
    }
  }

  const resetForm = () => {
    setClientName('')
    setClientRnc('')
    setClientAddress('')
    setClientPhone('')
    setInvoiceItems([EMPTY_ITEM()])
    setInvoiceNotes('')
  }

  const handlePrint = (invoice: Invoice) => {
    const printContent = `
      <html><head><title>Factura ${invoice.number}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 15px; }
        .company { font-size: 20px; font-weight: bold; }
        .invoice-num { font-size: 16px; font-weight: bold; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .totals { text-align: right; margin-top: 20px; }
        .totals p { margin: 4px 0; font-size: 14px; }
        .total { font-size: 18px; font-weight: bold; font-size: 20px; margin-top: 8px; }
        .client-info { margin-bottom: 20px; }
        .client-info p { margin: 2px 0; font-size: 13px; color: #555; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <div class="header">
        <div><div class="company">Granja Nidal</div><p style="font-size:12px;color:#888;">Granja Avicola</p></div>
        <div style="text-align:right;">
          <div class="invoice-num">Factura: ${invoice.number}</div>
          <p style="font-size:12px;color:#888;">Fecha: ${new Date(invoice.created_at).toLocaleDateString('es-DO')}</p>
          <p style="font-size:12px;color:#888;">Estado: ${STATUS_LABELS[invoice.status] || invoice.status}</p>
        </div>
      </div>
      <div class="client-info">
        <p><strong>Cliente:</strong> ${invoice.client_name}</p>
        ${invoice.client_rnc ? `<p><strong>RNC:</strong> ${invoice.client_rnc}</p>` : ''}
        ${invoice.client_address ? `<p><strong>Direccion:</strong> ${invoice.client_address}</p>` : ''}
        ${invoice.client_phone ? `<p><strong>Telefono:</strong> ${invoice.client_phone}</p>` : ''}
      </div>
      <table>
        <thead><tr><th>Descripcion</th><th>Cant.</th><th>Precio Unit.</th><th>Monto</th></tr></thead>
        <tbody>
          ${invoice.items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${fmtRD(i.unit_price)}</td><td>${fmtRD(i.amount)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="totals">
        <p>Subtotal: ${fmtRD(invoice.subtotal)}</p>
        <p>ITBIS (18%): ${fmtRD(invoice.itbis)}</p>
        <p class="total">Total: ${fmtRD(invoice.total)}</p>
      </div>
      ${invoice.notes ? `<p style="margin-top:30px;font-size:12px;color:#666;"><strong>Notas:</strong> ${invoice.notes}</p>` : ''}
      </body></html>
    `
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(printContent)
      win.document.close()
      win.print()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Facturas</h2>
        <Badge variant="outline" className="text-[10px]">{invoices.length} facturas</Badge>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <Input
                placeholder="Buscar por nombre, numero, RNC..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-9 text-sm rounded-md border border-input bg-background px-3"
            >
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="enviada">Enviada</option>
              <option value="pagada">Pagada</option>
              <option value="anulada">Anulada</option>
            </select>
            <Button
              onClick={() => { resetForm(); setCreateOpen(true) }}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm"
            >
              <Plus className="w-4 h-4" /> Nueva Factura
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-10 text-stone-400">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="text-xs">Sin facturas.</p>
              <p className="text-[10px] mt-1">Crea una nueva factura para comenzar.</p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Numero</TableHead>
                    <TableHead className="text-[10px]">Cliente</TableHead>
                    <TableHead className="text-[10px]">Fecha</TableHead>
                    <TableHead className="text-[10px] text-right">Total</TableHead>
                    <TableHead className="text-[10px]">Estado</TableHead>
                    <TableHead className="text-[10px] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-[11px] font-medium">{inv.number}</TableCell>
                      <TableCell className="text-[11px]">{inv.client_name}</TableCell>
                      <TableCell className="text-[11px] text-stone-500">
                        {new Date(inv.created_at).toLocaleDateString('es-DO')}
                      </TableCell>
                      <TableCell className="text-[11px] text-right font-medium">{fmtRD(inv.total)}</TableCell>
                      <TableCell>
                        <Badge className={`${STATUS_COLORS[inv.status] || ''} text-[9px]`}>
                          {STATUS_LABELS[inv.status] || inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => setPreviewInvoice(inv)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => handlePrint(inv)}>
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-stone-300 hover:text-red-500"
                            onClick={() => setDeleteInvoice(inv)}>
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create Invoice Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> Nueva Factura
            </DialogTitle>
            <DialogDescription className="text-[11px]">Complete los datos para crear una nueva factura.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Client Info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-700">Datos del Cliente</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px]">Nombre *</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nombre del cliente" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">RNC</Label>
                  <Input value={clientRnc} onChange={e => setClientRnc(e.target.value)} placeholder="RNC" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Direccion</Label>
                  <Input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Direccion" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px]">Telefono</Label>
                  <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="Telefono" className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700">Items</h3>
                <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-[10px] gap-1">
                  <Plus className="w-3 h-3" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {invoiceItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 border rounded-lg">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Descripcion"
                        value={item.description}
                        onChange={e => updateItem(index, 'description', e.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[9px] text-stone-400">Cant.</Label>
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[9px] text-stone-400">Precio Unit.</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={e => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[9px] text-stone-400">Monto</Label>
                          <div className="h-8 flex items-center px-2 text-xs font-medium text-stone-700 bg-stone-50 rounded-md">
                            {fmtRD(item.amount)}
                          </div>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-stone-300 hover:text-red-500 mt-1"
                      onClick={() => removeItem(index)}
                      disabled={invoiceItems.length <= 1}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-[11px]">Notas</Label>
              <Textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="Notas adicionales..." className="text-sm min-h-[60px]" />
            </div>

            {/* Totals */}
            <div className="bg-stone-50 rounded-lg p-4 space-y-1.5 text-right">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">Subtotal</span>
                <span className="font-medium">{fmtRD(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500">ITBIS (18%)</span>
                <span className="font-medium">{fmtRD(itbis)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
                <span>Total</span>
                <span>{fmtRD(total)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} className="text-sm">Cancelar</Button>
              <Button
                onClick={handleCreate}
                disabled={creating || !clientName.trim() || invoiceItems.some(i => !i.description.trim())}
                className="bg-green-600 hover:bg-green-700 text-white text-sm gap-1.5"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Crear Factura
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" /> {previewInvoice?.number}
            </DialogTitle>
          </DialogHeader>
          {previewInvoice && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{previewInvoice.client_name}</p>
                  {previewInvoice.client_rnc && <p className="text-[11px] text-stone-500">RNC: {previewInvoice.client_rnc}</p>}
                  {previewInvoice.client_address && <p className="text-[11px] text-stone-500">{previewInvoice.client_address}</p>}
                  {previewInvoice.client_phone && <p className="text-[11px] text-stone-500">Tel: {previewInvoice.client_phone}</p>}
                </div>
                <Badge className={STATUS_COLORS[previewInvoice.status] || ''}>
                  {STATUS_LABELS[previewInvoice.status]}
                </Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Descripcion</TableHead>
                    <TableHead className="text-[10px] text-right">Cant.</TableHead>
                    <TableHead className="text-[10px] text-right">Precio</TableHead>
                    <TableHead className="text-[10px] text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewInvoice.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-[11px]">{item.description}</TableCell>
                      <TableCell className="text-[11px] text-right">{item.quantity}</TableCell>
                      <TableCell className="text-[11px] text-right">{fmtRD(item.unit_price)}</TableCell>
                      <TableCell className="text-[11px] text-right font-medium">{fmtRD(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="space-y-1 text-right">
                <p className="text-sm text-stone-500">Subtotal: {fmtRD(previewInvoice.subtotal)}</p>
                <p className="text-sm text-stone-500">ITBIS: {fmtRD(previewInvoice.itbis)}</p>
                <p className="text-lg font-bold">Total: {fmtRD(previewInvoice.total)}</p>
              </div>

              {previewInvoice.notes && (
                <div className="bg-stone-50 rounded-lg p-3 text-[11px] text-stone-600">
                  <strong>Notas:</strong> {previewInvoice.notes}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handlePrint(previewInvoice)} className="gap-1.5 text-sm">
                  <Printer className="w-4 h-4" /> Imprimir
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteInvoice} onOpenChange={(open) => { if (!open) setDeleteInvoice(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar Factura {deleteInvoice?.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara permanentemente esta factura. Esta accion no se puede deshacer.
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
