'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Database, CheckCircle2, AlertTriangle, Upload, Loader2,
  ArrowRight, RefreshCw, HardDrive,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { isSupabaseConfigured } from '@/lib/supabase'

interface FarmSetupProps {
  onFarmConnected: () => void
  onDismiss: () => void
}

export default function FarmSetup({ onFarmConnected, onDismiss }: FarmSetupProps) {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [mode, setMode] = useState<'create' | 'connect'>('create')
  const [farmName, setFarmName] = useState('')
  const [farmSlug, setFarmSlug] = useState('')
  const [connectFarmId, setConnectFarmId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [migrating, setMigrating] = useState(false)
  const [migrationResult, setMigrationResult] = useState<Record<string, unknown> | null>(null)

  const supabaseConfigured = typeof window !== 'undefined' && isSupabaseConfigured()

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFarmName(name)
    setFarmSlug(name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30))
  }

  // Create new farm
  const handleCreateFarm = async () => {
    if (!farmName.trim()) {
      setError('Ingresa un nombre para la granja.')
      return
    }
    if (!farmSlug.trim()) {
      setError('El slug es requerido.')
      return
    }
    if (!user?.id) {
      setError('Debes iniciar sesión para crear una granja.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/farm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: farmName, slug: farmSlug, user_id: user.id }),
      })
      const data = await res.json()

      if (data.error) {
        // Handle slug conflict with helpful suggestion
        if (data.code === 'SLUG_EXISTS') {
          setError('Ya existe una granja con ese nombre/slug. Intenta con un nombre diferente.')
          setFarmSlug(prev => {
            // Suggest an alternative slug with a number suffix
            const match = prev.match(/^(.*?)-?(\d*)$/)
            const base = match ? match[1] : prev
            const num = match && match[2] ? parseInt(match[2]) + 1 : 2
            return `${base}-${num}`
          })
        } else {
          setError(data.error)
        }
        return
      }

      // Store farm ID
      localStorage.setItem('granja-wd80-farm-id', data.farm.id)
      setSuccess(`Granja "${data.farm.name}" creada exitosamente!`)
      
      // Check if there's localStorage data to migrate
      const hasLocalData = localStorage.getItem('granja-wd80-config') ||
        localStorage.getItem('granja-wd80-batches')
      
      if (hasLocalData) {
        setSuccess(prev => prev + ' Puedes migrar tus datos existentes.')
      }

      setTimeout(() => onFarmConnected(), 1500)
    } catch {
      setError('Error de conexion. Verifica que Supabase este configurado correctamente.')
    } finally {
      setLoading(false)
    }
  }

  // Connect to existing farm
  const handleConnectFarm = async () => {
    if (!connectFarmId.trim()) {
      setError('Ingresa el ID de la granja.')
      return
    }
    if (!user?.id) {
      setError('Debes iniciar sesión para conectar una granja.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/farm?farm_id=${connectFarmId}`)
      const data = await res.json()

      if (data.error || !data.farm) {
        setError('Granja no encontrada. Verifica el ID.')
        return
      }

      // Verify the farm belongs to the current user
      if (data.farm.user_id && data.farm.user_id !== user.id) {
        setError('Esta granja no te pertenece.')
        return
      }

      localStorage.setItem('granja-wd80-farm-id', data.farm.id)
      setSuccess(`Conectado a "${data.farm.name}"!`)
      setTimeout(() => onFarmConnected(), 1500)
    } catch {
      setError('Error de conexion.')
    } finally {
      setLoading(false)
    }
  }

  // Migrate localStorage data to Supabase
  const handleMigrate = async () => {
    const farmId = localStorage.getItem('granja-wd80-farm-id')
    if (!farmId) {
      setError('No hay granja conectada. Crea o conecta primero.')
      return
    }

    setMigrating(true)
    setError('')

    try {
      // Read all localStorage data
      const config = JSON.parse(localStorage.getItem('granja-wd80-config') || 'null')
      const batches = JSON.parse(localStorage.getItem('granja-wd80-batches') || '[]')
      const dailyEntries = JSON.parse(localStorage.getItem('granja-wd80-daily-entries') || '[]')
      const reminders = JSON.parse(localStorage.getItem('granja-wd80-reminders') || '[]')
      const structural = JSON.parse(localStorage.getItem('granja-wd80-structural') || '[]')
      const records = JSON.parse(localStorage.getItem('granja-wd80-records') || '[]')
      const feedInv = JSON.parse(localStorage.getItem('granja-wd80-feed-inventory') || '[]')
      const vaccinations = JSON.parse(localStorage.getItem('granja-wd80-vaccinations') || '[]')

      const res = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farm_id: farmId,
          config,
          batches,
          daily_entries: dailyEntries,
          reminders,
          structural_expenses: structural,
          monthly_records: records,
          feed_inventory: feedInv,
          vaccinations,
        }),
      })

      const data = await res.json()
      if (data.error) {
        setError(`Error en migracion: ${data.error}`)
        return
      }

      setMigrationResult(data.results)
      setSuccess('Migracion completada exitosamente!')
    } catch (e) {
      setError(`Error de conexion: ${e instanceof Error ? e.message : 'Desconocido'}`)
    } finally {
      setMigrating(false)
    }
  }

  // Show auth loading state
  if (authLoading && supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Configuracion de Granja</h1>
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
              <p className="text-sm text-stone-500">Verificando sesion...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show auth required message if Supabase configured but not authenticated
  if (supabaseConfigured && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Configuracion de Granja</h1>
            <p className="text-sm text-stone-500">
              Debes iniciar sesión para configurar tu granja.
            </p>
          </div>
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800">
              Se requiere autenticacion para usar el modo en la nube.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Configuracion de Granja</h1>
          <p className="text-sm text-stone-500">
            Conecta tu granja a Supabase para sincronizar datos en la nube.
          </p>
        </div>

        {/* User info */}
        {isAuthenticated && user && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-amber-700">
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-stone-700">{user.email}</p>
                  <p className="text-xs text-stone-500">Sesion activa</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {supabaseConfigured ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-700">Supabase Configurado</p>
                    <p className="text-xs text-stone-500">Listo para conectar o crear tu granja.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-700">Modo Local</p>
                    <p className="text-xs text-stone-500">Supabase no configurado. Los datos se guardan localmente.</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Supabase not configured warning */}
        {!supabaseConfigured && (
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800">
              Para usar la nube, configura las variables de entorno <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_URL</code> y <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> en tu proyecto de Vercel.
            </AlertDescription>
          </Alert>
        )}

        {supabaseConfigured && isAuthenticated && (
          <>
            {/* Mode toggle */}
            <div className="flex gap-2">
              <Button
                variant={mode === 'create' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => { setMode('create'); setError(''); setSuccess('') }}
              >
                Crear Granja Nueva
              </Button>
              <Button
                variant={mode === 'connect' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => { setMode('connect'); setError(''); setSuccess('') }}
              >
                Conectar Existente
              </Button>
            </div>

            {/* Create form */}
            {mode === 'create' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Crear Nueva Granja</CardTitle>
                  <CardDescription className="text-xs">
                    Crea una granja nueva en Supabase para sincronizar datos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre de la Granja</Label>
                    <Input
                      value={farmName}
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="Ej: Granja Nidal"
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Slug (URL amigable)</Label>
                    <Input
                      value={farmSlug}
                      onChange={e => setFarmSlug(e.target.value)}
                      placeholder="granja-nidal"
                      className="h-9 text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleCreateFarm}
                    disabled={loading || !farmName.trim()}
                    className="w-full gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Crear Granja
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Connect form */}
            {mode === 'connect' && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Conectar Granja Existente</CardTitle>
                  <CardDescription className="text-xs">
                    Ingresa el ID de la granja para conectarte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ID de Granja (UUID)</Label>
                    <Input
                      value={connectFarmId}
                      onChange={e => setConnectFarmId(e.target.value)}
                      placeholder="00000000-0000-0000-0000-000000000000"
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <Button
                    onClick={handleConnectFarm}
                    disabled={loading || !connectFarmId.trim()}
                    className="w-full gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Conectar
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Migration section */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  <CardTitle className="text-sm">Migrar Datos Existentes</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Importa todos tus datos de localStorage a Supabase.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline" className="text-[10px]">
                    {(() => {
                      if (typeof window === 'undefined') return '0 registros'
                      let total = 0
                      const keys = ['granja-wd80-batches', 'granja-wd80-daily-entries', 'granja-wd80-reminders', 'granja-wd80-structural', 'granja-wd80-records', 'granja-wd80-feed-inventory', 'granja-wd80-vaccinations']
                      keys.forEach(k => {
                        try { total += JSON.parse(localStorage.getItem(k) || '[]').length } catch { /* */ }
                      })
                      return `${total} registros locales`
                    })()}
                  </Badge>
                </div>
                <Button
                  onClick={handleMigrate}
                  disabled={migrating || !localStorage.getItem('granja-wd80-farm-id')}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {migrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {migrating ? 'Migrando datos...' : 'Migrar Datos a Supabase'}
                </Button>
                {migrationResult && (
                  <div className="mt-3 p-2 bg-green-50 rounded-lg space-y-1">
                    <p className="text-xs font-semibold text-green-700">Resultado de la migracion:</p>
                    {Object.entries(migrationResult).map(([key, val]) => (
                      <p key={key} className="text-[10px] text-green-600">
                        {key}: {(val as Record<string, unknown>)?.count || 0} registros {(val as Record<string, unknown>)?.success ? '✓' : '✗'}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Error/Success messages */}
        {error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-xs text-red-800">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-300 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-xs text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Dismiss - continue with localStorage */}
        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs text-stone-400">
            <RefreshCw className="w-3 h-3 mr-1" />
            Continuar con almacenamiento local
          </Button>
        </div>
      </div>
    </div>
  )
}
