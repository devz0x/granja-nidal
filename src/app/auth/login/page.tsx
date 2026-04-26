'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, Lock, AlertTriangle, CheckCircle2, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña.')
      setLoading(false)
      return
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (authError) {
        setError(authError.message === 'Invalid login credentials'
          ? 'Correo o contraseña incorrectos.'
          : authError.message)
        return
      }

      if (data.session) {
        // Auto-assign superadmin role if no roles exist yet
        let mustChangePassword = false
        try {
          const roleRes = await fetch('/api/admin/ensure-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const roleData = await roleRes.json()
          mustChangePassword = roleData.must_change_password === true
        } catch {
          // Non-blocking - role assignment is handled server-side
        }

        setSuccess(mustChangePassword ? 'Debes cambiar tu contraseña temporal.' : 'Inicio de sesion exitoso!')
        setTimeout(() => {
          router.push(mustChangePassword ? '/auth/change-password' : '/')
          router.refresh()
        }, 500)
      }
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
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 21V13l8-10 8 10v8a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill="white" opacity="0.3"/>
              <path d="M5 21V14l6-8 6 8v7a1 1 0 01-1 1H6a1 1 0 01-1-1z" fill="white"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-stone-900">Granja Nidal</h1>
          <p className="text-sm text-stone-500">
            Inicia sesión para acceder a tu granja
          </p>
        </div>

        {/* Login Form */}
        <Card className="border-stone-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Iniciar Sesión</CardTitle>
            <CardDescription className="text-xs">
              Ingresa tus credenciales para continuar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="pl-10 h-10"
                    autoComplete="email"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 h-10"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 h-10"
                disabled={loading || !email.trim() || !password.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
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

        {/* Admin notice */}
        <p className="text-center text-xs text-stone-400 flex items-center justify-center gap-1.5">
          <Shield className="w-3 h-3" />
          Acceso exclusivo para administradores
        </p>
      </div>
    </div>
  )
}
