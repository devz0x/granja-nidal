import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyAuth } from '@/lib/auth-api'

export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado.' }, { status: 500 })
  }

  const { user, error: authError } = await verifyAuth()
  if (authError) return authError
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

  try {
    const body = await req.json()
    const { currentPassword, newPassword } = body

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Debes ingresar la contraseña actual y la nueva contraseña.' },
        { status: 400 }
      )
    }

    // Validate new password strength
    const passwordErrors = validatePassword(newPassword)
    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: 'La nueva contraseña no cumple los requisitos.', details: passwordErrors },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabaseClient()

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    })

    if (signInError) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta.' },
        { status: 401 }
      )
    }

    // Update password using Supabase auth admin API via the user's session
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      return NextResponse.json(
        { error: `Error al actualizar contraseña: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Clear the must_change_password flag using the SECURITY DEFINER function
    await supabase.rpc('clear_must_change_password')

    return NextResponse.json({ success: true, message: 'Contraseña actualizada exitosamente.' })
  } catch {
    return NextResponse.json(
      { error: 'Error de conexión. Intenta de nuevo.' },
      { status: 500 }
    )
  }
}

/**
 * Validates password strength requirements.
 * Returns an array of error messages (empty if valid).
 */
function validatePassword(password: string): string[] {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres.')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Al menos una letra mayúscula.')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Al menos una letra minúscula.')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Al menos un número.')
  }

  return errors
}
