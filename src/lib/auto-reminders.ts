// ================================================================
// AUTO-REMINDERS - Generación automática de recordatorios
// basada en cambios de lotes, fases de alimento, y ciclo productivo
// ================================================================
// Los recordatorios automáticos se escriben directamente en localStorage
// bajo la clave 'granja-wd80-reminders' y son leídos por RemindersPanel.
// Se identifican con un prefijo especial en el ID: "auto-"

const LS_KEY = 'granja-wd80-reminders'

// ================================================================
// TYPES (replicados para evitar dependencia circular)
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
  // Flag para identificar auto-generados
  autoSource: string  // ej: 'batch-created', 'phase-change', 'cycle-warning'
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

function getExistingReminders(): AutoReminder[] {
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) return JSON.parse(saved) as AutoReminder[]
  } catch { /* ignore */ }
  return []
}

function saveReminders(reminders: AutoReminder[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(reminders))
}

/**
 * Verifica si ya existe un recordatorio auto-generado con el mismo
 * autoSource, batchId y title para evitar duplicados.
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
  { phase: 'inicio', phaseLabel: 'Inicio', monthStart: 1, estimatedCostNote: '~28g/ave/día, 5-10 semanas' },
  { phase: 'crecimiento', phaseLabel: 'Crecimiento', monthStart: 2.5, estimatedCostNote: '~58g/ave/día, 11-15 semanas' },
  { phase: 'pre_postura', phaseLabel: 'Pre-Postura', monthStart: 4, estimatedCostNote: '~85g/ave/día, 16-18 semanas' },
  { phase: 'postura', phaseLabel: 'Postura', monthStart: 4.5, estimatedCostNote: '~115g/ave/día, 18+ semanas' },
]

// ================================================================
// PUBLIC FUNCTIONS
// ================================================================

/**
 * Genera todos los recordatorios automáticos al crear un nuevo lote.
 * Incluye: plan de vacunación completo + transiciones de alimento + hitos.
 */
