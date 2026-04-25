'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'

// ================================================================
// TYPES
// ================================================================
type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

interface BatchConfig {
  id: string; name: string; hens: number; layingRate: number
  isLaying: boolean; cycleMonth: number; phase: PhaseKey
}

interface FeedPhase { label: string; consumption: number; price: number; weeks: string }

interface FarmConfig {
  eggPrice: number; henSalePrice: number; chickPrice: number
  feedPhases: Record<PhaseKey, FeedPhase>
  vaccinesCostPerBird: number; equipmentCostPerBird: number; mortalityRate: number
  shed1Cost: number; shedAdditionalCost: number
  baseLayingRate: number; layingCycleMonths: number
  hensPerBatch: number; fixedCostsMonthly: number; otherCosts: number
}

interface CalcDetail {
  id: string; name: string; phase: PhaseKey; hens: number
  isLaying: boolean; layingRate: number; cycleMonth: number
  eggsPerDay: number; eggsPerMonth: number; eggRevenue: number
  monthlyFeedCost: number; netBalance: number
}

interface CalculationsResult {
  totalRevenue: number; totalExpenses: number; netProfit: number
  totalEggs: number; totalHens: number; layingBatches: number
  totalFeedKg: number; profitMargin: number
  batchDetails: CalcDetail[]
}

interface FarmMapViewProps {
  batches: BatchConfig[]; config: FarmConfig; calculations: CalculationsResult
}

// ================================================================
// POKEMON PALETTE - flat colors, NO gradients
// ================================================================
const P = {
  black:     '#111827',
  outline:   '#1f2937',
  dark:      '#374151',
  mid:       '#6b7280',
  light:     '#d1d5db',
  white:     '#f3f4f6',
  cream:     '#fef9c3',
  sky1:      '#7dd3fc',
  sky2:      '#bae6fd',
  grass1:    '#4ade80',
  grass2:    '#22c55e',
  grass3:    '#16a34a',
  grass4:    '#15803d',
  dirt1:     '#d6d3d1',
  dirt2:     '#a8a29e',
  dirt3:     '#78716c',
  wood1:     '#d97706',
  wood2:     '#b45309',
  wood3:     '#92400e',
  wood4:     '#78350f',
  wall1:     '#f5f5f4',
  wall2:     '#e7e5e4',
  wall3:     '#d6d3d1',
  red1:      '#ef4444',
  blue1:     '#3b82f6',
  yellow1:   '#eab308',
  yellow2:   '#facc15',
  yellow3:   '#fde047',
  pink1:     '#ec4899',
}

const PHASE_ROOF: Record<PhaseKey, { main: string; shade: string; light: string }> = {
  pre_inicio:   { main: '#94a3b8', shade: '#64748b', light: '#cbd5e1' },
  inicio:       { main: '#38bdf8', shade: '#0284c7', light: '#7dd3fc' },
  crecimiento:  { main: '#2dd4bf', shade: '#0d9488', light: '#5eead4' },
  pre_postura:  { main: '#fbbf24', shade: '#d97706', light: '#fde047' },
  postura:      { main: '#4ade80', shade: '#16a34a', light: '#86efac' },
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  pre_inicio: 'Pre-Inicio', inicio: 'Inicio', crecimiento: 'Crecimiento',
  pre_postura: 'Pre-Postura', postura: 'Postura',
}

const PHASE_ICONS: Record<PhaseKey, string> = {
  pre_inicio: '\u{1F423}', inicio: '\u{1F425}', crecimiento: '\u{1F414}',
  pre_postura: '\u{1F98B}', postura: '\u{1F95A}',
}

