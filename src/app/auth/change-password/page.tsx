'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Lock, Eye, EyeOff, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Password strength checks
  const hasMinLength = newPassword.length >= 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasLowercase = /[a-z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const isStrong = hasMinLength && hasUppercase && hasLowercase && hasNumber
  const passwordsMatch = newPassword === confirmPassword && newPassword.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!currentPassword.trim()) {
      setError('Ingresa tu contraseña actual.')
      setLoading(false)
      return
    }

    if (!newPassword.trim()) {
      setError('Ingresa la nueva contraseña.')
      setLoading(false)
      return
    }

    if (!isStrong) {
      setError('La nueva contraseña no cumple con todos los requisitos.')
      setLoading(false)
      return
    }

    if (!passwordsMatch) {
      setError('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }

    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al cambiar la contraseña.')
        return
      }

      setSuccess('Contraseña actualizada exitosamente. Redirigiendo...')
      // Sign out and redirect to login so they can log in with the new password
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
        router.refresh()
      }, 1500)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-amber-50/30 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
            <KeyRound className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Cambiar Contraseña</h1>
          <p className="text-sm text-stone-500">
            Debes cambiar tu contraseña temporal antes de continuar
          </p>
        </div>

        {/* Warning Banner */}
        <Alert className="border-amber-300 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-sm text-amber-800">
            Por seguridad, debes establecer una nueva contraseña antes de acceder al sistema.
          </AlertDescription>
        </Alert>

        {/* Change Password Form */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nueva Contraseña</CardTitle>
            <CardDescription className="text-xs">
              Crea una contraseña segura que cumplas con los siguientes requisitos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-2">
                <Label htmlFor="current-password" className="text-sm">Contraseña actual</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    id="current-password"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Tu contraseña temporal"
                    className="pl-10 pr-10 h-10"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm">Nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-10 pr-10 h-10"
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-2 rounded-lg border border-stone-200 p-3 bg-stone-50">
                  <p className="text-xs font-medium text-stone-600">Requisitos:</p>
                  <div className="space-y-1">
                    <StrengthCheck label="Mínimo 8 caracteres" met={hasMinLength} />
                    <StrengthCheck label="Al menos una letra mayúscula" met={hasUppercase} />
                    <StrengthCheck label="Al menos una letra minúscula" met={hasLowercase} />
                    <StrengthCheck label="Al menos un número" met={hasNumber} />
                  </div>
                </div>
              )}

              {/* Confirm Password */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm">Confirmar nueva contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                    className={`pl-10 pr-10 h-10 ${confirmPassword && !passwordsMatch ? 'border-red-300 focus-visible:ring-red-300' : confirmPassword && passwordsMatch ? 'border-green-300' : ''}`}
                    autoComplete="new-password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 h-10"
                disabled={loading || !currentPassword.trim() || !isStrong || !passwordsMatch}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Actualizando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Cambiar Contraseña
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error/Success */}
        {error && (
          <Alert className="border-red-300 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-800">{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="border-green-300 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-sm text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Logout link */}
        <div className="text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.push('/auth/login')
              router.refresh()
            }}
            className="text-xs text-stone-400 hover:text-stone-600 underline"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

function StrengthCheck({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${met ? 'bg-green-500' : 'bg-stone-300'}`} />
      <span className={`text-xs ${met ? 'text-green-700' : 'text-stone-500'}`}>{label}</span>
    </div>
  )
}
