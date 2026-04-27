import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/auth-api'

const VALID_ROLES = ['superadmin', 'admin', 'contador', 'operador', 'user'] as const

const ROLE_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
  superadmin: {
    label: 'Super Administrador',
    description: 'Acceso total: gestion de usuarios, configuracion global, todos los modulos.',
  },
  admin: {
    label: 'Administrador',
    description: 'Acceso completo a operaciones, reportes, flujo de caja, recordatorios y configuracion basica.',
  },
  contador: {
    label: 'Contador',
    description: 'Acceso a reportes financieros, flujo de caja y estado de resultados. Solo lectura en operaciones.',
  },
  operador: {
    label: 'Operador',
    description: 'Acceso a operaciones diarias, registro de produccion y recordatorios. Sin acceso a reportes financieros.',
  },
  user: {
    label: 'Usuario',
    description: 'Acceso basico de solo lectura al dashboard y lotes.',
  },
}

// GET /api/admin/users — List all users with roles (superadmin only)
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const authResult = await requireSuperadmin()
  if (authResult.error) return authResult.error

  const supabase = createServiceRoleClient()

  // Get all users from user_roles table
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('user_id, role, created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get user emails from auth.users via Supabase admin API (listUsers)
  const { data: { users } } = await supabase.auth.admin.listUsers()

  const usersWithRoles = (roles || []).map((r: Record<string, unknown>) => {
    const authUser = users?.find((u: { id: string }) => u.id === r.user_id)
    return {
      user_id: r.user_id,
      email: authUser?.email || r.user_id,
      full_name: authUser?.user_metadata?.full_name || '',
      role: r.role,
      role_description: ROLE_DESCRIPTIONS[(r.role as string) || 'user']?.label || r.role,
      created_at: r.created_at,
    }
  })

  return NextResponse.json({ users: usersWithRoles, roleDescriptions: ROLE_DESCRIPTIONS })
}

// PUT /api/admin/users — Update a user's role (superadmin only)
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase no configurado' }, { status: 503 })
  }

  const authResult = await requireSuperadmin()
  if (authResult.error) return authResult.error

  const body = await req.json()
  const { user_id, role } = body

  if (!user_id || !role) {
    return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Rol invalido. Roles validos: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Don't allow removing the last superadmin
  if (role !== 'superadmin') {
    const checkSupabase = createServiceRoleClient()
    const { data: superadmins } = await checkSupabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'superadmin')

    if (superadmins && superadmins.length <= 1 && superadmins[0].user_id === user_id) {
      return NextResponse.json({ error: 'No se puede eliminar el ultimo superadmin.' }, { status: 400 })
    }
  }

  const supabase = createServiceRoleClient()

  // Upsert the role
  const { data, error } = await supabase
    .from('user_roles')
    .upsert(
      { user_id, role },
      { onConflict: 'user_id' }
    )
    .select()

  if (error) {
    // If table doesn't exist, try insert
    if (error.code === '42P01') {
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id, role })
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    user_id,
    role,
    message: `Rol actualizado a "${ROLE_DESCRIPTIONS[role]?.label || role}" exitosamente.`,
  })
}
