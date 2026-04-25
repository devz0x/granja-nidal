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
// GTA-STYLE PALETTE
// ================================================================
const C = {
  black:     '#111111',
  outline:   '#222222',
  asphalt:   '#4a4a4a',
  road:      '#5c5c5c',
  roadLine:  '#c8c832',
  sidewalk:  '#8a8a7a',
  grass1:    '#3d8b37',
  grass2:    '#2d7a27',
  grass3:    '#4d9b47',
  dirt:      '#8b7355',
  fence:     '#6b5b3a',
  fencePost: '#5a4a2e',
  wall:      '#c8b898',
  wallShade: '#a89878',
  door:      '#5a4a2e',
  window:    '#68a8d8',
  silo:      '#888888',
  water:     '#5898c8',
  tree1:     '#2a7a22',
  tree2:     '#358a2d',
  treeShade: '#1a5a12',
  hedge:     '#3a8a32',
  shadow:    'rgba(0,0,0,0.25)',
}

const PHASE_FILL: Record<PhaseKey, { fill: string; roof: string; accent: string }> = {
  pre_inicio:  { fill: '#a0a8b8', roof: '#8090a8', accent: '#6878a0' },
  inicio:      { fill: '#80b8d8', roof: '#68a0c0', accent: '#5088b0' },
  crecimiento: { fill: '#78c8b0', roof: '#60b098', accent: '#489880' },
  pre_postura: { fill: '#d8b868', roof: '#c0a050', accent: '#a88838' },
  postura:     { fill: '#68c878', roof: '#50b060', accent: '#389848' },
}

const PHASE_LABELS: Record<PhaseKey, string> = {
  pre_inicio: 'Pre-Inicio', inicio: 'Inicio', crecimiento: 'Crecimiento',
  pre_postura: 'Pre-Postura', postura: 'Postura',
}

