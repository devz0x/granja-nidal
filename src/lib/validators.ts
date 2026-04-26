// ================================================================
// Zod validation schemas for API request bodies
// ================================================================
import { z } from 'zod/v4'

// ---- Cash Flow ----
export const cashFlowEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido (YYYY-MM-DD)'),
  category: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  amount: z.number().min(0, 'El monto debe ser mayor o igual a 0'),
  type: z.enum(['inflow', 'outflow'], { error: 'El tipo debe ser inflow o outflow' }),
  reference: z.string().max(200).default(''),
  entry_key: z.string().max(200).optional(),
})

export const cashFlowBatchSchema = z.array(cashFlowEntrySchema).min(1).max(100)

export const cashFlowUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido'),
  category: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
  amount: z.number().min(0),
  type: z.enum(['inflow', 'outflow']),
  reference: z.string().max(200).default(''),
})

// ---- Daily Entries ----
export const dailyEntrySchema = z.object({
  batch_id: z.string().uuid('batch_id debe ser un UUID valido'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha invalido (YYYY-MM-DD)'),
  eggs_collected: z.number().int().min(0).default(0),
  eggs_broken: z.number().int().min(0).default(0),
  mortality: z.number().int().min(0).default(0),
  feed_kg: z.number().min(0).default(0),
  water_liters: z.number().min(0).default(0),
  notes: z.string().max(2000).default(''),
})

export const dailyEntryBatchSchema = z.object({
  entries: z.array(dailyEntrySchema).min(1).max(500),
})

// ---- Batches ----
export const batchCreateSchema = z.object({
  batch_key: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200, 'El nombre es requerido'),
  hens: z.number().int().min(0).max(1000000).default(2000),
  laying_rate: z.number().min(0).max(100).default(80),
  is_laying: z.boolean().default(false),
  cycle_month: z.number().min(0).max(200).default(0),
  phase: z.enum(['pre_inicio', 'levantamiento', 'produccion', 'postura', 'recría'], { error: 'Fase invalida' }).default('pre_inicio'),
  sort_order: z.number().int().min(0).default(0),
})

// ---- Config ----
export const configSchema = z.object({
  config: z.record(z.unknown()).default({}),
})

// ---- Sync ----
export const syncEntriesSchema = z.object({
  entries: z.array(z.object({
    category: z.string().min(1),
    description: z.string(),
    amount: z.number().min(0),
    type: z.enum(['inflow', 'outflow']),
  })).min(1).max(50),
})

// ---- Reminders ----
export const reminderSchema = z.object({
  batch_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  category: z.string().max(50).default('otros'),
  priority: z.enum(['baja', 'media', 'alta', 'urgente']).default('media'),
  status: z.enum(['pendiente', 'en_progreso', 'completada', 'cancelada']).default('pendiente'),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  recurrence: z.enum(['unica', 'diaria', 'semanal', 'quincenal', 'mensual']).default('unica'),
  recurrence_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).default(''),
  estimated_cost: z.number().min(0).default(0),
  assigned_to: z.string().max(100).default(''),
})

// ---- Structural Expenses ----
export const structuralExpenseSchema = z.object({
  description: z.string().max(300),
  amount: z.number().min(0),
  frequency: z.enum(['unico', 'mensual', 'trimestral', 'semestral', 'anual']).default('unico'),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
})

// ---- Month validation (YYYY-MM) ----
export const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Formato de mes invalido (YYYY-MM)')

// ---- Farm ID validation ----
export const farmIdSchema = z.string().uuid('farm_id debe ser un UUID valido')

/**
 * Validate a request body against a schema. Returns parsed data or error response.
 */
export function validateBody<T>(schema: z.ZodType<T>, body: unknown): { data?: T; error?: { message: string; details?: unknown } } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstIssue = result.error.issues?.[0]
    return {
      error: {
        message: firstIssue?.message || 'Datos de entrada invalidos',
        details: result.error.issues?.map(i => ({ field: String(i.path.join('.')), message: i.message })),
      },
    }
  }
  return { data: result.data }
}