// ================================================================
// HELPERS
// ================================================================
function fmtNum(v: number) { return new Intl.NumberFormat('es-DO').format(v) }
function fmtRD(v: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

// Shed positions in the map (percentage of map container)
// 2x2 grid, centered, with generous spacing
const SHED_POSITIONS = [
  { left: 8,  top: 28 },   // top-left
  { left: 54, top: 28 },   // top-right
  { left: 8,  top: 60 },   // bottom-left
  { left: 54, top: 60 },   // bottom-right
]

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function FarmMapView({ batches, config, calculations }: FarmMapViewProps) {
  const [hoveredShed, setHoveredShed] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; align: 'left' | 'right' }>({ x: 0, y: 0, align: 'right' })

  // Slow tick for subtle animations
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1500)
    return () => clearInterval(iv)
  }, [])

  // Per-shed data
  const shedData = useMemo(() =>
    batches.map((b, i) => {
      const d = calculations.batchDetails?.find(x => x.id === b.id)
      const fp = config.feedPhases[b.phase]
      return {
        ...b, index: i,
        eggsPerDay: d?.eggsPerDay || 0,
        eggRevenue: d?.eggRevenue || 0,
        feedCost: d?.monthlyFeedCost || 0,
        netBalance: d?.netBalance || 0,
        feedPhase: fp,
        weeksLabel: fp?.weeks || '',
        progress: Math.min(100, (b.cycleMonth / 20) * 100),
      }
    }), [batches, calculations, config])

  const handleShedHover = useCallback((shedId: string, idx: number, e: React.MouseEvent) => {
    setHoveredShed(shedId)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mapRect = mapRef.current?.getBoundingClientRect()
    if (mapRect) {
      const x = rect.left - mapRect.left + rect.width / 2
      const y = rect.top - mapRect.top
      // If shed is on right half, tooltip goes left; otherwise right
      const align = x > mapRect.width / 2 ? 'right' : 'left'
      setTooltipPos({ x: align === 'right' ? x - rect.width - 8 : x + rect.width + 8, y: Math.max(0, y - 20), align })
    }
  }, [])

  const handleShedLeave = useCallback(() => setHoveredShed(null), [])

  const activeShed = shedData.find(s => s.id === hoveredShed)

  return (
    <div className="space-y-3">
      {/* ========= POKEMON HUD BAR ========= */}
      <div className="flex items-stretch border-[3px] border-gray-800 rounded-lg overflow-hidden bg-gray-900">
        {/* Farm info - left */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-r-[3px] border-gray-800">
          <div className="w-7 h-7 bg-amber-200 border-2 border-gray-800 rounded flex items-center justify-center text-sm leading-none">
            &#x1F3E0;
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-800 leading-none">GRANJA NIDAL</p>
            <p className="text-[8px] text-gray-500 leading-tight">{fmtNum(calculations.totalHens)} aves | {batches.length} galpones</p>
          </div>
        </div>

        {/* Stats - center */}
        <div className="flex-1 grid grid-cols-4 divide-x-[3px] divide-gray-800">
          <StatBlock label="INGRESO" value={fmtRD(calculations.totalRevenue)} icon="$" bg="bg-green-50" color="text-green-700" />
          <StatBlock label="HUEVOS" value={`${fmtNum(calculations.totalEggs)}/m`} icon="O" bg="bg-orange-50" color="text-orange-700" />
          <StatBlock label="NETO" value={fmtRD(calculations.netProfit || 0)} icon="N" bg={calculations.netProfit >= 0 ? 'bg-emerald-50' : 'bg-red-50'} color={calculations.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'} />
          <StatBlock label="MARGEN" value={`${(calculations.profitMargin || 0).toFixed(1)}%`} icon="M" bg="bg-blue-50" color="text-blue-700" />
        </div>

        {/* Laying counter + clock - right */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-l-[3px] border-gray-800">
          <div className="text-center">
            <p className="text-[8px] font-bold text-gray-500 leading-none">POSTURA</p>
            <p className="text-sm font-bold text-gray-800 leading-none">{calculations.layingBatches}<span className="text-[9px] text-gray-400">/{batches.length}</span></p>
          </div>
          <div className="w-8 h-8 rounded-full border-[3px] border-gray-800 bg-yellow-200 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-[2px] rounded-full border border-gray-400" />
            <div className="w-[2px] h-2.5 bg-gray-800 rounded-b origin-bottom" style={{ transform: `rotate(${tick * 15}deg)` }} />
            <div className="absolute w-[1.5px] h-2 bg-gray-600 rounded-b origin-bottom" style={{ transform: `rotate(${tick * 1.25}deg)` }} />
          </div>
        </div>
      </div>

      {/* ========= MAP CONTAINER ========= */}
      <div
        ref={mapRef}
        className="relative w-full border-[3px] border-gray-800 rounded-lg overflow-hidden select-none"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* --- BACKGROUND LAYERS (non-interactive) --- */}
        <MapBackground />

        {/* --- TREES (background layer) --- */}
        <PokeTree x="1%" y="22%" />
        <PokeTree x="4.5%" y="18%" />
        <PokeTree x="90%" y="20%" />
        <PokeTree x="94%" y="24%" />
        <PokeTree x="49%" y="17%" />

        {/* --- FENCE PERIMETER --- */}
        <FenceTop />
        <FenceBottom />
        <FenceLeft />
        <FenceRight />

        {/* --- GATE --- */}
        <div className="absolute" style={{ left: '46.5%', top: '89%', width: '7%', height: '10%' }}>
          <svg viewBox="0 0 80 32" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            <rect x="0" y="0" width="36" height="32" fill={P.wood2} stroke={P.black} strokeWidth="2" />
            <rect x="44" y="0" width="36" height="32" fill={P.wood2} stroke={P.black} strokeWidth="2" />
            <rect x="4" y="4" width="28" height="24" fill={P.wood1} />
            <rect x="48" y="4" width="28" height="24" fill={P.wood1} />
            {/* Hinges */}
            <rect x="34" y="8" width="6" height="4" fill={P.wood4} />
            <rect x="40" y="8" width="6" height="4" fill={P.wood4} />
          </svg>
        </div>

        {/* --- PATH from gate up --- */}
        <div className="absolute" style={{ left: '47%', top: '52%', width: '6%', height: '38%' }}>
          <svg viewBox="0 0 40 120" width="100%" height="100%">
            <rect x="0" y="0" width="40" height="120" fill={P.dirt1} stroke={P.dirt3} strokeWidth="1" />
            <rect x="4" y="0" width="32" height="120" fill={P.dirt2} />
            {[0, 20, 40, 60, 80, 100].map(y => (
              <rect key={y} x="12" y={y} width="6" height="4" fill={P.dirt3} rx="1" />
            ))}
          </svg>
        </div>

        {/* --- SILO (left) --- */}
        <div className="absolute" style={{ left: '2%', top: '34%', width: '5%', height: '16%' }}>
          <svg viewBox="0 0 36 52" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            <rect x="6" y="6" width="24" height="40" fill={P.wall1} stroke={P.black} strokeWidth="2" />
            <rect x="8" y="8" width="8" height="36" fill={P.light} />
            <rect x="6" y="0" width="24" height="10" fill="#9ca3af" stroke={P.black} strokeWidth="2" />
            <rect x="10" y="-4" width="16" height="8" fill="#6b7280" stroke={P.black} strokeWidth="2" />
            <rect x="4" y="42" width="28" height="10" fill={P.dark} stroke={P.black} strokeWidth="2" />
            <rect x="12" y="30" width="12" height="18" fill={P.mid} />
            <rect x="14" y="30" width="2" height="18" fill={P.dark} />
            <rect x="12" y="14" width="12" height="14" fill={P.yellow2} opacity="0.6" />
          </svg>
        </div>

        {/* --- WATER TANK (right) --- */}
        <div className="absolute" style={{ left: '93%', top: '36%', width: '4%', height: '13%' }}>
          <svg viewBox="0 0 28 36" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            <rect x="2" y="4" width="24" height="24" fill="#93c5fd" stroke={P.black} strokeWidth="2" />
            <rect x="4" y="6" width="8" height="20" fill="#bfdbfe" />
            <rect x="0" y="0" width="28" height="8" fill={P.mid} stroke={P.black} strokeWidth="2" />
            <rect x="4" y="28" width="4" height="8" fill={P.dark} />
            <rect x="20" y="28" width="4" height="8" fill={P.dark} />
            <rect x="6" y="10" width="2" height="6" fill="#dbeafe" />
          </svg>
        </div>

        {/* --- SHEDS (interactive) --- */}
        {shedData.map((shed, i) => {
          const pos = SHED_POSITIONS[i] || SHED_POSITIONS[0]
          const isHov = hoveredShed === shed.id
          return (
            <div
              key={shed.id}
              className="absolute z-10"
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, width: '38%', height: '26%' }}
              onMouseEnter={(e) => handleShedHover(shed.id, i, e)}
              onMouseLeave={handleShedLeave}
            >
              {/* Shed shadow */}
              <div className="absolute bottom-0 left-[8%] right-[8%] h-[6%] bg-black/15 rounded-full" />
              {/* Shed building */}
              <div className="relative w-full h-full">
                <ShedBuilding phase={shed.phase} isHovered={isHov} name={shed.name} />
              </div>
            </div>
          )
        })}

        {/* --- WALKING CHICKENS --- */}
        <WalkingChicken left="15%" top="88%" delay={0} tick={tick} />
        <WalkingChicken left="72%" top="87%" delay={2} tick={tick} />

        {/* --- HOVER TOOLTIP (Pokemon dialog box) --- */}
        {activeShed && (
          <div
            className="absolute z-50 pointer-events-none"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: tooltipPos.align === 'right' ? 'translateX(-100%)' : 'translateX(0)',
              maxWidth: '220px',
              width: '220px',
            }}
          >
            <PokeTooltip shed={activeShed} align={tooltipPos.align} />
          </div>
        )}

        {/* --- FARM SIGN --- */}
        <div className="absolute z-20" style={{ left: '38%', top: '2.5%', width: '24%', height: '8%' }}>
          <svg viewBox="0 0 160 36" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
            <rect x="68" y="10" width="8" height="26" fill={P.wood3} stroke={P.black} strokeWidth="2" />
            <rect x="84" y="10" width="8" height="26" fill={P.wood3} stroke={P.black} strokeWidth="2" />
            <rect x="0" y="0" width="160" height="16" fill={P.wood3} stroke={P.black} strokeWidth="2" />
            <rect x="4" y="2" width="152" height="12" fill={P.cream} />
            <text x="80" y="12" textAnchor="middle" fontSize="9" fill={P.black} fontFamily="monospace" fontWeight="bold">
              GRANJA NIDAL
            </text>
          </svg>
        </div>

        {/* --- SCANLINES (very subtle retro overlay) --- */}
        <div
          className="absolute inset-0 pointer-events-none z-30 opacity-[0.025]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.5) 3px, rgba(0,0,0,0.5) 4px)',
          }}
        />
      </div>

      {/* ========= LEGEND ========= */}
      <div className="flex items-stretch border-[3px] border-gray-800 rounded-lg overflow-hidden divide-x-[3px] divide-gray-800">
        {(Object.keys(PHASE_LABELS) as PhaseKey[]).map(phase => (
          <div key={phase} className="flex-1 flex items-center gap-1.5 px-2 py-1.5 bg-gray-50">
            <div className="w-3 h-3 border-2 border-gray-800 rounded-sm" style={{ backgroundColor: PHASE_ROOF[phase].main }} />
            <span className="text-[9px] font-bold text-gray-700">{PHASE_LABELS[phase]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// MAP BACKGROUND
// ================================================================
function MapBackground() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 200)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="absolute inset-0">
      {/* Sky */}
      <div className="absolute inset-0" style={{ height: '30%', background: 'linear-gradient(180deg, #7dd3fc 0%, #bae6fd 100%)' }} />
      {/* Grass */}
      <div className="absolute" style={{ top: '28%', bottom: 0, left: 0, right: 0, background: 'linear-gradient(180deg, #4ade80 0%, #22c55e 30%, #16a34a 70%, #15803d 100%)' }} />
      {/* Transition stripe (trees/bushes line) */}
      <div className="absolute" style={{ top: '26%', left: 0, right: 0, height: '5%', background: '#388838' }} />

      {/* Sun */}
      <svg className="absolute" style={{ top: '3%', right: '6%', width: '40px', height: '40px' }} viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="10" fill="#fbbf24" stroke={P.black} strokeWidth="2" />
        <circle cx="18" cy="18" r="3" fill="#fde047" />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1="20" y1="4" x2="20" y2="8" stroke={P.black} strokeWidth="2"
            transform={`rotate(${i * 45 + tick * 3}, 20, 20)`} />
        ))}
      </svg>

      {/* Clouds */}
      {[{ delay: 0, top: '4%' }, { delay: 300, top: '9%' }, { delay: 600, top: '15%' }].map((c, i) => (
        <svg key={i} className="absolute pointer-events-none opacity-80"
          style={{ top: c.top, left: `${((tick * 0.4 + c.delay) % 110) - 10}%`, width: '56px', height: '22px' }}
          viewBox="0 0 56 22">
          <ellipse cx="28" cy="14" rx="28" ry="8" fill="white" stroke={P.black} strokeWidth="1.5" />
          <ellipse cx="20" cy="8" rx="14" ry="8" fill="white" stroke={P.black} strokeWidth="1.5" />
          <ellipse cx="34" cy="10" rx="10" ry="6" fill="white" />
          <ellipse cx="18" cy="6" rx="6" ry="4" fill="#f0f9ff" />
        </svg>
      ))}
    </div>
  )
}

