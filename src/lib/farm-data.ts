// ================================================================
// SHARED TYPES, CONSTANTS, HELPERS, AND CALCULATION ENGINE
// Granja Nidal - Extracted from page.tsx for reuse across components
// ================================================================

export type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

export interface FeedPhase {
  label: string
  consumption: number  // grams/bird/day
  price: number        // RD$/quintal
  weeks: string        // week range
}

export interface FarmConfig {
  eggPrice: number
  henSalePrice: number
  chickPrice: number
  feedPhases: Record<PhaseKey, FeedPhase>
  vaccinesCostPerBird: number
  equipmentCostPerBird: number
  mortalityRate: number
  shed1Cost: number
  shedAdditionalCost: number
  baseLayingRate: number
  layingCycleMonths: number
  hensPerBatch: number
  fixedCostsMonthly: number
  otherCosts: number
}

export interface BatchConfig {
  id: string
  name: string
  hens: number
  layingRate: number
  isLaying: boolean
  cycleMonth: number
  phase: PhaseKey
}

export type StructuralFrequency = 'unico' | 'mensual' | 'trimestral' | 'semestral' | 'anual'

export interface StructuralExpense {
  id: string
  description: string
  amount: number
  frequency: StructuralFrequency
  dateAdded: string
  isActive: boolean
}

export interface MonthlyRecord {
  id: string
  month: string
  date: string
  batches: BatchConfig[]
  config: FarmConfig
  notes: string
  revenue: number
  expenses: number
  net: number
}

// ================================================================
// CONSTANTS
// ================================================================
export const CONFIG_VERSION = 2

export const DEFAULT_FEED: Record<PhaseKey, FeedPhase> = {
  pre_inicio:  { label: 'Pre-Inicio',  consumption: 12,  price: 1986, weeks: 'S0-4' },
  inicio:      { label: 'Inicio',       consumption: 28,  price: 1986, weeks: 'S5-10' },
  crecimiento: { label: 'Crecimiento',  consumption: 58,  price: 1724, weeks: 'S11-15' },
  pre_postura: { label: 'Pre-Postura',  consumption: 85,  price: 1493, weeks: 'S16-18' },
  postura:     { label: 'Postura',      consumption: 115, price: 1300, weeks: 'S18+' },
}

export const DEFAULT_CONFIG: FarmConfig = {
  eggPrice: 5.50,
  henSalePrice: 100,
  chickPrice: 86.10,
  feedPhases: DEFAULT_FEED,
  vaccinesCostPerBird: 52.68,
  equipmentCostPerBird: 23.60,
  mortalityRate: 5,
  shed1Cost: 624750,
  shedAdditionalCost: 315000,
  baseLayingRate: 80,
  layingCycleMonths: 20,
  hensPerBatch: 2000,
  fixedCostsMonthly: 85000,
  otherCosts: 0,
}

export const BATCH_NAMES = ['Galpon 1', 'Galpon 2', 'Galpon 3', 'Galpon 4']

export const PHASE_COLORS: Record<PhaseKey, string> = {
  pre_inicio: 'bg-gray-100 text-gray-700',
  inicio: 'bg-sky-100 text-sky-700',
  crecimiento: 'bg-cyan-100 text-cyan-700',
  pre_postura: 'bg-amber-100 text-amber-700',
  postura: 'bg-green-100 text-green-700',
}

export const PHASE_BORDER_COLORS: Record<PhaseKey, string> = {
  pre_inicio: 'border-l-gray-400',
  inicio: 'border-l-sky-400',
  crecimiento: 'border-l-cyan-400',
  pre_postura: 'border-l-amber-400',
  postura: 'border-l-green-400',
}

export const PHASE_KEYS: PhaseKey[] = ['pre_inicio', 'inicio', 'crecimiento', 'pre_postura', 'postura']

