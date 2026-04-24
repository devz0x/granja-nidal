'use client'

import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// ================================================================
// TYPES (mirrored from page.tsx for standalone use)
// ================================================================
type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

interface BatchConfig {
  id: string
  name: string
  hens: number
  layingRate: number
  isLaying: boolean
  cycleMonth: number
  phase: PhaseKey
}

interface FeedPhase {
  label: string
  consumption: number
  price: number
  weeks: string
}

interface FarmConfig {
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

interface CalculationsResult {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalEggs: number
  totalHens: number
  layingBatches: number
  totalFeedKg: number
  profitMargin: number
  batchDetails: Array<{
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
    monthlyFeedCost: number
    netBalance: number
  }>
}

interface FarmMapViewProps {
  batches: BatchConfig[]
  config: FarmConfig
  calculations: CalculationsResult
}

// ================================================================
// RPG THEME CONSTANTS
// ================================================================
const PHASE_HUD_COLORS: Record<PhaseKey, { bg: string; border: string; text: string; glow: string; roof: string }> = {
  pre_inicio: {
    bg: 'bg-slate-200',
    border: 'border-slate-400',
    text: 'text-slate-600',
    glow: 'shadow-slate-300/50',
    roof: '#94a3b8',
  },
  inicio: {
    bg: 'bg-sky-200',
    border: 'border-sky-400',
    text: 'text-sky-700',
    glow: 'shadow-sky-300/50',
    roof: '#38bdf8',
  },
  crecimiento: {
    bg: 'bg-teal-200',
    border: 'border-teal-400',
    text: 'text-teal-700',
    glow: 'shadow-teal-300/50',
    roof: '#2dd4bf',
  },
  pre_postura: {
    bg: 'bg-amber-200',
    border: 'border-amber-400',
    text: 'text-amber-700',
    glow: 'shadow-amber-300/50',
    roof: '#fbbf24',
  },
  postura: {
    bg: 'bg-emerald-200',
    border: 'border-emerald-400',
    text: 'text-emerald-700',
    glow: 'shadow-emerald-300/50',
    roof: '#34d399',
  },
}

const PHASE_ICONS: Record<PhaseKey, string> = {
  pre_inicio: '\u{1F423}',    // hatching chick
  inicio: '\u{1F425}',        // baby chick
  crecimiento: '\u{1F98B}',   // chicken
  pre_postura: '\u{1F414}',   // rooster
  postura: '\u{1F95A}',       // egg
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  pre_inicio: 'Pre-Inicio',
  inicio: 'Inicio',
  crecimiento: 'Crecimiento',
  pre_postura: 'Pre-Postura',
  postura: 'Postura',
}

// ================================================================
// HELPER: Format numbers
// ================================================================
function fmtNum(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}

function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// ================================================================
// PIXEL ART TREE COMPONENT
// ================================================================
function PixelTree({ variant = 1, x = 0, y = 0 }: { variant?: number; x?: number; y?: number }) {
  const trunkColor = variant % 2 === 0 ? '#92400e' : '#78350f'
  const leafColors = [
    ['#16a34a', '#15803d', '#166534'],
    ['#22c55e', '#16a34a', '#15803d'],
    ['#059669', '#047857', '#065f46'],
  ]
  const [c1, c2, c3] = leafColors[variant % 3]

  return (
    <svg
      width="32"
      height="40"
      viewBox="0 0 32 40"
      style={{ position: 'absolute', left: x, top: y, imageRendering: 'pixelated' }}
    >
      {/* Trunk */}
      <rect x="13" y="28" width="6" height="12" fill={trunkColor} />
      {/* Leaves - triangle shape pixelated */}
      <rect x="10" y="8" width="12" height="4" fill={c3} />
      <rect x="8" y="12" width="16" height="4" fill={c2} />
      <rect x="6" y="16" width="20" height="4" fill={c1} />
      <rect x="8" y="20" width="16" height="4" fill={c2} />
      <rect x="10" y="24" width="12" height="4" fill={c3} />
      {/* Highlight */}
      <rect x="10" y="8" width="4" height="4" fill={c1} opacity="0.7" />
      <rect x="8" y="12" width="4" height="4" fill={c1} opacity="0.5" />
    </svg>
  )
}

// ================================================================
// PIXEL ART FENCE SECTION
// ================================================================
function PixelFence({ width = 100, x = 0, y = 0, horizontal = true }: { width?: number; x?: number; y?: number; horizontal?: boolean }) {
  return (
    <svg
      width={horizontal ? width : 8}
      height={horizontal ? 20 : width}
      viewBox={horizontal ? `0 0 ${width} 20` : `0 0 8 ${width}`}
      style={{ position: 'absolute', left: x, top: y, imageRendering: 'pixelated' }}
    >
      {Array.from({ length: horizontal ? Math.floor(width / 12) : Math.floor(width / 12) }, (_, i) => (
        <g key={i} transform={horizontal ? `translate(${i * 12}, 0)` : `translate(0, ${i * 12})`}>
          {/* Post */}
          <rect x={horizontal ? 3 : 0} y={horizontal ? 0 : 3} width="4" height="20" fill="#92400e" />
          {/* Pointed top */}
          <rect x={horizontal ? 3 : 1} y={horizontal ? 0 : 1} width="4" height="4" fill="#a16207" />
          {/* Horizontal rail */}
          {horizontal ? (
            <>
              <rect x="0" y="6" width={width} height="2" fill="#b45309" />
              <rect x="0" y="14" width={width} height="2" fill="#b45309" />
            </>
          ) : (
            <>
              <rect x="3" y="0" width="2" height={width} fill="#b45309" />
              <rect x="7" y="0" width="2" height={width} fill="#b45309" />
            </>
          )}
        </g>
      ))}
    </svg>
  )
}

// ================================================================
// SILO / FEED STORAGE
// ================================================================
function PixelSilo({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <svg width="36" height="52" viewBox="0 0 36 52" style={{ position: 'absolute', left: x, top: y, imageRendering: 'pixelated' }}>
      {/* Silo body */}
      <rect x="8" y="8" width="20" height="40" fill="#d1d5db" />
      <rect x="10" y="10" width="4" height="36" fill="#e5e7eb" />
      {/* Silo top - dome */}
      <rect x="6" y="4" width="24" height="8" fill="#9ca3af" />
      <rect x="12" y="0" width="12" height="8" fill="#9ca3af" />
      <rect x="14" y="0" width="8" height="4" fill="#6b7280" />
      {/* Base */}
      <rect x="4" y="44" width="28" height="8" fill="#6b7280" />
      {/* Door */}
      <rect x="13" y="34" width="10" height="14" fill="#4b5563" />
      <rect x="15" y="36" width="2" height="10" fill="#6b7280" />
      {/* Feed level indicator */}
      <rect x="10" y="14" width="16" height="18" fill="#fbbf24" opacity="0.5" />
      <rect x="10" y="14" width="4" height="18" fill="#f59e0b" opacity="0.4" />
    </svg>
  )
}

// ================================================================
// WATER TANK
// ================================================================
function PixelWaterTank({ x = 0, y = 0 }: { x?: number; y?: number }) {
  return (
    <svg width="28" height="36" viewBox="0 0 28 36" style={{ position: 'absolute', left: x, top: y, imageRendering: 'pixelated' }}>
      {/* Tank body */}
      <rect x="4" y="4" width="20" height="28" fill="#bfdbfe" />
      <rect x="6" y="6" width="6" height="24" fill="#93c5fd" />
      {/* Water shimmer */}
      <rect x="6" y="8" width="2" height="6" fill="#dbeafe" />
      <rect x="10" y="14" width="2" height="4" fill="#dbeafe" />
      {/* Top rim */}
      <rect x="2" y="0" width="24" height="6" fill="#6b7280" />
      <rect x="0" y="2" width="28" height="4" fill="#4b5563" />
      {/* Legs */}
      <rect x="4" y="32" width="4" height="4" fill="#6b7280" />
      <rect x="20" y="32" width="4" height="4" fill="#6b7280" />
      {/* Base */}
      <rect x="2" y="32" width="24" height="4" fill="#4b5563" />
    </svg>
  )
}

// ================================================================
// MAIN FARM MAP COMPONENT
// ================================================================
export default function FarmMapView({ batches, config, calculations }: FarmMapViewProps) {
  // Time-based ambient effects
  const [timePhase, setTimePhase] = useState(0)
  const [cloudOffset, setCloudOffset] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTimePhase(prev => (prev + 1) % 360)
    }, 100)
    const cloudInterval = setInterval(() => {
      setCloudOffset(prev => (prev + 0.3) % 800)
    }, 50)
    return () => { clearInterval(interval); clearInterval(cloudInterval) }
  }, [])

  // Animated chicken pecking
  const [peckFrame, setPeckFrame] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => {
      setPeckFrame(prev => (prev + 1) % 4)
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Egg pop animation for laying sheds
  const [eggPops, setEggPops] = useState<Record<string, number>>({})
  useEffect(() => {
    const interval = setInterval(() => {
      batches.forEach(b => {
        if (b.isLaying) {
          setEggPops(prev => ({ ...prev, [b.id]: (prev[b.id] || 0) + 1 }))
        }
      })
    }, 2000)
    return () => clearInterval(interval)
  }, [batches])

  // Compute per-shed details
  const shedDetails = useMemo(() => {
    return batches.map((batch, index) => {
      const calcDetail = calculations.batchDetails?.find(b => b.id === batch.id)
      const theme = PHASE_HUD_COLORS[batch.phase]
      const production = batch.isLaying ? Math.round(batch.layingRate) : 0
      const feedPhase = config.feedPhases[batch.phase]
      const healthPercent = Math.max(60, 100 - (config.mortalityRate * Math.random() * 0.3))
      const feedLevel = Math.min(100, 70 + Math.random() * 30)

      return {
        ...batch,
        index,
        theme,
        production,
        eggsPerDay: calcDetail?.eggsPerDay || 0,
        revenue: calcDetail?.eggRevenue || 0,
        feedCost: calcDetail?.monthlyFeedCost || 0,
        feedPhase,
        healthPercent,
        feedLevel,
        weeksLabel: feedPhase?.weeks || '',
      }
    })
  }, [batches, calculations, config])

  const totalHens = calculations.totalHens || 0
  const layingCount = calculations.layingBatches || 0

  // Day/night overlay opacity based on simulated time
  const dayBrightness = 85 + Math.sin(timePhase * Math.PI / 180) * 10

  return (
    <div className="space-y-4">
      {/* RPG-Style HUD Bar */}
      <div className="relative overflow-hidden rounded-xl border-2 border-amber-800 bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 p-1">
        <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-100 rounded-lg">
          {/* Left: Farm Status */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-lg">
                &#x1F3E0;
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Granja Nidal</p>
                <p className="text-[9px] text-amber-600">{fmtNum(totalHens)} aves &bull; {batches.length} galpones</p>
              </div>
            </div>
            {/* Health bar */}
            <div className="hidden sm:flex items-center gap-1.5">
              <span className="text-[9px] font-bold text-red-700">HP</span>
              <div className="w-20 h-3 bg-stone-300 border border-stone-500 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-green-500 transition-all duration-1000"
                  style={{ width: `${Math.min(100, 60 + (calculations.profitMargin || 0) * 2)}%` }}
                />
              </div>
              <span className="text-[9px] text-amber-700">{Math.min(100, Math.round(60 + (calculations.profitMargin || 0) * 2))}%</span>
            </div>
          </div>

          {/* Center: Coins & Eggs */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-200/60 rounded-md border border-amber-300">
              <span className="text-sm">&#x1FA99;</span>
              <div>
                <p className="text-[9px] text-amber-600">Ingreso</p>
                <p className="text-[11px] font-bold text-amber-800">{fmtRD(calculations.totalRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100/60 rounded-md border border-red-200">
              <span className="text-sm">&#x1F95A;</span>
              <div>
                <p className="text-[9px] text-red-500">Huevos</p>
                <p className="text-[11px] font-bold text-red-700">{fmtNum(calculations.totalEggs)}/mes</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100/60 rounded-md border border-emerald-200">
              <span className="text-sm">&#x1F4B0;</span>
              <div>
                <p className="text-[9px] text-emerald-500">Neto</p>
                <p className={`text-[11px] font-bold ${(calculations.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {fmtRD(calculations.netProfit || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Laying status */}
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100/60 rounded-md border border-yellow-200">
              <span className="text-sm">&#x2B50;</span>
              <div>
                <p className="text-[9px] text-yellow-600">Postura</p>
                <p className="text-[11px] font-bold text-yellow-800">{layingCount}/{batches.length}</p>
              </div>
            </div>
            {/* Mini clock */}
            <div className="w-10 h-10 rounded-full border-2 border-amber-500 bg-amber-100 flex items-center justify-center">
              <div
                className="w-1 h-3 bg-amber-700 rounded-full origin-bottom"
                style={{ transform: `rotate(${timePhase}deg)` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* FARM MAP - Main View */}
      <Card className="border-2 border-amber-700 overflow-hidden">
        <CardContent className="p-0">
          <div
            className="relative w-full overflow-hidden"
            style={{
              minHeight: '520px',
              background: `linear-gradient(180deg,
                #7dd3fc 0%,
                #bae6fd 15%,
                #86efac 15.5%,
                #4ade80 30%,
                #22c55e 50%,
                #16a34a 80%,
                #15803d 100%
              )`,
              imageRendering: 'auto',
            }}
          >
            {/* Sky gradient overlay for day cycle */}
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
              style={{
                background: `radial-gradient(ellipse at 80% 10%, rgba(253,224,71,${0.15 + Math.sin(timePhase * Math.PI / 90) * 0.1}) 0%, transparent 50%)`,
              }}
            />

            {/* Clouds */}
            {[0, 1, 2].map(i => (
              <div
                key={`cloud-${i}`}
                className="absolute pointer-events-none"
                style={{
                  top: `${2 + i * 4}%`,
                  left: `${(cloudOffset + i * 280) % 900 - 100}px`,
                  transition: 'left 0.1s linear',
                }}
              >
                <svg width="80" height="32" viewBox="0 0 80 32" opacity="0.7">
                  <rect x="10" y="16" width="60" height="16" rx="8" fill="white" />
                  <rect x="20" y="8" width="40" height="16" rx="8" fill="white" />
                  <rect x="30" y="2" width="24" height="14" rx="7" fill="white" />
                  <rect x="20" y="8" width="12" height="8" rx="4" fill="#f0f9ff" />
                </svg>
              </div>
            ))}

            {/* Sun */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: '3%',
                right: '8%',
              }}
            >
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="12" fill="#fbbf24" />
                <circle cx="24" cy="24" r="10" fill="#fcd34d" />
                {Array.from({ length: 8 }, (_, i) => (
                  <line
                    key={i}
                    x1="24"
                    y1="4"
                    x2="24"
                    y2="10"
                    stroke="#fbbf24"
                    strokeWidth="2"
                    transform={`rotate(${i * 45 + timePhase * 0.5}, 24, 24)`}
                  />
                ))}
              </svg>
            </div>

            {/* Background trees (far away) */}
            <PixelTree variant={1} x="3%" y="17%" />
            <PixelTree variant={2} x="7%" y="14%" />
            <PixelTree variant={3} x="88%" y="16%" />
            <PixelTree variant={1} x="92%" y="19%" />
            <PixelTree variant={2} x="15%" y="18%" />
            <PixelTree variant={3} x="80%" y="17%" />

            {/* FENCE - Top */}
            <PixelFence width={600} x="10%" y="24%" horizontal={true} />
            {/* FENCE - Bottom */}
            <PixelFence width={600} x="10%" y="88%" horizontal={true} />
            {/* FENCE - Left */}
            <PixelFence width={350} x="10%" y="24%" horizontal={false} />
            {/* FENCE - Right */}
            <PixelFence width={350} x="88%" y="24%" horizontal={false} />

            {/* Gate / Entrance at bottom */}
            <svg width="48" height="28" viewBox="0 0 48 28" style={{ position: 'absolute', left: '47%', top: '85%', imageRendering: 'pixelated' }}>
              <rect x="0" y="0" width="48" height="28" fill="#92400e" />
              <rect x="2" y="2" width="20" height="24" fill="#b45309" />
              <rect x="26" y="2" width="20" height="24" fill="#b45309" />
              <rect x="22" y="8" width="4" height="16" fill="#78350f" />
            </svg>

            {/* Silo */}
            <PixelSilo x="5%" y="30%" />

            {/* Water Tank */}
            <PixelWaterTank x="90%" y="32%" />

            {/* Road from gate to sheds */}
            <svg width="200" height="20" viewBox="0 0 200 20" style={{ position: 'absolute', left: '38%', top: '82%', imageRendering: 'pixelated' }}>
              <rect x="0" y="4" width="200" height="12" fill="#d1d5db" />
              <rect x="0" y="6" width="200" height="8" fill="#e5e7eb" />
              {[0, 40, 80, 120, 160].map(x => (
                <rect key={x} x={x + 15} y="8" width="12" height="4" fill="#fbbf24" />
              ))}
            </svg>

            {/* ===== SHEDS (2x2 Grid) ===== */}
            <div className="absolute" style={{ top: '30%', left: '14%', width: '76%', height: '52%' }}>
              <div className="grid grid-cols-2 gap-4 h-full">
                {shedDetails.map((shed) => (
                  <ShedSprite key={shed.id} shed={shed} peckFrame={peckFrame} eggPop={!!eggPops[shed.id]} />
                ))}
              </div>
            </div>

            {/* Decorative chickens walking around */}
            <WalkingChicken x="18%" y="92%" frame={peckFrame} delay={0} />
            <WalkingChicken x="68%" y="93%" frame={peckFrame} delay={1} />
            <WalkingChicken x="42%" y="90%" frame={peckFrame} delay={2} />

            {/* Farm sign */}
            <svg width="80" height="40" viewBox="0 0 80 40" style={{ position: 'absolute', left: '44%', top: '3%', imageRendering: 'pixelated' }}>
              {/* Post */}
              <rect x="36" y="16" width="8" height="24" fill="#78350f" />
              {/* Sign board */}
              <rect x="2" y="4" width="76" height="16" rx="2" fill="#92400e" />
              <rect x="4" y="6" width="72" height="12" rx="1" fill="#fef3c7" />
              <text x="40" y="15" textAnchor="middle" fontSize="8" fill="#78350f" fontFamily="monospace" fontWeight="bold">GRANJA NIDAL</text>
            </svg>

            {/* Foreground grass details */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 20 }, (_, i) => (
                <g key={`grass-${i}`}>
                  <rect
                    x={`${5 + (i * 4.7) % 90}%`}
                    y={`${70 + (i * 2.3) % 25}%`}
                    width="2"
                    height="6"
                    fill={i % 3 === 0 ? '#15803d' : '#166534'}
                    rx="1"
                  />
                  <rect
                    x={`${3 + (i * 4.7) % 90}%`}
                    y={`${70 + (i * 2.3) % 25}%`}
                    width="2"
                    height="8"
                    fill="#16a34a"
                    rx="1"
                  />
                </g>
              ))}
            </svg>

            {/* Subtle scan lines for retro RPG feel */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bottom Legend / Mini Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <PhaseLegendCard phase="pre_inicio" />
        <PhaseLegendCard phase="inicio" />
        <PhaseLegendCard phase="crecimiento" />
        <PhaseLegendCard phase="pre_postura" />
        <PhaseLegendCard phase="postura" />
      </div>

      {/* Farm Stats RPG Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatGem icon="\u{1F95A}" label="Huevos/Dia" value={fmtNum(calculations.totalEggs ? Math.round(calculations.totalEggs / 30) : 0)} color="bg-orange-100 border-orange-300 text-orange-700" />
        <StatGem icon="\u{1F35E}" label="Alimento/Mes" value={`${fmtNum(Math.round(calculations.totalFeedKg || 0))} kg`} color="bg-amber-100 border-amber-300 text-amber-700" />
        <StatGem icon="\u{1F4B3}" label="Feed Cost" value={fmtRD(calculations.batchDetails?.reduce((s, b) => s + (b.monthlyFeedCost || 0), 0) || 0)} color="bg-red-100 border-red-300 text-red-700" />
        <StatGem icon="\u{1F3AF}" label="Margen" value={`${(calculations.profitMargin || 0).toFixed(1)}%`} color="bg-violet-100 border-violet-300 text-violet-700" />
      </div>
    </div>
  )
}

// ================================================================
// SHED SPRITE COMPONENT
// ================================================================
function ShedSprite({
  shed,
  peckFrame,
  eggPop,
}: {
  shed: {
    id: string
    name: string
    hens: number
    layingRate: number
    isLaying: boolean
    cycleMonth: number
    phase: PhaseKey
    index: number
    theme: { bg: string; border: string; text: string; glow: string; roof: string }
    production: number
    eggsPerDay: number
    revenue: number
    feedCost: number
    feedLevel: number
    weeksLabel: string
  }
  peckFrame: number
  eggPop: boolean
}) {
  const theme = PHASE_HUD_COLORS[shed.phase]
  const roofColor = theme.roof

  // Determine building appearance based on phase
  const isProducing = shed.isLaying
  const progressPercent = Math.min(100, (shed.cycleMonth / 20) * 100)

  return (
    <div className="relative flex flex-col items-center">
      {/* RPG floating label */}
      <div className="absolute -top-6 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/90 border border-amber-300 shadow-md">
        <span className="text-sm">{PHASE_ICONS[shed.phase]}</span>
        <span className="text-[10px] font-bold text-amber-800 whitespace-nowrap">{shed.name}</span>
      </div>

      {/* Main shed building */}
      <div className={`relative w-full rounded-lg border-2 ${theme.border} ${theme.bg} shadow-lg ${theme.glow} overflow-hidden`}
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Roof */}
        <div className="relative h-8 overflow-hidden" style={{ backgroundColor: roofColor }}>
          <svg width="100%" height="32" viewBox="0 0 200 32" preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }}>
            <polygon points="100,0 0,32 200,32" fill={roofColor} />
            <polygon points="100,4 8,32 40,32" fill="white" opacity="0.15" />
            {/* Roof tiles pattern */}
            {[0, 30, 60, 90, 120, 150].map(x => (
              <rect key={x} x={x} y="12" width="30" height="4" rx="1" fill="rgba(0,0,0,0.1)" />
            ))}
          </svg>
        </div>

        {/* Building body */}
        <div className="p-3 space-y-2">
          {/* Phase badge */}
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-sm ${theme.bg} ${theme.text} border ${theme.border}`}>
              {PHASE_LABELS[shed.phase]}
            </span>
            <span className="text-[9px] text-stone-500 font-mono">{shed.weeksLabel}</span>
          </div>

          {/* Hen count with mini progress */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="text-xs">&#x1F414;</span>
              <span className="text-xs font-bold text-stone-700">{fmtNum(shed.hens)}</span>
              <span className="text-[9px] text-stone-500">aves</span>
            </div>
            {/* Health bar */}
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden border border-stone-300">
                <div
                  className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 transition-all duration-500 rounded-full"
                  style={{ width: `${70 + shed.index * 7}%` }}
                />
              </div>
            </div>
          </div>

          {/* Production stats for laying */}
          {shed.isLaying ? (
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 rounded border border-green-200">
                <span className={`text-xs ${eggPop ? 'scale-125' : ''} transition-transform duration-300 inline-block`}>&#x1F95A;</span>
                <span className="font-bold text-green-700">{fmtNum(shed.eggsPerDay)}/dia</span>
              </div>
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-50 rounded border border-yellow-200">
                <span className="text-[9px]">&#x2B50;</span>
                <span className="font-bold text-yellow-700">{shed.layingRate}%</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-stone-400 italic">
              Crianza - Mes {shed.cycleMonth}
            </div>
          )}

          {/* Feed level mini bar */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-stone-400">Feed</span>
            <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-1000"
                style={{ width: `${shed.feedLevel}%` }}
              />
            </div>
            <span className="text-[8px] text-stone-500 font-mono">{Math.round(shed.feedLevel)}%</span>
          </div>
        </div>

        {/* Bottom progress bar - cycle progress */}
        <div className="h-2 bg-stone-700/20">
          <div
            className={`h-full transition-all duration-700 ${shed.isLaying ? 'bg-gradient-to-r from-green-400 to-emerald-400' : 'bg-gradient-to-r from-sky-400 to-blue-400'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ground shadow */}
      <div className="absolute -bottom-2 left-[10%] right-[10%] h-3 bg-black/10 rounded-full blur-sm" />
    </div>
  )
}

// ================================================================
// WALKING CHICKEN
// ================================================================
function WalkingChicken({ x, y, frame, delay }: { x: string; y: string; frame: number; delay: number }) {
  const direction = (frame + delay) % 2 === 0 ? 1 : -1
  const bobY = Math.sin((frame + delay) * 0.8) * 1.5

  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: `translateY(${bobY}px) scaleX(${direction})`,
        transition: 'transform 0.3s',
        imageRendering: 'pixelated',
      }}
    >
      {/* Body */}
      <ellipse cx="10" cy="12" rx="5" ry="4" fill="#fbbf24" />
      {/* Head */}
      <circle cx="15" cy="9" r="3" fill="#fbbf24" />
      {/* Eye */}
      <circle cx="16" cy="8" r="0.8" fill="#1f2937" />
      {/* Beak */}
      <polygon points="18,9 20,10 18,11" fill="#f97316" />
      {/* Legs */}
      <line x1="8" y1="15" x2="7" y2="19" stroke="#f97316" strokeWidth="1" />
      <line x1="12" y1="15" x2="13" y2="19" stroke="#f97316" strokeWidth="1" />
      {/* Wing */}
      <ellipse cx="9" cy="11" rx="2" ry="2.5" fill="#f59e0b" />
    </svg>
  )
}

// ================================================================
// PHASE LEGEND CARD
// ================================================================
function PhaseLegendCard({ phase }: { phase: PhaseKey }) {
  const theme = PHASE_HUD_COLORS[phase]
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${theme.border} ${theme.bg} ${theme.text}`}>
      <span className="text-base">{PHASE_ICONS[phase]}</span>
      <div>
        <p className="text-[9px] font-bold">{PHASE_LABELS[phase]}</p>
        <p className="text-[8px] opacity-70">Fase {PHASE_LABELS[phase] === 'Postura' ? 'produccion' : 'crianza'}</p>
      </div>
    </div>
  )
}

// ================================================================
// STAT GEM (RPG stat card)
// ================================================================
function StatGem({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color} shadow-sm`}>
      <span className="text-lg">{icon}</span>
      <div>
        <p className="text-[9px] opacity-70 font-medium">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}