// ================================================================
// HELPERS
// ================================================================
function fmtNum(v: number) { return new Intl.NumberFormat('es-DO').format(v) }
function fmtRD(v: number) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP',
    minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function FarmMapView({ batches, config, calculations }: FarmMapViewProps) {
  const [hoveredShed, setHoveredShed] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; side: 'left' | 'right' }>({ x: 0, y: 0, side: 'right' })
  const [tick, setTick] = useState(0)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(iv)
  }, [])

  // Compute shed data
  const shedData = useMemo(() =>
    batches.map((b, i) => {
      const d = calculations.batchDetails?.find(x => x.id === b.id)
      return {
        ...b, index: i,
        eggsPerDay: d?.eggsPerDay || 0,
        eggRevenue: d?.eggRevenue || 0,
        feedCost: d?.monthlyFeedCost || 0,
        netBalance: d?.netBalance || 0,
        weeksLabel: config.feedPhases[b.phase]?.weeks || '',
        progress: Math.min(100, (b.cycleMonth / 20) * 100),
      }
    }), [batches, calculations, config])

  // Dynamic grid: columns based on count, sheds shrink with more
  const { cols, rows, shedW, shedH } = useMemo(() => {
    const n = batches.length
    let c: number, r: number
    if (n <= 2) { c = 2; r = 1 }
    else if (n <= 4) { c = 2; r = 2 }
    else if (n <= 6) { c = 3; r = 2 }
    else if (n <= 9) { c = 3; r = 3 }
    else if (n <= 12) { c = 4; r = 3 }
    else { c = 4; r = Math.ceil(n / 4) }

    // Available area: 65% width, 55% height of map
    const areaW = 65
    const areaH = 55
    const gap = 4
    const w = Math.min(28, (areaW - gap * (c + 1)) / c)
    const h = Math.min(22, (areaH - gap * (r + 1)) / r)
    return { cols: c, rows: r, shedW: w, shedH: h }
  }, [batches.length])

  // Shed positions in the grid (percentage-based)
  const shedPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = []
    const startX = (100 - (cols * shedW + (cols - 1) * 4)) / 2
    const startY = 28 // below the entrance road
    for (let i = 0; i < batches.length; i++) {
      const c = i % cols
      const r = Math.floor(i / cols)
      positions.push({
        x: startX + c * (shedW + 4),
        y: startY + r * (shedH + 4),
      })
    }
    return positions
  }, [batches.length, cols, rows, shedW, shedH])

  const handleHover = useCallback((shedId: string, e: React.MouseEvent) => {
    setHoveredShed(shedId)
    const el = e.currentTarget as HTMLElement
    const map = mapRef.current
    if (!map) return
    const mr = map.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    // Convert pixel offset to percentage of map container
    const px = ((er.left - mr.left + er.width / 2) / mr.width) * 100
    const py = ((er.top - mr.top) / mr.height) * 100
    setTooltipPos({
      x: px,
      y: py,
      side: px > 50 ? 'left' : 'right',
    })
  }, [])

  const activeShed = shedData.find(s => s.id === hoveredShed)

  return (
    <div className="space-y-3">
      {/* ========= HUD BAR ========= */}
      <div className="flex items-stretch border-[3px] border-gray-800 rounded-sm overflow-hidden bg-gray-900">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-r-[3px] border-gray-600">
          <span className="text-sm">&#x1F3E0;</span>
          <div>
            <p className="text-[9px] font-bold text-gray-200 font-mono tracking-wider">GRANJA NIDAL</p>
            <p className="text-[8px] text-gray-400 font-mono">{fmtNum(calculations.totalHens)} aves | {batches.length} lotes</p>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-4 divide-x-[2px] divide-gray-600">
          <HudStat label="INGRESO" value={fmtRD(calculations.totalRevenue)} c="text-green-400" />
          <HudStat label="HUEVOS" value={`${fmtNum(calculations.totalEggs)}/m`} c="text-yellow-400" />
          <HudStat label="NETO" value={fmtRD(calculations.netProfit || 0)} c={calculations.netProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
          <HudStat label="MARGEN" value={`${(calculations.profitMargin || 0).toFixed(1)}%`} c="text-cyan-400" />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 border-l-[3px] border-gray-600">
          <span className="text-[8px] font-bold text-gray-300 font-mono">POSTURA</span>
          <span className="text-sm font-bold text-yellow-400 font-mono">{calculations.layingBatches}<span className="text-gray-500 text-[10px]">/{batches.length}</span></span>
        </div>
      </div>

      {/* ========= TOP-DOWN MAP ========= */}
      <div className="relative">
      <div
        ref={mapRef}
        className="relative w-full border-[3px] border-gray-800 rounded-sm overflow-visible select-none"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* Base grass */}
        <div className="absolute inset-0" style={{ background: C.grass1 }} />

        {/* Grass texture - subtle variation patches */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none">
          {[
            [10,15,25,12], [45,8,30,15], [80,12,20,10], [120,18,18,8],
            [5,50,22,14], [55,55,28,12], [95,48,24,18], [130,52,20,14],
            [15,75,30,10], [70,78,25,8], [115,74,20,12],
          ].map(([x,y,w,h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h} fill={i % 2 === 0 ? C.grass2 : C.grass3} opacity="0.6" rx="1" />
          ))}
        </svg>

        {/* === PERIMETER FENCE (top-down: line with posts) === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2]" viewBox="0 0 160 90" preserveAspectRatio="none">
          {/* Fence outline */}
          <rect x="3" y="3" width="154" height="84" fill="none" stroke={C.fence} strokeWidth="1.2" rx="1" />
          <rect x="4" y="4" width="152" height="82" fill="none" stroke={C.fencePost} strokeWidth="0.4" strokeDasharray="0.8 1.5" />
          {/* Fence posts at corners and intervals */}
          {[{x:3,y:3},{x:157,y:3},{x:3,y:87},{x:157,y:87},
            {x:40,y:3},{x:80,y:3},{x:120,y:3},
            {x:3,y:30},{x:3,y:58},{x:157,y:30},{x:157,y:58},
            {x:40,y:87},{x:80,y:87},{x:120,y:87},
          ].map((p,i) => (
            <rect key={i} x={p.x - 1} y={p.y - 1} width="2.5" height="2.5" fill={C.fencePost} rx="0.3" />
          ))}
        </svg>

        {/* === MAIN ROAD (horizontal at bottom of farm) === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" viewBox="0 0 160 90" preserveAspectRatio="none">
          {/* Road */}
          <rect x="4" y="22" width="152" height="5" fill={C.asphalt} rx="0.5" />
          {/* Road edges */}
          <line x1="4" y1="22" x2="156" y2="22" stroke={C.sidewalk} strokeWidth="0.6" />
          <line x1="4" y1="27" x2="156" y2="27" stroke={C.sidewalk} strokeWidth="0.6" />
          {/* Center dashes */}
          {[8, 22, 36, 50, 64, 78, 92, 106, 120, 134, 148].map(x => (
            <rect key={x} x={x} y="24" width="4" height="1" fill={C.roadLine} rx="0.3" />
          ))}

          {/* Vertical paths from road to each shed row */}
          {shedPositions.length > 0 && (() => {
            const uniqueRows = [...new Set(shedPositions.map((_, i) => Math.floor(i / cols)))]
            return uniqueRows.map(r => {
              const firstInRow = shedPositions[r * cols]
              const midX = firstInRow ? firstInRow.x + shedW / 2 : 50
              return (
                <g key={r}>
                  <rect x={midX - 1.5} y="27" width="3" height={firstInRow ? firstInRow.y - 27 - 1 : 5}
                    fill={C.asphalt} />
                  <rect x={midX - 1.2} y="27" width="2.4" height={firstInRow ? firstInRow.y - 27 - 1 : 5}
                    fill={C.road} opacity="0.5" />
                </g>
              )
            })
          })()}
        </svg>

        {/* === ENTRANCE GATE (bottom center) === */}
        <div className="absolute z-[3]" style={{ left: '46%', bottom: '2%', width: '8%', height: '5%' }}>
          <svg viewBox="0 0 40 16" width="100%" height="100%">
            <rect x="0" y="0" width="18" height="16" fill={C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="2" y="2" width="14" height="12" fill={C.fencePost} />
            <rect x="22" y="0" width="18" height="16" fill={C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="24" y="2" width="14" height="12" fill={C.fencePost} />
            {/* Open gate indicator */}
            <rect x="18" y="4" width="4" height="8" fill={C.grass1} />
          </svg>
        </div>

        {/* === SILO (top-left, top-down = circle) === */}
        <div className="absolute z-[3]" style={{ left: '6%', top: '6%', width: '6%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={C.silo} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="14" fill="#999" />
            <circle cx="16" cy="16" r="8" fill="#aaa" opacity="0.6" />
            <circle cx="20" cy="20" r="10" fill="#c8b832" opacity="0.4" />
            <circle cx="20" cy="20" r="3" fill={C.black} opacity="0.3" />
          </svg>
          <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white/80 font-mono whitespace-nowrap"
            style={{ textShadow: '1px 1px 1px black' }}>SILO</p>
        </div>

        {/* === WATER TANK (top-right, top-down = circle) === */}
        <div className="absolute z-[3]" style={{ left: '88%', top: '6%', width: '5%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={C.water} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="13" fill="#6898c8" />
            <ellipse cx="16" cy="16" rx="5" ry="3" fill="#88b8e8" opacity="0.6" />
            <circle cx="20" cy="20" r="2" fill={C.black} opacity="0.2" />
          </svg>
          <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white/80 font-mono whitespace-nowrap"
            style={{ textShadow: '1px 1px 1px black' }}>AGUA</p>
        </div>

        {/* === TOP-DOWN TREES (circles with shadow) === */}
        {[
          { x: '14%', y: '8%' }, { x: '18%', y: '13%' },
          { x: '82%', y: '9%' }, { x: '78%', y: '14%' },
          { x: '38%', y: '10%' },
          { x: '6%', y: '55%' }, { x: '90%', y: '60%' },
          { x: '4%', y: '80%' }, { x: '92%', y: '82%' },
          { x: '10%', y: '92%' }, { x: '84%', y: '94%' },
        ].map((pos, i) => (
          <TopDownTree key={i} x={pos.x} y={pos.y} variant={i % 3} />
        ))}

        {/* === HEDGES (top-down green rectangles) === */}
        {[
          { x: '20%', y: '7%', w: '10%', h: '2%' },
          { x: '65%', y: '8%', w: '12%', h: '2%' },
          { x: '30%', y: '93%', w: '14%', h: '2%' },
          { x: '55%', y: '92%', w: '16%', h: '2%' },
        ].map((h, i) => (
          <div key={i} className="absolute z-[3] rounded-sm" style={{
            left: h.x, top: h.y, width: h.w, height: h.h,
            background: C.hedge, border: `1.5px solid ${C.treeShade}`,
          }} />
        ))}

        {/* === SHEDS (top-down rectangles, interactive) === */}
        {shedData.map((shed, i) => {
          const pos = shedPositions[i]
          if (!pos) return null
          const isHov = hoveredShed === shed.id
          const phase = PHASE_FILL[shed.phase]

          return (
            <div
              key={shed.id}
              className="absolute z-10 cursor-default"
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                width: `${shedW}%`,
                height: `${shedH}%`,
              }}
              onMouseEnter={(e) => handleHover(shed.id, e)}
              onMouseLeave={() => setHoveredShed(null)}
            >
              {/* Shadow */}
              <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-sm"
                style={{ backgroundColor: C.shadow }} />

              {/* Shed body */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                preserveAspectRatio="none" style={{ imageRendering: 'auto' }}>
                {/* Outer wall */}
                <rect x="2" y="2" width="96" height="96" fill={phase.fill}
                  stroke={C.black} strokeWidth="3" rx="1" />
                {/* Wall inner detail */}
                <rect x="6" y="6" width="88" height="88" fill={phase.roof}
                  stroke={C.outline} strokeWidth="1" rx="0.5" />
                {/* Wall highlight */}
                <rect x="6" y="6" width="88" height="20" fill="white" opacity="0.12" rx="0.5" />

                {/* Inner floor pattern */}
                {[20, 40, 60, 80].map(y => (
                  <line key={y} x1="6" y1={y} x2="94" y2={y} stroke={C.outline} strokeWidth="0.3" opacity="0.3" />
                ))}
                {[25, 50, 75].map(x => (
                  <line key={x} x1={x} y1="6" x2={x} y2="94" stroke={C.outline} strokeWidth="0.3" opacity="0.3" />
                ))}

                {/* Door (bottom center) */}
                <rect x="38" y="78" width="24" height="20" fill={C.door} stroke={C.black} strokeWidth="1.5" rx="0.5" />
                <rect x="40" y="80" width="20" height="16" fill="#7a6a4e" />
                <circle cx="56" cy="88" r="2" fill={C.roadLine} stroke={C.black} strokeWidth="0.5" />

                {/* Feed troughs (left and right sides) */}
                <rect x="10" y="30" width="12" height="40" fill={C.dirt} stroke={C.outline} strokeWidth="0.8" rx="0.5" />
                <rect x="78" y="30" width="12" height="40" fill={C.dirt} stroke={C.outline} strokeWidth="0.8" rx="0.5" />
                {/* Feed in troughs */}
                <rect x="12" y="32" width="8" height="36" fill="#c8a832" opacity="0.5" rx="0.5" />
                <rect x="80" y="32" width="8" height="36" fill="#c8a832" opacity="0.5" rx="0.5" />

                {/* Water line (top) */}
                <rect x="26" y="10" width="48" height="6" fill={C.water} stroke={C.outline} strokeWidth="0.5" rx="0.5" />

                {/* Hover glow */}
                {isHov && (
                  <rect x="0" y="0" width="100" height="100" fill="white" opacity="0.15" rx="2"
                    stroke="white" strokeWidth="2" strokeOpacity="0.5" />
                )}
              </svg>

              {/* Shed name (above) */}
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-20"
                style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black' }}>
                <p className={`text-[8px] font-bold font-mono ${isHov ? 'text-white' : 'text-white/80'}`}>
                  {shed.name}
                </p>
              </div>

              {/* Phase dot (bottom-right) */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black/50 z-20"
                style={{ backgroundColor: phase.accent }}
              />
            </div>
          )
        })}

        {/* === WALKING CHICKENS (top-down = small dots) === */}
        <TopDownChicken x="12%" y="88%" delay={0} tick={tick} />
        <TopDownChicken x="75%" y="86%" delay={3} tick={tick} />
        <TopDownChicken x="48%" y="18%" delay={1} tick={tick} />

        {/* === FARM SIGN (top-down = rectangle on road) === */}
        <div className="absolute z-[4]" style={{ left: '43%', top: '19.5%', width: '14%', height: '4%' }}>
          <svg viewBox="0 0 100 30" width="100%" height="100%">
            <rect x="0" y="0" width="100" height="30" fill="#c8a848" stroke={C.black} strokeWidth="2" rx="1" />
            <rect x="3" y="3" width="94" height="24" fill="#e8d878" rx="0.5" />
            <text x="50" y="19" textAnchor="middle" fontSize="10" fill={C.black}
              fontFamily="monospace" fontWeight="bold">GRANJA NIDAL</text>
          </svg>
        </div>

        {/* === MINIMAP COMPASS === */}
        <div className="absolute z-20 bottom-2 right-2 w-8 h-8 bg-black/40 border border-white/20 rounded-full flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="24" height="24">
            <polygon points="12,2 15,10 12,8 9,10" fill="#ef4444" stroke="white" strokeWidth="0.5" />
            <polygon points="12,22 9,14 12,16 15,14" fill="white" stroke="#999" strokeWidth="0.5" />
            <text x="12" y="1" textAnchor="middle" fontSize="4" fill="white" fontWeight="bold">N</text>
          </svg>
        </div>

      </div>

      {/* === HOVER TOOLTIP (positioned relative to wrapper so it's not clipped) === */}
      {activeShed && tooltipPos && mapRef.current && (
        <FixedTooltip mapRef={mapRef} tooltipPos={tooltipPos} shed={activeShed} />
      )}
      </div>

      {/* ========= LEGEND ========= */}
      <div className="flex items-stretch border-[3px] border-gray-800 rounded-sm overflow-hidden divide-x-[2px] divide-gray-600 bg-gray-800">
        {(Object.keys(PHASE_LABELS) as PhaseKey[]).map(phase => (
          <div key={phase} className="flex-1 flex items-center gap-1.5 px-2 py-1.5">
            <div className="w-3.5 h-2.5 rounded-sm border border-gray-600"
              style={{ backgroundColor: PHASE_FILL[phase].fill }} />
            <span className="text-[8px] font-bold text-gray-300 font-mono">{PHASE_LABELS[phase]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================================================================
// TOP-DOWN TREE
// ================================================================
function TopDownTree({ x, y, variant }: { x: string; y: string; variant: number }) {
  const colors = [
    { main: C.tree1, shade: C.treeShade, light: C.tree2 },
    { main: C.tree2, shade: C.tree1, light: '#4aaa42' },
    { main: '#2a8a22', shade: '#1a6a12', light: '#3aba32' },
  ]
  const c = colors[variant]

  return (
    <div className="absolute z-[3] pointer-events-none" style={{ left: x, top: y, width: '3.5%', aspectRatio: '1' }}>
      <svg viewBox="0 0 30 30" width="100%" height="100%">
        {/* Shadow */}
        <ellipse cx="16" cy="16" rx="12" ry="12" fill={C.shadow} />
        {/* Canopy */}
        <circle cx="14" cy="14" r="11" fill={c.main} stroke={C.treeShade} strokeWidth="1.5" />
        <circle cx="10" cy="10" r="6" fill={c.light} opacity="0.5" />
        <circle cx="14" cy="14" r="4" fill={c.shade} opacity="0.3" />
      </svg>
    </div>
  )
}

// ================================================================
// TOP-DOWN CHICKEN (small moving dot)
// ================================================================
function TopDownChicken({ x, y, delay, tick }: { x: string; y: string; delay: number; tick: number }) {
  const angle = (tick * 0.8 + delay * 90) % 360
  const dx = Math.cos(angle * Math.PI / 180) * 0.3
  const dy = Math.sin(angle * Math.PI / 180) * 0.2

  return (
    <div className="absolute z-[6] pointer-events-none"
      style={{ left: x, top: y, width: '1.2%', aspectRatio: '1' }}>
      <svg viewBox="0 0 12 12" width="100%" height="100%"
        style={{ transform: `translate(${dx}%, ${dy}%)` }}>
        {/* Body */}
        <ellipse cx="6" cy="6" rx="4" ry="3.5" fill="#e8c820" stroke={C.black} strokeWidth="1" />
        {/* Head */}
        <circle cx="6" cy="3" r="2.5" fill="#e8c820" stroke={C.black} strokeWidth="0.8" />
        {/* Comb */}
        <ellipse cx="6" cy="1" rx="1.5" ry="0.8" fill="#d03030" stroke={C.black} strokeWidth="0.5" />
      </svg>
    </div>
  )
}

// ================================================================
// GTA-STYLE TOOLTIP (clean, dark)
// ================================================================
function GtaTooltip({ shed }: {
  shed: {
    id: string; name: string; hens: number; layingRate: number
    isLaying: boolean; cycleMonth: number; phase: PhaseKey
    eggsPerDay: number; eggRevenue: number; feedCost: number
    netBalance: number; weeksLabel: string; progress: number
  }
}) {
  const phase = PHASE_FILL[shed.phase]

  return (
    <div className="border-2 border-gray-700 rounded-sm overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)' }}>
      {/* Header with phase color */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-600"
        style={{ backgroundColor: phase.accent }}>
        <span className="text-[10px] font-bold text-white font-mono">{shed.name}</span>
        <span className="text-[8px] font-bold text-white/80 bg-black/20 px-1.5 py-0.5 rounded-sm">
          {PHASE_LABELS[shed.phase]}
        </span>
      </div>

      {/* Body */}
      <div className="px-2.5 py-2 space-y-1.5">
        {/* Hens */}
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-gray-400 font-mono">AVES</span>
          <span className="text-[10px] font-bold text-white font-mono">{fmtNum(shed.hens)}</span>
        </div>

        {/* Phase info */}
        {!shed.isLaying ? (
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-gray-400 font-mono">CRIANZA</span>
            <span className="text-[9px] text-yellow-400 font-mono">Mes {shed.cycleMonth} ({shed.weeksLabel})</span>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-gray-400 font-mono">POSTURA</span>
              <span className="text-[10px] font-bold text-yellow-400 font-mono">{shed.layingRate}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-gray-400 font-mono">HUEVOS/DIA</span>
              <span className="text-[10px] font-bold text-orange-400 font-mono">{fmtNum(shed.eggsPerDay)}</span>
            </div>
          </>
        )}

        {/* Separator */}
        <div className="border-t border-gray-700" />

        {/* Financials (only if laying) */}
        {shed.isLaying && (
          <div className="grid grid-cols-3 gap-1">
            <div>
              <p className="text-[6px] text-gray-500 font-mono">INGRESO</p>
              <p className="text-[9px] font-bold text-green-400 font-mono">{fmtRD(shed.eggRevenue)}</p>
            </div>
            <div>
              <p className="text-[6px] text-gray-500 font-mono">FEED</p>
              <p className="text-[9px] font-bold text-red-400 font-mono">{fmtRD(shed.feedCost)}</p>
            </div>
            <div>
              <p className="text-[6px] text-gray-500 font-mono">NETO</p>
              <p className={`text-[9px] font-bold font-mono ${shed.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtRD(shed.netBalance)}
              </p>
            </div>
          </div>
        )}

        {/* Cycle progress */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] text-gray-500 font-mono">CICLO</span>
            <span className="text-[8px] text-gray-300 font-mono">{shed.cycleMonth}/20</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-sm overflow-hidden">
            <div className="h-full rounded-sm transition-all duration-300"
              style={{
                width: `${shed.progress}%`,
                backgroundColor: shed.isLaying ? phase.fill : '#6898c8',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// FIXED TOOLTIP (uses viewport coords so it's never clipped)
// ================================================================
function FixedTooltip({ mapRef, tooltipPos, shed }: {
  mapRef: React.RefObject<HTMLDivElement | null>
  tooltipPos: { x: number; y: number; side: 'left' | 'right' }
  shed: {
    id: string; name: string; hens: number; layingRate: number
    isLaying: boolean; cycleMonth: number; phase: PhaseKey
    eggsPerDay: number; eggRevenue: number; feedCost: number
    netBalance: number; weeksLabel: string; progress: number
  }
}) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const mr = map.getBoundingClientRect()
    const shedCenterX = mr.left + (tooltipPos.x / 100) * mr.width
    const shedTop = mr.top + (tooltipPos.y / 100) * mr.height

    const offset = 10
    const tooltipW = 210
    let left: number
    if (tooltipPos.side === 'right') {
      left = shedCenterX + offset
      // Keep within viewport
      if (left + tooltipW > window.innerWidth - 10) {
        left = shedCenterX - tooltipW - offset
      }
    } else {
      left = shedCenterX - tooltipW - offset
      if (left < 10) {
        left = shedCenterX + offset
      }
    }

    let top = shedTop
    if (top + 260 > window.innerHeight - 10) {
      top = window.innerHeight - 270
    }
    if (top < 10) top = 10

    setPos({ top, left })
  }, [mapRef, tooltipPos])

  return (
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: pos.top, left: pos.left, width: '210px', maxWidth: '210px' }}
    >
      <GtaTooltip shed={shed} />
    </div>
  )
}

// ================================================================
// HUD STAT
// ================================================================
function HudStat({ label, value, c }: { label: string; value: string; c: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-1 py-1.5">
      <p className="text-[7px] text-gray-500 font-mono leading-none mb-0.5">{label}</p>
      <p className={`text-[11px] font-bold font-mono ${c} leading-none`}>{value}</p>
    </div>
  )
}