export const FREQUENCY_LABELS: Record<StructuralFrequency, string> = {
  unico: 'Unico (una vez)',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

export const FREQUENCY_MULTIPLIER: Record<StructuralFrequency, number> = {
  unico: 1,
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
}

export const DEFAULT_STRUCTURAL_EXPENSES: StructuralExpense[] = [
  { id: 'se-1', description: 'Mantenimiento de bebederos y comederos', amount: 5000, frequency: 'trimestral', dateAdded: '', isActive: true },
  { id: 'se-2', description: 'Desinfeccion de galpones', amount: 8000, frequency: 'trimestral', dateAdded: '', isActive: true },
  { id: 'se-3', description: 'Reparacion de cercas y techos', amount: 15000, frequency: 'semestral', dateAdded: '', isActive: true },
]

// ================================================================
// HELPERS
// ================================================================
export function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function fmtNum(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}

export function fmtPct(value: number): string {
  return value.toFixed(1) + '%'
}

export function getPhaseFromMonth(month: number): PhaseKey {
  if (month < 1) return 'pre_inicio'
  if (month < 2.5) return 'inicio'
  if (month < 4) return 'crecimiento'
  if (month < 4.5) return 'pre_postura'
  return 'postura'
}

export function createDefaultBatches(): BatchConfig[] {
  return BATCH_NAMES.map((name, i) => ({
    id: `batch-${i}`,
    name,
    hens: DEFAULT_CONFIG.hensPerBatch,
    layingRate: DEFAULT_CONFIG.baseLayingRate,
    isLaying: false,
    cycleMonth: 0,
    phase: 'pre_inicio' as PhaseKey,
  }))
}

// ================================================================
// CALCULATION ENGINE
// ================================================================
export interface BatchCalcDetail {
  id: string
  name: string
  phase: PhaseKey
  hens: number
  isLaying: boolean
  layingRate: number
  cycleMonth: number
  eggsPerDay: number
  eggsPerMonth: number
  eggRevenue: number
  feedConsumption: number
  feedPrice: number
  monthlyFeedKg: number
  monthlyFeedCost: number
  initialInvestmentPerBird: number
  batchInvestment: number
  netBalance: number
}

export interface CalculationsResult {
  batchDetails: BatchCalcDetail[]
  totalEggRevenue: number
  totalHenSaleRevenue: number
  totalRevenue: number
  totalFeedCost: number
  totalFeedKg: number
  totalExpenses: number
  netProfit: number
  layingBatches: number
  totalHens: number
  totalEggs: number
  profitMargin: number
  feedPercentage: number
  costPerEgg: number
  costPerBirdMonthly: number
  revenuePerBirdMonthly: number
  feedCostPerLayingBird: number
  newBatchInvestment: number
  newBatchInvestmentWithMortality: number
  infraCost: number
  preLayMonthlyCost: number
  revenuePerFeedRD: number
  breakEvenEggsPerDay: number
  dailyExpenses: number
  layingBirds: number
  structuralMonthlyTotal: number
  structuralAnnualTotal: number
  activeStructural: number
  totalStructuralItems: number
  feedCostByPhase: {
    phaseKey: PhaseKey; label: string; batchesCount: number; hens: number
    consumption: number; price: number; defaultPrice: number
    monthlyKg: number; monthlyCost: number; defMonthlyCost: number
    priceDiff: number; costDiff: number
  }[]
  allPosturaFeedCost: number
  allPosturaFeedCostDefault: number
  defaultTotalFeedCost: number
  feedPriceImpact: number
}

export function computeCalculations(cfg: FarmConfig, bts: BatchConfig[], se: StructuralExpense[]): CalculationsResult {
  const batchDetails: BatchCalcDetail[] = bts.map(batch => {
    const phase = batch.phase
    const feed = cfg.feedPhases[phase]
    const monthlyFeedKg = (batch.hens * feed.consumption * 30) / 1000
    const monthlyFeedCost = monthlyFeedKg * (feed.price / 100)
    const eggsPerDay = batch.isLaying ? batch.hens * (batch.layingRate / 100) : 0
    const eggsPerMonth = Math.round(eggsPerDay * 30)
    const eggRevenue = eggsPerMonth * cfg.eggPrice
    const initialInvestmentPerBird = cfg.chickPrice + cfg.vaccinesCostPerBird + cfg.equipmentCostPerBird
    const batchInvestment = batch.hens * initialInvestmentPerBird
    return {
      id: batch.id, name: batch.name, phase, hens: batch.hens,
      isLaying: batch.isLaying, layingRate: batch.layingRate, cycleMonth: batch.cycleMonth,
      eggsPerDay, eggsPerMonth, eggRevenue,
      feedConsumption: feed.consumption, feedPrice: feed.price,
      monthlyFeedKg, monthlyFeedCost, initialInvestmentPerBird, batchInvestment,
      netBalance: eggRevenue - monthlyFeedCost,
    }
  })

  const totalEggRevenue = batchDetails.reduce((s, b) => s + b.eggRevenue, 0)
  const totalFeedCost = batchDetails.reduce((s, b) => s + b.monthlyFeedCost, 0)
  const totalFeedKg = batchDetails.reduce((s, b) => s + b.monthlyFeedKg, 0)
  const totalRevenue = totalEggRevenue

  const activeStructural = se.filter(e => e.isActive)
  const structuralMonthlyTotal = activeStructural.reduce((sum, e) => {
    const mult = FREQUENCY_MULTIPLIER[e.frequency]
    return sum + (e.amount * mult / 12)
  }, 0)
  const structuralAnnualTotal = activeStructural.reduce((sum, e) => sum + e.amount * FREQUENCY_MULTIPLIER[e.frequency], 0)

  const totalExpenses = totalFeedCost + cfg.fixedCostsMonthly + cfg.otherCosts + structuralMonthlyTotal
  const netProfit = totalRevenue - totalExpenses
  const layingBatches = bts.filter(b => b.isLaying).length
  const totalHens = bts.reduce((s, b) => s + b.hens, 0)
  const totalEggs = batchDetails.reduce((s, b) => s + b.eggsPerMonth, 0)

  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  const feedPercentage = totalExpenses > 0 ? (totalFeedCost / totalExpenses) * 100 : 0
  const costPerEgg = totalEggs > 0 ? totalExpenses / totalEggs : 0
  const costPerBirdMonthly = totalHens > 0 ? totalExpenses / totalHens : 0
  const revenuePerBirdMonthly = totalHens > 0 ? totalRevenue / totalHens : 0

  const layingBirds = bts.filter(b => b.isLaying).reduce((s, b) => s + b.hens, 0)
  const feedCostPerLayingBird = layingBirds > 0 ? totalFeedCost / layingBirds : 0
  const totalHenSaleRevenue = totalHens * cfg.henSalePrice

  const newBatchInvestment = cfg.hensPerBatch * (cfg.chickPrice + cfg.vaccinesCostPerBird + cfg.equipmentCostPerBird)
  const newBatchInvestmentWithMortality = newBatchInvestment / (1 - cfg.mortalityRate / 100)
  const infraCost = cfg.shed1Cost + (Math.max(0, bts.length - 1) * cfg.shedAdditionalCost)

  const preLayMonthlyCost = PHASE_KEYS
    .filter(k => k !== 'postura')
    .reduce((sum, key) => {
      const feed = cfg.feedPhases[key]
      const monthlyKg = (cfg.hensPerBatch * feed.consumption * 30) / 1000
      return sum + (monthlyKg * feed.price / 100)
    }, 0) / 4

  const layingBatchDetails = batchDetails.filter(b => b.isLaying)
  const totalLayingFeedCost = layingBatchDetails.reduce((s, b) => s + b.monthlyFeedCost, 0)
  const revenuePerFeedRD = totalLayingFeedCost > 0 ? totalEggRevenue / totalLayingFeedCost : 0

  const dailyExpenses = totalExpenses / 30
  const breakEvenEggsPerDay = cfg.eggPrice > 0 ? Math.ceil(dailyExpenses / cfg.eggPrice) : 0

  const feedCostByPhase = PHASE_KEYS.map(key => {
    const feed = cfg.feedPhases[key]
    const defFeed = DEFAULT_FEED[key]
    const batchesInPhase = bts.filter(b => b.phase === key)
    const hensInPhase = batchesInPhase.reduce((s, b) => s + b.hens, 0)
    const monthlyKg = (hensInPhase * feed.consumption * 30) / 1000
    const monthlyCost = monthlyKg * (feed.price / 100)
    const defMonthlyKg = (hensInPhase * defFeed.consumption * 30) / 1000
    const defMonthlyCost = defMonthlyKg * (defFeed.price / 100)
    return {
      phaseKey: key, label: feed.label, batchesCount: batchesInPhase.length, hens: hensInPhase,
      consumption: feed.consumption, price: feed.price, defaultPrice: defFeed.price,
      monthlyKg, monthlyCost, defMonthlyCost,
      priceDiff: feed.price - defFeed.price, costDiff: monthlyCost - defMonthlyCost,
    }
  })

  const allPosturaFeedCost = bts.reduce((s, b) => {
    const posturaFeed = cfg.feedPhases.postura
    return s + ((b.hens * posturaFeed.consumption * 30) / 1000) * (posturaFeed.price / 100)
  }, 0)
  const allPosturaFeedCostDefault = bts.reduce((s, b) => {
    const posturaFeed = DEFAULT_FEED.postura
    return s + ((b.hens * posturaFeed.consumption * 30) / 1000) * (posturaFeed.price / 100)
  }, 0)
  const defaultTotalFeedCost = bts.reduce((s, b) => {
    const defFeed = DEFAULT_FEED[b.phase]
    const defKg = (b.hens * defFeed.consumption * 30) / 1000
    return s + defKg * (defFeed.price / 100)
  }, 0)
  const feedPriceImpact = totalFeedCost - defaultTotalFeedCost

  return {
    batchDetails, totalEggRevenue, totalHenSaleRevenue, totalRevenue,
    totalFeedCost, totalFeedKg, totalExpenses, netProfit, layingBatches,
    totalHens, totalEggs, profitMargin, feedPercentage, costPerEgg,
    costPerBirdMonthly, revenuePerBirdMonthly, feedCostPerLayingBird,
    newBatchInvestment, newBatchInvestmentWithMortality, infraCost,
    preLayMonthlyCost, revenuePerFeedRD, breakEvenEggsPerDay, dailyExpenses,
    layingBirds, structuralMonthlyTotal, structuralAnnualTotal,
    activeStructural: activeStructural.length, totalStructuralItems: se.length,
    feedCostByPhase, allPosturaFeedCost, allPosturaFeedCostDefault,
    defaultTotalFeedCost, feedPriceImpact,
  }
}

// Count alerts for a specific batch from localStorage
export function getAlertCountForBatch(batchId: string): number {
  try {
    const saved = localStorage.getItem('granja-wd80-reminders')
    if (!saved) return 0
    const reminders = JSON.parse(saved) as Array<{ status: string; batchId: string; dueDate: string; priority: string }>
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return reminders.filter(r =>
      r.batchId === batchId &&
      r.status !== 'completada' &&
      r.status !== 'cancelada'
    ).length
  } catch {
    return 0
  }
}

// Count total urgent alerts from localStorage
export function getUrgentReminderCount(): number {
  try {
    const saved = localStorage.getItem('granja-wd80-reminders')
    if (!saved) return 0
    const reminders = JSON.parse(saved) as Array<{ status: string; dueDate: string; priority: string }>
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const active = reminders.filter(r => r.status !== 'completada' && r.status !== 'cancelada')
    const overdue = active.filter(r => {
      const due = new Date(r.dueDate)
      due.setHours(0, 0, 0, 0)
      return due < today
    })
    const urgent = active.filter(r => {
      const due = new Date(r.dueDate)
      const diff = Math.ceil((due.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      return r.priority === 'urgente' && diff <= 1
    })
    return overdue.length + urgent.length
  } catch {
    return 0
  }
}
