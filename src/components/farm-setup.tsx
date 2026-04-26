'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Database, Loader2, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { isSupabaseConfigured } from '@/lib/supabase'

interface FarmSetupProps {
  onFarmConnected: () => void
  onDismiss: () => void
}

// NOTE: This component is no longer used — Granja Nidal runs in single-farm mode.
// Kept for backwards compatibility only. All localStorage references removed.

export default function FarmSetup({ onFarmConnected, onDismiss }: FarmSetupProps) {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const supabaseConfigured = typeof window !== 'undefined' && isSupabaseConfigured()

  // Show auth loading state
  if (authLoading && supabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-stone-900">Granja Nidal</h1>
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
            <h1 className="text-2xl font-bold text-stone-900">Granja Nidal</h1>
            <p className="text-sm text-stone-500">
              Debes iniciar sesion para continuar.
            </p>
          </div>
          <Alert className="border-amber-300 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-xs text-amber-800">
              Se requiere autenticacion.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  // If authenticated, go to main app
  if (isAuthenticated) {
    onFarmConnected()
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Granja Nidal</h1>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-700">Supabase Configurado</p>
                <p className="text-xs text-stone-500">Listo.</p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        <div className="text-center">
          <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs text-stone-400">
            Continuar
          </Button>
        </div>
      </div>
    </div>
  )
}
