// ================================================================
// AUTO-REMINDERS - Generacion automatica de recordatorios
// basada en cambios de lotes, fases de alimento, y ciclo productivo
// Granja Nidal - Supabase API (shared data)
// ================================================================
// Los recordatorios automaticos se escriben en Supabase (tabla 'reminders')
// Se identifican con un campo 'auto_source'

// ================================================================
// TYPES
// ================================================================
type ReminderCategory = 'vacuna' | 'alimento' | 'mantenimiento' | 'pago' | 'veterinario' | 'plagas' | 'infraestructura' | 'otros'
type ReminderPriority = 'urgente' | 'alta' | 'media' | 'baja'
type ReminderStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'
type ReminderRecurrence = 'unica' | 'diaria' | 'semanal' | 'mensual' | 'trimestral'

interface AutoReminder {
  id: string
  title: string
  description: string
  category: ReminderCategory
  priority: ReminderPriority
  status: ReminderStatus
  dueDate: string
  dueTime: string
  batchId: string
  recurrence: ReminderRecurrence
  recurrenceEnd: string
  completedAt: string
  createdAt: string
  notes: string
  estimatedCost: number
  assignedTo: string
  autoSource: string
}

// ================================================================
// HELPERS
// ================================================================
function generateId(): string {
  return `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function addWeeks(dateStr: string, weeks: number): string {
  return addDays(dateStr, weeks * 7)
}

// Fetch existing reminders from Supabase API
async function fetchReminders(farmId: string, batchId?: string): Promise<AutoReminder[]> {
  try {
    let url = `/api/reminders?farm_id=${farmId}`
    if (batchId) url += `&batch_id=${batchId}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    const raw = data.reminders || []
    return raw.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      title: r.title as string,
      description: (r.description || '') as string,
      category: (r.category || 'otros') as ReminderCategory,
      priority: (r.priority || 'media') as ReminderPriority,
      status: (r.status || 'pendiente') as ReminderStatus,
      dueDate: (r.due_date || '') as string,
      dueTime: (r.due_time || '08:00') as string,
      batchId: (r.batch_id || '') as string,
      recurrence: (r.recurrence || 'unica') as ReminderRecurrence,
      recurrenceEnd: (r.recurrence_end || '') as string,
      completedAt: (r.completed_at || '') as string,
      createdAt: (r.created_at || '') as string,
      notes: (r.notes || '') as string,
      estimatedCost: (r.estimated_cost || 0) as number,
      assignedTo: (r.assigned_to || '') as string,
      autoSource: (r.auto_source || '') as string,
    }))
  } catch {
    return []
  }
}