export function generateRemindersForNewBatch(
  batchId: string,
  batchName: string,
  hens: number,
  startDate: string // YYYY-MM-DD, fecha de inicio del lote (llegada pollitas)
): number {
  const reminders = getExistingReminders()
  let addedCount = 0

  // 1. Recordatorio de vacunación (plan completo WD80)
  WD80_VACCINE_SCHEDULE.forEach(vac => {
    if (existsAutoReminder(reminders, batchId, 'batch-created', vac.name)) return
    const dueDate = addWeeks(startDate, vac.ageWeeks)
    reminders.push({
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
    addedCount++
  })

  // 2. Transiciones de alimento por fase
  FEED_PHASE_TRANSITIONS.forEach(fp => {
    if (existsAutoReminder(reminders, batchId, 'phase-change', fp.phaseLabel)) return
    const dueDate = addDays(startDate, Math.round(fp.monthStart * 30))
    reminders.push({
      id: generateId(),
      title: `Comprar alimento: ${fp.phaseLabel}`,
      description: `El lote ${batchName} (${hens} aves) entrará a fase ${fp.phaseLabel} aproximadamente. Asegurar stock suficiente de alimento. ${fp.estimatedCostNote}`,
      category: 'alimento',
      priority: fp.phase === 'postura' ? 'alta' : 'media',
      status: 'pendiente',
      dueDate: addDays(dueDate, -7), // Recordar 7 días antes
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: `Auto-generado: Transición a fase ${fp.phaseLabel} a los ${fp.monthStart} meses. ${fp.estimatedCostNote}. Comprar alimento con al menos 7 días de anticipación.`,
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'phase-change',
    })
    addedCount++
  })

  // 3. Hito: Inicio de postura (semana 18-20)
  const posturaDate = addWeeks(startDate, 18)
  if (!existsAutoReminder(reminders, batchId, 'batch-milestone', 'Inicio de postura')) {
    reminders.push({
      id: generateId(),
      title: `Milestone: Inicio de postura - ${batchName}`,
      description: `El lote ${batchName} debería comenzar producción de huevos. Verificar porcentaje de postura, ajustar alimento y comenzar registro diario de producción.`,
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
    addedCount++
  }

  // 4. Hito: Pico de postura (semana 25-28)
  const picoDate = addWeeks(startDate, 25)
  if (!existsAutoReminder(reminders, batchId, 'batch-milestone', 'Pico de postura')) {
    reminders.push({
      id: generateId(),
      title: `Milestone: Pico de postura esperado - ${batchName}`,
      description: `El lote ${batchName} debería alcanzar su pico de postura (~80-85%). Es el momento de máxima producción. Asegurar alimentación óptima y monitorear calidad de huevo.`,
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
      notes: 'Auto-generado: Pico de producción esperado semanas 25-28. Máxima rentabilidad del lote.',
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'batch-milestone',
    })
    addedCount++
  }

  // 5. Mantenimiento inicial: Acondicionamiento de galpon (día 0)
  if (!existsAutoReminder(reminders, batchId, 'batch-created', 'Acondicionamiento')) {
    reminders.push({
      id: generateId(),
      title: `Preparar galpon para ${batchName}`,
      description: `Antes de recibir las ${hens} pollitas, asegurar: limpieza profunda, desinfección, bebederos/comederos operativos, temperatura adecuada (32-35°C), cama limpia, iluminación.`,
      category: 'mantenimiento',
      priority: 'urgente',
      status: 'pendiente',
      dueDate: addDays(startDate, -3), // 3 días antes de llegada
      dueTime: '08:00',
      batchId,
      recurrence: 'unica',
      recurrenceEnd: '',
      completedAt: '',
      createdAt: new Date().toISOString(),
      notes: 'Auto-generado: Preparación previa a la recepción del nuevo lote. Checklist de acondicionamiento.',
      estimatedCost: 5000,
      assignedTo: '',
      autoSource: 'batch-created',
    })
    addedCount++
  }

  // 6. Visita veterinaria inicial (semana 1)
  if (!existsAutoReminder(reminders, batchId, 'batch-created', 'Visita veterinaria')) {
    reminders.push({
      id: generateId(),
      title: `Visita veterinaria: Revisión inicial ${batchName}`,
      description: `Revisión general del lote ${batchName} durante la primera semana. Evaluar salud, comportamiento, consumo de alimento y agua. Establecer plan sanitario.`,
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
      notes: 'Auto-generado: Primera revisión veterinaria del ciclo. Fundamental para detección temprana de problemas.',
      estimatedCost: 3000,
      assignedTo: '',
      autoSource: 'batch-created',
    })
    addedCount++
  }

  // 7. Control de plagas preventivo (mensual, primeros 3 meses)
  for (let m = 1; m <= 3; m++) {
    const pestDate = addDays(startDate, m * 30)
    if (!existsAutoReminder(reminders, batchId, 'pest-control', `Control plagas mes ${m}`)) {
      reminders.push({
        id: generateId(),
        title: `Control de plagas - ${batchName} (mes ${m})`,
        description: `Aplicación preventiva de desinfectante y control de plagas en el galpon del lote ${batchName}. Mes ${m} de crianza.`,
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
        notes: `Auto-generado: Control de plagas mensual preventivo. Mes ${m} de ${3}.`,
        estimatedCost: 2500,
        assignedTo: '',
        autoSource: 'pest-control',
      })
      addedCount++
    }
  }

  // 8. Alerta de fin de ciclo (20 meses = ~87 semanas)
  const cycleEnd = addWeeks(startDate, 80) // Avisar 7 semanas antes del fin (semana 80 de 87)
  if (!existsAutoReminder(reminders, batchId, 'cycle-warning', 'Fin de ciclo')) {
    reminders.push({
      id: generateId(),
      title: `Fin de ciclo próximo - ${batchName}`,
      description: `El lote ${batchName} está por completar su ciclo productivo de 20 meses. Planificar: disposición de gallinas de desecho, limpieza de galpon, y recepción de nuevo lote.`,
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
    addedCount++
  }

  if (addedCount > 0) {
    saveReminders(reminders)
  }

  return addedCount
}

/**
 * Genera recordatorios cuando un lote cambia de fase de alimento.
 * Se llama al detectar un cambio de fase en updateBatch.
 */
export function generatePhaseChangeReminders(
  batchId: string,
  batchName: string,
  hens: number,
  newPhase: string,
  newPhaseLabel: string
): number {
  const reminders = getExistingReminders()
  let addedCount = 0

  // Recordatorio de compra de alimento para la nueva fase
  if (!existsAutoReminder(reminders, batchId, 'phase-transition', newPhaseLabel)) {
    const transition = FEED_PHASE_TRANSITIONS.find(fp => fp.phase === newPhase)
    const costNote = transition?.estimatedCostNote || ''
    reminders.push({
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
      notes: `Auto-generado: Detección de cambio de fase a ${newPhaseLabel}. ${costNote}`,
      estimatedCost: 0,
      assignedTo: '',
      autoSource: 'phase-transition',
    })
    addedCount++
  }

  // Si entra a postura, recordatorio especial
  if (newPhase === 'postura') {
    if (!existsAutoReminder(reminders, batchId, 'phase-transition', 'Registro producción')) {
      reminders.push({
        id: generateId(),
        title: `Iniciar registro diario de producción - ${batchName}`,
        description: `El lote ${batchName} ha entrado a postura. Comenzar a registrar producción diaria de huevos en la sección Operaciones.`,
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
        notes: 'Auto-generado: Las aves entraron a fase de postura. Es momento de registrar producción.',
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'phase-transition',
      })
      addedCount++
    }
  }

  if (addedCount > 0) {
    saveReminders(reminders)
  }

  return addedCount
}

/**
 * Genera alerta cuando un lote se acerca al fin del ciclo productivo.
 */
export function generateCycleWarningReminder(
  batchId: string,
  batchName: string,
  cycleMonth: number,
  maxCycleMonths: number
): number {
  const reminders = getExistingReminders()
  let addedCount = 0

  const monthsLeft = maxCycleMonths - cycleMonth

  // Alerta a 3 meses del fin
  if (monthsLeft <= 3 && monthsLeft > 1) {
    if (!existsAutoReminder(reminders, batchId, 'cycle-warning', `${monthsLeft} meses restantes`)) {
      reminders.push({
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
        notes: `Auto-generado: Ciclo productivo en mes ${cycleMonth} de ${maxCycleMonths}. Quedan ${monthsLeft} meses. Iniciar planificación de reemplazo.`,
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'cycle-warning',
      })
      addedCount++
    }
  }

  // Alerta crítica: último mes
  if (monthsLeft <= 1 && monthsLeft > 0) {
    if (!existsAutoReminder(reminders, batchId, 'cycle-warning', 'ULTIMO MES')) {
      reminders.push({
        id: generateId(),
        title: `ULTIMO MES: Preparar desecho de ${batchName}`,
        description: `El lote ${batchName} está en su ultimo mes de ciclo. Acciones inmediatas: contactar comprador de gallinas de desecho, planificar limpieza profunda del galpon, ordenar nuevo lote de pollitas.`,
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
        notes: `Auto-generado: ALERTA CRITICA - Ultimo mes de ciclo del lote ${batchName}. Se requiere acción inmediata para planificar el reemplazo.`,
        estimatedCost: 0,
        assignedTo: '',
        autoSource: 'cycle-warning',
      })
      addedCount++
    }
  }

  if (addedCount > 0) {
    saveReminders(reminders)
  }

  return addedCount
}

/**
 * Elimina TODOS los recordatorios asociados a un lote (auto-generados y manuales).
 * Se llama al borrar un lote para que sus alertas desaparezcan.
 */
export function clearAutoRemindersForBatch(batchId: string): number {
  const reminders = getExistingReminders()
  const before = reminders.length
  const filtered = reminders.filter(r => r.batchId !== batchId)
  if (filtered.length < before) {
    saveReminders(filtered)
  }
  return before - filtered.length
}

/**
 * Retorna el conteo de recordatorios auto-generados por fuente.
 */
export function getAutoReminderStats(): Record<string, number> {
  const reminders = getExistingReminders()
  const stats: Record<string, number> = {}
  reminders.forEach(r => {
    if (r.autoSource) {
      stats[r.autoSource] = (stats[r.autoSource] || 0) + 1
    }
  })
  return stats
}