// ================================================================
// POKEMON-STYLE TREE
// ================================================================
function PokeTree({ x, y }: { x: string; y: string }) {
  return (
    <svg className="absolute pointer-events-none" style={{ left: x, top: y, width: '32px', height: '40px', imageRendering: 'pixelated' }}
      viewBox="0 0 32 40">
      {/* Trunk */}
      <rect x="13" y="26" width="6" height="14" fill={P.wood2} stroke={P.black} strokeWidth="1.5" />
      {/* Canopy - round bushy shape */}
      <circle cx="16" cy="16" r="12" fill="#16a34a" stroke={P.black} strokeWidth="2" />
      <circle cx="10" cy="12" r="7" fill="#22c55e" />
      <circle cx="22" cy="14" r="6" fill="#15803d" />
      <circle cx="14" cy="8" r="5" fill="#4ade80" />
      {/* Highlight */}
      <circle cx="11" cy="9" r="3" fill="#86efac" opacity="0.7" />
    </svg>
  )
}

// ================================================================
// FENCE SEGMENTS
// ================================================================
function FenceTop() {
  return (
    <svg className="absolute pointer-events-none z-[5]" style={{ left: '7%', top: '24%', width: '86%', height: '14px' }}
      viewBox="0 0 860 14" preserveAspectRatio="none">
      <rect x="0" y="4" width="860" height="2" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      <rect x="0" y="10" width="860" height="2" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      {Array.from({ length: 36 }, (_, i) => (
        <rect key={i} x={i * 24} y="0" width="4" height="14" fill={P.wood1} stroke={P.black} strokeWidth="1" />
      ))}
    </svg>
  )
}