// Insert new reminders to Supabase API
async function insertReminders(farmId: string, reminders: AutoReminder[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/reminders?farm_id=${farmId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reminders: reminders.map(r => ({
          batch_id: r.batchId || null,
          title: r.title,
          description: r.description,
          category: r.category,
          priority: r.priority,
          status: r.status,
          due_date: r.dueDate || null,
          due_time: r.dueTime,
          recurrence: r.recurrence,
          recurrence_end: r.recurrenceEnd || null,
          completed_at: r.completedAt || null,
          notes: r.notes,
          estimated_cost: r.estimatedCost,
          assigned_to: r.assignedTo,
          auto_source: r.autoSource,
        })),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

// Delete a single reminder from Supabase
async function deleteReminderFromAPI(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Check if an auto-generated reminder already exists.
 */
function existsAutoReminder(reminders: AutoReminder[], batchId: string, autoSource: string, titleFragment: string): boolean {
  return reminders.some(r =>
    r.autoSource === autoSource &&
    r.batchId === batchId &&
    r.title.includes(titleFragment) &&
    r.status !== 'cancelada' &&
    r.status !== 'completada'
  )
}

// ================================================================
// VACCINATION SCHEDULE WD80 (semanas desde nacimiento)
// ================================================================
interface VaccineTemplate {
  name: string
  ageWeeks: number
  via: string
  notes: string
}

const WD80_VACCINE_SCHEDULE: VaccineTemplate[] = [
  { name: 'Newcastle (B1)', ageWeeks: 1, via: 'Ocular', notes: 'Primera dosis Newcastle' },
  { name: 'Gumboro', ageWeeks: 1, via: 'Agua bebida', notes: 'Primera dosis Gumboro' },
  { name: 'Bronquitis Infecciosa', ageWeeks: 2, via: 'Ocular', notes: '' },
  { name: 'Newcastle (B1 refuerzo)', ageWeeks: 3, via: 'Ocular', notes: 'Refuerzo' },
  { name: 'Gumboro (refuerzo)', ageWeeks: 3, via: 'Agua bebida', notes: '' },
  { name: 'Coriza Infecciosa', ageWeeks: 5, via: 'Inyectable', notes: '0.5 ml' },
  { name: 'Newcastle (Lasota)', ageWeeks: 6, via: 'Agua bebida', notes: '' },
  { name: 'Encefalomielitis', ageWeeks: 8, via: 'Ala', notes: '0.5 ml' },
  { name: 'Gumboro (refuerzo final)', ageWeeks: 14, via: 'Agua bebida', notes: '' },
]

// ================================================================
// FEED PHASE TRANSITIONS (meses desde inicio del lote)
// ================================================================
interface FeedPhaseTransition {
  phase: string
  phaseLabel: string
  monthStart: number
  estimatedCostNote: string
}

const FEED_PHASE_TRANSITIONS: FeedPhaseTransition[] = [
  { phase: 'inicio', phaseLabel: 'Inicio', monthStart: 1, estimatedCostNote: '~28g/ave/dia, 5-10 semanas' },
  { phase: 'crecimiento', phaseLabel: 'Crecimiento', monthStart: 2.5, estimatedCostNote: '~58g/ave/dia, 11-15 semanas' },
  { phase: 'pre_postura', phaseLabel: 'Pre-Postura', monthStart: 4, estimatedCostNote: '~85g/ave/dia, 16-18 semanas' },
  { phase: 'postura', phaseLabel: 'Postura', monthStart: 4.5, estimatedCostNote: '~115g/ave/dia, 18+ semanas' },
]

// ================================================================
// PUBLIC FUNCTIONS (async, Supabase API)
// ================================================================

/**
 * Genera todos los recordatorios automaticos al crear un nuevo lote.
 * Incluye: plan de vacunacion completo + transiciones de alimento + hitos.
 */
export async function generateRemindersForNewBatch(
  farmId: string,
  batchId: string,
  batchName: string,
  hens: number,
  startDate: string
): Promise<number> {
  const existing = await fetchReminders(farmId, batchId)
  const newReminders: AutoReminder[] = []

  // 1. Vacunacion (plan completo WD80)
  WD80_VACCINE_SCHEDULE.forEach(vac => {
    if (existsAutoReminder(existing, batchId, 'batch-created', vac.name)) return
    const dueDate = addWeeks(startDate, vac.ageWeeks)
    newReminders.push({
      id: generateId(),
      title: `Vacuna: ${vac.name}`,
      description: `Aplicar ${vac.name} al lote ${batchName} (${hens} aves). Via: ${vac.via}. ${vac.notes}`,
      category: 'vacuna',
      priority: 'alta',
      status: 'pendiente',
      dueDate,
      dueTime: '07:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: `Auto-generado: Plan vacunal WD80 - Semana ${vac.ageWeeks} de edad. Via: ${vac.via}. ${vac.notes}`,
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'batch-created',
    })
  })

  // 2. Transiciones de alimento por fase
  FEED_PHASE_TRANSITIONS.forEach(fp => {
    if (existsAutoReminder(existing, batchId, 'phase-change', fp.phaseLabel)) return
    const dueDate = addDays(startDate, Math.round(fp.monthStart * 30))
    newReminders.push({
      id: generateId(),
      title: `Comprar alimento: ${fp.phaseLabel}`,
      description: `El lote ${batchName} (${hens} aves) entrara a fase ${fp.phaseLabel} aproximadamente. Asegurar stock suficiente de alimento. ${fp.estimatedCostNote}`,
      category: 'alimento',
      priority: fp.phase === 'postura' ? 'alta' : 'media',
      status: 'pendiente',
      dueDate: addDays(dueDate, -7),
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: `Auto-generado: Transicion a fase ${fp.phaseLabel} a los ${fp.monthStart} meses. ${fp.estimatedCostNote}. Comprar alimento con al menos 7 dias de anticipacion.`,
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'phase-change',
    })
  })

  // 3. Hito: Inicio de postura (semana 18-20)
  const posturaDate = addWeeks(startDate, 18)
  if (!existsAutoReminder(existing, batchId, 'batch-milestone', 'Inicio de postura')) {
    newReminders.push({
      id: generateId(),
      title: `Milestone: Inicio de postura - ${batchName}`,
      description: `El lote ${batchName} deberia comenzar produccion de huevos. Verificar porcentaje de postura, ajustar alimento y comenzar registro diario de produccion.`,
      category: 'otros',
      priority: 'alta',
      status: 'pendiente',
      dueDate: posturaDate,
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Hito clave - Las aves WD80 inician postura alrededor de la semana 18-20. Monitorear % de postura y ajustar alimento.',
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'batch-milestone',
    })
  }

  // 4. Hito: Pico de postura (semana 25-28)
  const picoDate = addWeeks(startDate, 25)
  if (!existsAutoReminder(existing, batchId, 'batch-milestone', 'Pico de postura')) {
    newReminders.push({
      id: generateId(),
      title: `Milestone: Pico de postura esperado - ${batchName}`,
      description: `El lote ${batchName} deberia alcanzar su pico de postura (~80-85%). Es el momento de maxima produccion. Asegurar alimentacion optima y monitorear calidad de huevo.`,
      category: 'otros',
      priority: 'media',
      status: 'pendiente',
      dueDate: picoDate,
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Pico de produccion esperado semanas 25-28. Maxima rentabilidad del lote.',
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'batch-milestone',
    })
  }

  // 5. Mantenimiento inicial: Acondicionamiento de galpon (dia 0)
  if (!existsAutoReminder(existing, batchId, 'batch-created', 'Acondicionamiento')) {
    newReminders.push({
      id: generateId(),
      title: `Preparar galpon para ${batchName}`,
      description: `Antes de recibir las ${hens} pollitas, asegurar: limpieza profunda, desinfeccion, bebederos/comederos operativos, temperatura adecuada (32-35C), cama limpia, iluminacion.`,
      category: 'mantenimiento',
      priority: 'urgente',
      status: 'pendiente',
      dueDate: addDays(startDate, -3),
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Preparacion previa a la recepcion del nuevo lote. Checklist de acondicionamiento.',
      estimatedCost: 5000,
      assignedTo: '',
      autoSource: 'batch-created',
    })
  }

  // 6. Visita veterinaria inicial (semana 1)
  if (!existsAutoReminder(existing, batchId, 'batch-created', 'Visita veterinaria')) {
    newReminders.push({
      id: generateId(),
      title: `Visita veterinaria: Revision inicial ${batchName}`,
      description: `Revision general del lote ${batchName} durante la primera semana. Evaluar salud, comportamiento, consumo de alimento y agua. Establecer plan sanitario.`,
      category: 'veterinario',
      priority: 'alta',
      status: 'pendiente',
      dueDate: addWeeks(startDate, 1),
      dueTime: '09:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Primera revision veterinaria del ciclo. Fundamental para deteccion temprana de problemas.',
      estimatedCost: 3000,
      assignedTo: '',
      autoSource: 'batch-created',
    })
  }

  // 7. Control de plagas preventivo (mensual, primeros 3 meses)
  for (let m = 1; m <= 3; m++) {
    const pestDate = addDays(startDate, m * 30)
    if (!existsAutoReminder(existing, batchId, 'pest-control', `Control plagas mes ${m}`)) {
      newReminders.push({
        id: generateId(),
        title: `Control de plagas - ${batchName} (mes ${m})`,
        description: `Aplicacion preventiva de desinfectante y control de plagas en el galpon del lote ${batchName}. Mes ${m} de crianza.`,
        category: 'plagas',
        priority: 'media',
        status: 'pendiente',
        dueDate: pestDate,
        dueTime: '06:00',
        batchId,
        recurrence: 'unica',
        recurrenceEnd: '',
        completedAt: '',
        createdAt: new Date().toISOString(),
        notes: `Auto-generado: Control de plagas mensual preventivo. Mes ${m} de 3.`,
        estimatedCost: 2500,
        assignedTo: '',
        autoSource: 'pest-control',
      })
    }
  }

  // 8. Alerta de fin de ciclo (20 meses = ~87 semanas)
  const cycleEnd = addWeeks(startDate, 80)
  if (!existsAutoReminder(existing, batchId, 'cycle-warning', 'Fin de ciclo')) {
    newReminders.push({
      id: generateId(),
      title: `Fin de ciclo proximo - ${batchName}`,
      description: `El lote ${batchName} esta por completar su ciclo productivo de 20 meses. Planificar: disposicion de gallinas de desecho, limpieza de galpon, y recepcion de nuevo lote.`,
      category: 'otros',
      priority: 'alta',
      status: 'pendiente',
      dueDate: cycleEnd,
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Alerta anticipada de fin de ciclo. 20 meses totales, se avisa ~7 semanas antes para planificar el reemplazo.',
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'cycle-warning',
    })
  }

  if (newReminders.length > 0) {
    await insertReminders(farmId, newReminders)
  }

  return newReminders.length
}

/**
 * Genera recordatorios cuando un lote cambia de fase de alimento.
 */
export async function generatePhaseChangeReminders(
  farmId: string,
  batchId: string,
  batchName: string,
  hens: number,
  newPhase: string,
  newPhaseLabel: string
): Promise<number> {
  const existing = await fetchReminders(farmId, batchId)
  const newReminders: AutoReminder[] = []

  if (!existsAutoReminder(existing, batchId, 'phase-transition', newPhaseLabel)) {
    const transition = FEED_PHASE_TRANSITIONS.find(fp => fp.phase === newPhase)
    const costNote = transition?.estimatedCostNote || ''
    newReminders.push({
      id: generateId(),
      title: `Cambio de fase: ${newPhaseLabel} - ${batchName}`,
      description: `El lote ${batchName} (${hens} aves) ha cambiado a fase ${newPhaseLabel}. Verificar stock de alimento adecuado. ${costNote}`,
      category: 'alimento',
      priority: 'alta',
      status: 'pendiente',
      dueDate: new Date().toISOString().split('T')[0],
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: `Auto-generado: Deteccion de cambio de fase a ${newPhaseLabel}. ${costNote}`,
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'phase-transition',
    })
  }

  if (newPhase === 'postura') {
    if (!existsAutoReminder(existing, batchId, 'phase-transition', 'Registro produccion')) {
      newReminders.push({
        id: generateId(),
        title: `Iniciar registro diario de produccion - ${batchName}`,
        description: `El lote ${batchName} ha entrado a postura. Comenzar a registrar produccion diaria de huevos en la seccion Operaciones.`,
        category: 'otros',
        priority: 'alta',
        status: 'pendiente',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '08:00',
        batchId,
        recurrence: 'unica',
        recurrenceEnd: '',
        completedAt: '',
        createdAt: new Date().toISOString(),
        notes: 'Auto-generado: Las aves entraron a fase de postura. Es momento de registrar produccion.',
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'phase-transition',
      })
    }
  }

  if (newReminders.length > 0) {
    await insertReminders(farmId, newReminders)
  }

  return newReminders.length
}

/**
 * Genera alerta cuando un lote se acerca al fin del ciclo productivo.
 */
export async function generateCycleWarningReminder(
  farmId: string,
  batchId: string,
  batchName: string,
  cycleMonth: number,
  maxCycleMonths: number
): Promise<number> {
  const existing = await fetchReminders(farmId, batchId)
  const newReminders: AutoReminder[] = []

  const monthsLeft = maxCycleMonths - cycleMonth

  if (monthsLeft <= 3 && monthsLeft > 1) {
    if (!existsAutoReminder(existing, batchId, 'cycle-warning', `${monthsLeft} meses restantes`)) {
      newReminders.push({
        id: generateId(),
        title: `Fin de ciclo: ${monthsLeft} mes${monthsLeft !== 1 ? 'es' : ''} restante${monthsLeft !== 1 ? 's' : ''} - ${batchName}`,
        description: `El lote ${batchName} tiene ${monthsLeft} mes${monthsLeft !== 1 ? 'es' : ''} de ciclo productivo restante${monthsLeft !== 1 ? 's' : ''} (mes ${cycleMonth} de ${maxCycleMonths}). Planificar el reemplazo: ordenar pollitas, preparar galpon, programar desecho.`,
        category: 'otros',
        priority: monthsLeft <= 2 ? 'urgente' : 'alta',
        status: 'pendiente',
        dueDate: addDays(new Date().toISOString().split('T')[0], 14),
        dueTime: '08:00',
        batchId,
        recurrence: 'unica',
        recurrenceEnd: '',
        completedAt: '',
        createdAt: new Date().toISOString(),
        notes: `Auto-generado: Ciclo productivo en mes ${cycleMonth} de ${maxCycleMonths}. Quedan ${monthsLeft} meses. Iniciar planificacion de reemplazo.`,
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'cycle-warning',
      })
    }
  }

  if (monthsLeft <= 1 && monthsLeft > 0) {
    if (!existsAutoReminder(existing, batchId, 'cycle-warning', 'ULTIMO MES')) {
      newReminders.push({
        id: generateId(),
        title: `ULTIMO MES: Preparar desecho de ${batchName}`,
        description: `El lote ${batchName} esta en su ultimo mes de ciclo. Acciones inmediatas: contactar comprador de gallinas de desecho, planificar limpieza profunda del galpon, ordenar nuevo lote de pollitas.`,
        category: 'otros',
        priority: 'urgente',
        status: 'pendiente',
        dueDate: new Date().toISOString().split('T')[0],
        dueTime: '08:00',
        batchId,
        recurrence: 'unica',
        recurrenceEnd: '',
        completedAt: '',
        createdAt: new Date().toISOString(),
        notes: `Auto-generado: ALERTA CRITICA - Ultimo mes de ciclo del lote ${batchName}. Se requiere accion inmediata para planificar el reemplazo.`,
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'cycle-warning',
      })
    }
  }

  if (newReminders.length > 0) {
    await insertReminders(farmId, newReminders)
  }

  return newReminders.length
}

/**
 * Elimina TODOS los recordatorios asociados a un lote (auto-generados y manuales).
 */
export async function clearAutoRemindersForBatch(
  farmId: string,
  batchId: string
): Promise<number> {
  const reminders = await fetchReminders(farmId, batchId)
  let deleted = 0
  for (const r of reminders) {
    if (await deleteReminderFromAPI(r.id)) {
      deleted++
    }
  }
  return deleted
}

/**
 * Retorna el conteo de recordatorios auto-generados por fuente.
 */
export async function getAutoReminderStats(farmId: string): Promise<Record<string, number>> {
  const reminders = await fetchReminders(farmId)
  const stats: Record<string, number> = {}
  reminders.forEach(r => {
    if (r.autoSource) {
      stats[r.autoSource] = (stats[r.autoSource] || 0) + 1
    }
  })
  return stats
}
