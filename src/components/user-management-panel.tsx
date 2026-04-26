'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Shield, Users, ChevronLeft, Loader2, AlertTriangle, CheckCircle2,
  Crown, UserCog, Calculator, HardHat, User as UserIcon,
} from 'lucide-react'
import { toast } from 'sonner'

// ================================================================
// TYPES
// ================================================================
interface UserWithRole {
  user_id: string
  email: string
  full_name: string
  role: string
  role_description: string
  created_at: string
}

interface RoleInfo {
  label: string
  description: string
}

type RoleKey = 'superadmin' | 'admin' | 'contador' | 'operador' | 'user'

const ROLE_CONFIG: Record<RoleKey, { label: string; description: string; color: string; icon: typeof Shield }> = {
  superadmin: {
    label: 'Super Administrador',
    description: 'Acceso total: gestion de usuarios, configuracion global, todos los modulos.',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Crown,
  },
  admin: {
    label: 'Administrador',
    description: 'Acceso completo a operaciones, reportes, flujo de caja y configuracion basica.',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Shield,
  },
  contador: {
    label: 'Contador',
    description: 'Acceso a reportes financieros, flujo de caja y estado de resultados. Solo lectura en operaciones.',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Calculator,
  },
  operador: {
    label: 'Operador',
    description: 'Acceso a operaciones diarias, registro de produccion y recordatorios.',
    color: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: HardHat,
  },
  user: {
    label: 'Usuario',
    description: 'Acceso basico de solo lectura al dashboard y lotes.',
    color: 'bg-stone-100 text-stone-700 border-stone-200',
    icon: UserIcon,
  },
}

// ================================================================
// COMPONENT
// ================================================================
interface UserManagementPanelProps {
  goBack: () => void
}

export default function UserManagementPanel({ goBack }: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch {
      toast.error('Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(data.message || 'Rol actualizado')
        fetchUsers()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Error al actualizar rol')
      }
    } catch {
      toast.error('Error de conexion')
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center text-stone-400">
          <Loader2 className="w-10 h-10 mx-auto mb-2 animate-spin" />
          <p className="text-sm">Cargando usuarios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-600" />
          Gestion de Usuarios
        </h2>
      </div>

      {/* Role descriptions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][]).map(([key, config]) => {
          const Icon = config.icon
          const count = users.filter(u => u.role === key).length
          return (
            <Card key={key} className="border border-stone-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${config.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-stone-800">{config.label}</p>
                    <p className="text-[10px] text-stone-400">{config.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{count} usuario{count !== 1 ? 's' : ''}</Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Separator />

      {/* Users table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Usuarios Registrados ({users.length})</CardTitle>
          <CardDescription className="text-[11px]">
            Cambia el rol de un usuario seleccionando una opcion del menu desplegable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-8">No se encontraron usuarios.</p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Usuario</TableHead>
                    <TableHead className="text-[10px]">Rol Actual</TableHead>
                    <TableHead className="text-[10px]">Cambiar Rol</TableHead>
                    <TableHead className="text-[10px] text-right">Fecha Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map(user => {
                    const roleConfig = ROLE_CONFIG[user.role as RoleKey] || ROLE_CONFIG.user
                    const RoleIcon = roleConfig.icon
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell className="text-[11px]">
                          <div>
                            <p className="font-medium text-stone-800 truncate max-w-[200px]">
                              {user.full_name || user.email}
                            </p>
                            {user.full_name && (
                              <p className="text-[10px] text-stone-400 truncate max-w-[200px]">{user.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          <Badge className={`${roleConfig.color} text-[9px] border`}>
                            <RoleIcon className="w-2.5 h-2.5 mr-0.5" />
                            {roleConfig.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px]">
                          {updatingId === user.user_id ? (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin text-stone-400" />
                            </div>
                          ) : (
                            <Select value={user.role} onValueChange={v => handleRoleChange(user.user_id, v)}>
                              <SelectTrigger className="h-7 text-[10px] w-[160px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {(Object.entries(ROLE_CONFIG) as [RoleKey, typeof ROLE_CONFIG[RoleKey]][]).map(([key, config]) => (
                                  <SelectItem key={key} value={key}>
                                    <div className="flex items-center gap-1.5">
                                      <config.icon className="w-3 h-3" />
                                      {config.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-[11px] text-right text-stone-400">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('es-DO') : '-'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info box */}
      <div className="flex items-start gap-2 text-[10px] text-stone-500 bg-stone-50 p-3 rounded-lg">
        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
        <div>
          <p className="font-medium text-stone-600">Nota sobre permisos</p>
          <p>Los cambios de rol toman efecto inmediatamente. El ultimo superadmin no puede ser degradado. Los roles controlan el acceso a diferentes secciones de la aplicacion.</p>
        </div>
      </div>
    </div>
  )
}