function FenceBottom() {
  return (
    <svg className="absolute pointer-events-none z-[5]" style={{ left: '7%', top: '89%', width: '40%', height: '14px' }}
      viewBox="0 0 400 14" preserveAspectRatio="none">
      <rect x="0" y="4" width="400" height="2" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      <rect x="0" y="10" width="400" height="2" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      {Array.from({ length: 17 }, (_, i) => (
        <rect key={i} x={i * 24} y="0" width="4" height="14" fill={P.wood1} stroke={P.black} strokeWidth="1" />
      ))}
    </svg>
  )
}

function FenceLeft() {
  return (
    <svg className="absolute pointer-events-none z-[5]" style={{ left: '7%', top: '24%', width: '14px', height: '66%' }}
      viewBox="0 0 14 660" preserveAspectRatio="none">
      <rect x="4" y="0" width="2" height="660" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      <rect x="10" y="0" width="2" height="660" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      {Array.from({ length: 28 }, (_, i) => (
        <rect key={i} x="0" y={i * 24} width="14" height="4" fill={P.wood1} stroke={P.black} strokeWidth="1" />
      ))}
    </svg>
  )
}

function FenceRight() {
  return (
    <svg className="absolute pointer-events-none z-[5]" style={{ left: '92.5%', top: '24%', width: '14px', height: '66%' }}
      viewBox="0 0 14 660" preserveAspectRatio="none">
      <rect x="4" y="0" width="2" height="660" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      <rect x="10" y="0" width="2" height="660" fill={P.wood2} stroke={P.black} strokeWidth="1" />
      {Array.from({ length: 28 }, (_, i) => (
        <rect key={i} x="0" y={i * 24} width="14" height="4" fill={P.wood1} stroke={P.black} strokeWidth="1" />
      ))}
    </svg>
  )
}

// ================================================================
// SHED BUILDING (just the sprite - no data)
// ================================================================
function ShedBuilding({ phase, isHovered, name }: { phase: PhaseKey; isHovered: boolean; name: string }) {
  const roof = PHASE_ROOF[phase]
  const icon = PHASE_ICONS[phase]
  return (
    <svg viewBox="0 0 180 100" width="100%" height="100%" style={{ imageRendering: 'pixelated' }}>
      {/* Ground shadow */}
      <ellipse cx="90" cy="96" rx="75" ry="4" fill="rgba(0,0,0,0.12)" />

      {/* Wall body */}
      <rect x="20" y="40" width="140" height="52" fill={P.wall2} stroke={P.black} strokeWidth="2.5" />
      {/* Wall detail lines */}
      <rect x="22" y="42" width="136" height="48" fill="none" />
      <line x1="20" y1="60" x2="160" y2="60" stroke={P.wall3} strokeWidth="1" />
      <line x1="60" y1="40" x2="60" y2="92" stroke={P.wall3} strokeWidth="0.8" />
      <line x1="120" y1="40" x2="120" y2="92" stroke={P.wall3} strokeWidth="0.8" />
      {/* Wall highlight */}
      <rect x="22" y="42" width="136" height="6" fill={P.wall1} opacity="0.5" />

      {/* Door */}
      <rect x="70" y="60" width="24" height="32" fill={P.wood3} stroke={P.black} strokeWidth="2" />
      <rect x="72" y="62" width="20" height="28" fill={P.wood2} />
      <rect x="74" y="64" width="2" height="24" fill={P.wood1} />
      <circle cx="88" cy="76" r="2" fill={P.yellow2} stroke={P.black} strokeWidth="1" />

      {/* Windows */}
      <rect x="30" y="48" width="20" height="16" fill="#bae6fd" stroke={P.black} strokeWidth="2" />
      <line x1="40" y1="48" x2="40" y2="64" stroke={P.black} strokeWidth="1.5" />
      <line x1="30" y1="56" x2="50" y2="56" stroke={P.black} strokeWidth="1.5" />
      <rect x="130" y="48" width="20" height="16" fill="#bae6fd" stroke={P.black} strokeWidth="2" />
      <line x1="140" y1="48" x2="140" y2="64" stroke={P.black} strokeWidth="1.5" />
      <line x1="130" y1="56" x2="150" y2="56" stroke={P.black} strokeWidth="1.5" />

      {/* Roof */}
      <polygon points="90,8 10,42 170,42" fill={roof.main} stroke={P.black} strokeWidth="2.5" />
      {/* Roof shade (right side) */}
      <polygon points="90,8 170,42 90,42" fill={roof.shade} opacity="0.3" />
      {/* Roof highlight (left side) */}
      <polygon points="90,8 10,42 50,42" fill={roof.light} opacity="0.3" />
      {/* Roof tiles */}
      {[20, 50, 80, 110, 140].map(x => (
        <line key={x} x1={x} y1={20 + (90 - x) * 0.15} x2={x + 20} y2={20 + (70 - x) * 0.15}
          stroke={P.black} strokeWidth="0.8" opacity="0.3" />
      ))}

      {/* Hover highlight glow */}
      {isHovered && (
        <rect x="18" y="38" width="144" height="56" fill="white" opacity="0.15" rx="2" />
      )}

      {/* Name plate above roof */}
      <text x="90" y="6" textAnchor="middle" fontSize="8" fill={P.black} fontFamily="monospace" fontWeight="bold">
        {name}
      </text>

      {/* Phase icon */}
      <text x="90" y="80" textAnchor="middle" fontSize="14">{icon}</text>
    </svg>
  )
}

// ================================================================
// WALKING CHICKEN
// ================================================================
function WalkingChicken({ left, top, delay, tick }: { left: string; top: string; delay: number; tick: number }) {
  const frame = Math.floor((tick + delay) / 2) % 4
  const dir = frame < 2 ? 1 : -1
  const bob = Math.sin(tick * 0.6 + delay) * 2

  return (
    <svg className="absolute pointer-events-none z-[6]"
      style={{ left, top, width: '18px', height: '18px', transform: `translateY(${bob}px) scaleX(${dir})`, imageRendering: 'pixelated' }}
      viewBox="0 0 18 18">
      {/* Body */}
      <ellipse cx="9" cy="11" rx="5" ry="3.5" fill="#fbbf24" stroke={P.black} strokeWidth="1.5" />
      {/* Head */}
      <circle cx="14" cy="8" r="3" fill="#fbbf24" stroke={P.black} strokeWidth="1.5" />
      {/* Eye */}
      <circle cx="15" cy="7" r="1" fill={P.black} />
      {/* Beak */}
      <polygon points="17,8 18,9 17,10" fill="#f97316" stroke={P.black} strokeWidth="0.8" />
      {/* Comb */}
      <rect x="13" y="4" width="3" height="2" fill={P.red1} stroke={P.black} strokeWidth="0.8" rx="0.5" />
      {/* Wing */}
      <ellipse cx="7" cy="10" rx="3" ry="2.5" fill="#f59e0b" stroke={P.black} strokeWidth="1" />
      {/* Legs */}
      <line x1="7" y1="14" x2="6" y2="17" stroke={P.orange1 || '#f97316'} strokeWidth="1.5" />
      <line x1="11" y1="14" x2="12" y2="17" stroke="#f97316" strokeWidth="1.5" />
    </svg>
  )
}

// ================================================================
// POKEMON DIALOG-BOX TOOLTIP
// ================================================================
function PokeTooltip({ shed, align }: {
  shed: {
    id: string; name: string; hens: number; layingRate: number
    isLaying: boolean; cycleMonth: number; phase: PhaseKey
    eggsPerDay: number; eggRevenue: number; feedCost: number
    netBalance: number; weeksLabel: string; progress: number
  }
  align: 'left' | 'right'
}) {
  const roof = PHASE_ROOF[shed.phase]
  const phaseColor = roof.main

  return (
    <div className="border-[3px] border-gray-800 rounded-lg overflow-hidden shadow-lg"
      style={{
        background: 'linear-gradient(135deg, #fefce8 0%, #fef9c3 50%, #fef08a 100%)',
        animation: 'fadeIn 0.15s ease-out',
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b-[3px] border-gray-800"
        style={{ backgroundColor: phaseColor }}>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{PHASE_ICONS[shed.phase]}</span>
          <span className="text-[10px] font-bold text-white drop-shadow-sm">{shed.name}</span>
        </div>
        <span className="text-[9px] font-bold text-white/90 bg-black/20 px-1.5 py-0.5 rounded">
          {PHASE_LABELS[shed.phase]}
        </span>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2 space-y-1.5">
        {/* Row 1: Hens + Laying rate */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[10px]">&#x1F414;</span>
            <span className="text-[10px] font-bold text-gray-800">{fmtNum(shed.hens)}</span>
            <span className="text-[8px] text-gray-500">aves</span>
          </div>
          {shed.isLaying && (
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-bold text-gray-800">{shed.layingRate}%</span>
              <span className="text-[8px] text-gray-500">postura</span>
            </div>
          )}
        </div>

        {/* Row 2: Production or Crianza */}
        {shed.isLaying ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px]">&#x1F95A;</span>
              <span className="text-[10px] font-bold text-orange-700">{fmtNum(shed.eggsPerDay)}</span>
              <span className="text-[8px] text-gray-500">huevos/dia</span>
            </div>
          </div>
        ) : (
          <div className="text-[9px] text-gray-500 italic">
            Crianza - Mes {shed.cycleMonth} ({shed.weeksLabel})
          </div>
        )}

        {/* Separator */}
        <div className="border-t border-gray-300" />

        {/* Row 3: Revenue + Feed cost */}
        {shed.isLaying && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div>
              <p className="text-[7px] text-gray-400 font-bold uppercase">Ingreso</p>
              <p className="text-[10px] font-bold text-green-700">{fmtRD(shed.eggRevenue)}</p>
            </div>
            <div>
              <p className="text-[7px] text-gray-400 font-bold uppercase">Feed</p>
              <p className="text-[10px] font-bold text-red-600">{fmtRD(shed.feedCost)}</p>
            </div>
            <div>
              <p className="text-[7px] text-gray-400 font-bold uppercase">Neto</p>
              <p className={`text-[10px] font-bold ${shed.netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmtRD(shed.netBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Progress bar - cycle */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] text-gray-400 font-bold uppercase">Ciclo</span>
            <span className="text-[8px] font-bold text-gray-600">Mes {shed.cycleMonth}/20</span>
          </div>
          <div className="h-2.5 bg-gray-300 border border-gray-500 rounded-sm overflow-hidden">
            <div
              className="h-full border-r border-gray-500"
              style={{
                width: `${shed.progress}%`,
                backgroundColor: shed.isLaying ? '#4ade80' : '#38bdf8',
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// HUD STAT BLOCK
// ================================================================
function StatBlock({ label, value, icon, bg, color }: { label: string; value: string; icon: string; bg: string; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-2 py-1.5 ${bg}`}>
      <p className="text-[7px] font-bold text-gray-400 leading-none mb-0.5">{label}</p>
      <p className={`text-[11px] font-bold ${color} leading-none`}>{value}</p>
    </div>
  )
}
