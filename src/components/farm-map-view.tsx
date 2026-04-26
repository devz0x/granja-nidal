'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'

// ================================================================
// TYPES
// ================================================================
type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

type WeatherType = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain-light' | 'rain-moderate' | 'rain-heavy' | 'thunderstorm' | 'showers' | 'snow'

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

interface WeatherData {
  current: {
    temp: number; condition: string; humidity: number; windSpeed: number
  }
}

interface FarmMapViewProps {
  batches: BatchConfig[]; config: FarmConfig; calculations: CalculationsResult
}

// ================================================================
// WEATHER CLASSIFICATION
// ================================================================
function classifyWeather(condition: string): WeatherType {
  const c = condition.toLowerCase()
  if (c.includes('despejado') || c.includes('soleado') || c.includes('sunny')) return 'clear'
  if (c.includes('principalmente despejado')) return 'clear'
  if (c.includes('parcialmente nublado')) return 'partly-cloudy'
  if (c.includes('nublado')) return 'cloudy'
  if (c.includes('niebla') || c.includes('fog')) return 'fog'
  if (c.includes('tormenta') || c.includes('thunder') || c.includes('granizo')) return 'thunderstorm'
  if (c.includes('lluvia fuerte') || c.includes('chubascos fuertes')) return 'rain-heavy'
  if (c.includes('lluvia moderada') || c.includes('chubascos moderados')) return 'rain-moderate'
  if (c.includes('lluvia ligera') || c.includes('chubascos')) return 'rain-light'
  if (c.includes('lluvia') || c.includes('rain')) return 'rain-moderate'
  if (c.includes('nevada') || c.includes('nieve') || c.includes('snow')) return 'snow'
  return 'partly-cloudy'
}

// ================================================================
// WEATHER SCENE CONFIG
// ================================================================
const WEATHER_SCENE: Record<WeatherType, {
  skyGradient: string
  grassColor: string
  grassColor2: string
  grassColor3: string
  overlayOpacity: number
  overlayColor: string
  rainDrops: number
  cloudCount: number
  cloudSpeed: string
  hasLightning: boolean
  hasSun: boolean
  hasFog: boolean
  snowFlakes: number
  puddles: boolean
  windSway: 'none' | 'light' | 'strong'
  chickensHidden: boolean
}> = {
  'clear': {
    skyGradient: 'linear-gradient(180deg, #4a90d9 0%, #7ec8e3 30%, #b8e4f0 60%, transparent 100%)',
    grassColor: '#3d8b37', grassColor2: '#2d7a27', grassColor3: '#4d9b47',
    overlayOpacity: 0, overlayColor: 'transparent',
    rainDrops: 0, cloudCount: 0, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: true, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'partly-cloudy': {
    skyGradient: 'linear-gradient(180deg, #6a9fd8 0%, #8eb8d8 30%, #b8d0e8 60%, transparent 100%)',
    grassColor: '#3d8b37', grassColor2: '#2d7a27', grassColor3: '#4d9b47',
    overlayOpacity: 0, overlayColor: 'transparent',
    rainDrops: 0, cloudCount: 3, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'cloudy': {
    skyGradient: 'linear-gradient(180deg, #787878 0%, #909090 30%, #a0a0a0 60%, transparent 100%)',
    grassColor: '#358030', grassColor2: '#2a6a25', grassColor3: '#458840',
    overlayOpacity: 0.12, overlayColor: '#555',
    rainDrops: 0, cloudCount: 6, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'light', chickensHidden: false,
  },
  'fog': {
    skyGradient: 'linear-gradient(180deg, #b0b0b0 0%, #c8c8c8 40%, #d8d8d8 70%, transparent 100%)',
    grassColor: '#3a8535', grassColor2: '#2a7525', grassColor3: '#4a9045',
    overlayOpacity: 0.25, overlayColor: '#c8c8c8',
    rainDrops: 0, cloudCount: 2, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: false, hasFog: true, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'rain-light': {
    skyGradient: 'linear-gradient(180deg, #5a6a78 0%, #6a7a88 30%, #8090a0 60%, transparent 100%)',
    grassColor: '#2d7528', grassColor2: '#226a1e', grassColor3: '#3a8235',
    overlayOpacity: 0.15, overlayColor: '#4a5a68',
    rainDrops: 30, cloudCount: 4, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: false,
  },
  'rain-moderate': {
    skyGradient: 'linear-gradient(180deg, #4a5a68 0%, #5a6a78 30%, #6a7a88 60%, transparent 100%)',
    grassColor: '#256a20', grassColor2: '#1a5a18', grassColor3: '#307028',
    overlayOpacity: 0.22, overlayColor: '#3a4a58',
    rainDrops: 60, cloudCount: 5, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: true,
  },
  'rain-heavy': {
    skyGradient: 'linear-gradient(180deg, #3a4a58 0%, #4a5a68 30%, #5a6a78 60%, transparent 100%)',
    grassColor: '#1e5a18', grassColor2: '#154a12', grassColor3: '#286020',
    overlayOpacity: 0.32, overlayColor: '#2a3a48',
    rainDrops: 100, cloudCount: 6, cloudSpeed: 'cloud-drift-fast',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'strong', chickensHidden: true,
  },
  'thunderstorm': {
    skyGradient: 'linear-gradient(180deg, #2a2a3a 0%, #3a3a4a 30%, #4a4a5a 60%, transparent 100%)',
    grassColor: '#1a4a15', grassColor2: '#103a0e', grassColor3: '#205018',
    overlayOpacity: 0.38, overlayColor: '#1a1a2a',
    rainDrops: 120, cloudCount: 7, cloudSpeed: 'cloud-drift-fast',
    hasLightning: true, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'strong', chickensHidden: true,
  },
  'showers': {
    skyGradient: 'linear-gradient(180deg, #5a7080 0%, #6a8090 30%, #8098a8 60%, transparent 100%)',
    grassColor: '#2a7025', grassColor2: '#206a1c', grassColor3: '#358030',
    overlayOpacity: 0.12, overlayColor: '#4a6070',
    rainDrops: 40, cloudCount: 4, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: false,
  },
  'snow': {
    skyGradient: 'linear-gradient(180deg, #8a9098 0%, #a0a8b0 30%, #b8c0c8 60%, transparent 100%)',
    grassColor: '#5a7a58', grassColor2: '#4a6a48', grassColor3: '#6a8a68',
    overlayOpacity: 0.15, overlayColor: '#d0d8e0',
    rainDrops: 0, cloudCount: 4, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 50,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
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

// Seeded pseudo-random for deterministic particle positions
function seededRandom(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function FarmMapView({ batches, config, calculations }: FarmMapViewProps) {
  const [hoveredShed, setHoveredShed] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number; side: 'left' | 'right' }>({ x: 0, y: 0, side: 'right' })
  const [tick, setTick] = useState(0)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoaded, setWeatherLoaded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(iv)
  }, [])

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather')
        if (res.ok) {
          const data = await res.json()
          setWeather({ current: data.current })
          setWeatherLoaded(true)
        }
      } catch {
        // Silently fail - farm still renders with default weather
      }
    }
    fetchWeather()
    const iv = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  // Classify current weather
  const weatherType = useMemo<WeatherType>(() => {
    if (!weather) return 'partly-cloudy'
    return classifyWeather(weather.current.condition)
  }, [weather])

  // Get scene config
  const scene = WEATHER_SCENE[weatherType]

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
    const startY = 28
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
    const px = ((er.left - mr.left + er.width / 2) / mr.width) * 100
    const py = ((er.top - mr.top) / mr.height) * 100
    setTooltipPos({
      x: px,
      y: py,
      side: px > 50 ? 'left' : 'right',
    })
  }, [])

  const activeShed = shedData.find(s => s.id === hoveredShed)

  // Generate deterministic rain drops
  const rainDrops = useMemo(() => {
    if (scene.rainDrops === 0) return []
    return Array.from({ length: scene.rainDrops }, (_, i) => ({
      id: i,
      left: seededRandom(i * 3.7) * 100,
      delay: seededRandom(i * 7.3 + 100) * 2,
      duration: 0.6 + seededRandom(i * 2.1) * 0.5,
      width: weatherType === 'rain-heavy' || weatherType === 'thunderstorm' ? 1.5 : 1,
      height: 12 + seededRandom(i * 5.3) * 8,
      opacity: 0.3 + seededRandom(i * 9.1) * 0.4,
    }))
  }, [scene.rainDrops, weatherType])

  // Generate deterministic clouds
  const clouds = useMemo(() => {
    if (scene.cloudCount === 0) return []
    return Array.from({ length: scene.cloudCount }, (_, i) => ({
      id: i,
      top: 2 + seededRandom(i * 4.3 + 50) * 18,
      width: 18 + seededRandom(i * 6.1 + 80) * 22,
      height: 8 + seededRandom(i * 2.9 + 60) * 10,
      delay: seededRandom(i * 8.7 + 30) * 15,
      duration: 25 + seededRandom(i * 3.3 + 40) * 20,
      opacity: weatherType === 'thunderstorm' ? 0.85 : 0.55 + seededRandom(i * 5.1) * 0.25,
      dark: weatherType === 'thunderstorm' || weatherType === 'rain-heavy',
    }))
  }, [scene.cloudCount, weatherType])

  // Generate deterministic snow flakes
  const snowFlakes = useMemo(() => {
    if (scene.snowFlakes === 0) return []
    return Array.from({ length: scene.snowFlakes }, (_, i) => ({
      id: i,
      left: seededRandom(i * 3.1 + 200) * 100,
      delay: seededRandom(i * 7.9 + 300) * 6,
      duration: 4 + seededRandom(i * 2.3) * 4,
      size: 2 + seededRandom(i * 4.7 + 400) * 3,
      opacity: 0.4 + seededRandom(i * 6.3 + 500) * 0.5,
    }))
  }, [scene.snowFlakes])

  // Generate puddle positions
  const puddles = useMemo(() => {
    if (!scene.puddles) return []
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 10 + seededRandom(i * 11.3 + 700) * 80,
      y: 30 + seededRandom(i * 7.7 + 800) * 55,
      rx: 2 + seededRandom(i * 3.1 + 900) * 3,
      ry: 1 + seededRandom(i * 5.9 + 1000) * 1.5,
      delay: seededRandom(i * 9.3 + 1100) * 2,
    }))
  }, [scene.puddles])

  const isRain = weatherType === 'rain-light' || weatherType === 'rain-moderate' || weatherType === 'rain-heavy' || weatherType === 'thunderstorm' || weatherType === 'showers'

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
          {/* Weather indicator in HUD */}
          <div className="flex items-center gap-1 mr-2">
            <WeatherHudIcon weatherType={weatherType} />
            <span className="text-[8px] text-gray-400 font-mono">
              {weather?.current.temp ? `${weather.current.temp}°C` : ''}
            </span>
          </div>
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
        {/* === SKY GRADIENT (weather-reactive) === */}
        <div
          className="absolute inset-0 z-[0] transition-all duration-[2000ms]"
          style={{ background: scene.skyGradient }}
        />

        {/* Base grass (weather-reactive color) */}
        <div
          className="absolute inset-0 transition-all duration-[2000ms]"
          style={{ background: scene.grassColor }}
        />

        {/* Grass texture - weather-reactive colors */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none">
          {[
            [10,15,25,12], [45,8,30,15], [80,12,20,10], [120,18,18,8],
            [5,50,22,14], [55,55,28,12], [95,48,24,18], [130,52,20,14],
            [15,75,30,10], [70,78,25,8], [115,74,20,12],
          ].map(([x,y,w,h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h}
              fill={i % 2 === 0 ? scene.grassColor2 : scene.grassColor3}
              opacity="0.6" rx="1"
              style={{ transition: 'fill 2000ms' }}
            />
          ))}
        </svg>

        {/* === WEATHER OVERLAY (tint) === */}
        {scene.overlayOpacity > 0 && (
          <div
            className="absolute inset-0 z-[1] pointer-events-none"
            style={{
              backgroundColor: scene.overlayColor,
              opacity: scene.overlayOpacity,
              transition: 'all 2000ms',
            }}
          />
        )}

        {/* === SUN GLOW (clear weather) === */}
        {scene.hasSun && (
          <div className="absolute z-[1] pointer-events-none" style={{
            top: '-5%', right: '5%', width: '40%', aspectRatio: '1',
          }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,220,100,0.4) 0%, rgba(255,200,50,0.15) 40%, transparent 70%)',
                animation: 'sun-pulse 4s ease-in-out infinite',
              }}
            />
            {/* Rotating sun rays */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              <g style={{ transformOrigin: '50% 50%', animation: 'sun-ray-rotate 20s linear infinite' }}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                  <line key={angle}
                    x1="50" y1="50" x2={50 + 30 * Math.cos(angle * Math.PI / 180)} y2={50 + 30 * Math.sin(angle * Math.PI / 180)}
                    stroke="rgba(255,220,100,0.15)" strokeWidth="2"
                  />
                ))}
              </g>
              {/* Sun disc */}
              <circle cx="50" cy="50" r="8" fill="rgba(255,220,100,0.5)" />
              <circle cx="50" cy="50" r="5" fill="rgba(255,235,150,0.6)" />
            </svg>
          </div>
        )}

        {/* === CLOUDS (drifting across the sky) === */}
        {clouds.map(cloud => (
          <div
            key={cloud.id}
            className="absolute z-[2] pointer-events-none"
            style={{
              top: `${cloud.top}%`,
              width: `${cloud.width}%`,
              height: `${cloud.height}%`,
              animation: `${scene.cloudSpeed} ${cloud.duration}s linear infinite`,
              animationDelay: `-${cloud.delay}s`,
              opacity: cloud.opacity,
            }}
          >
            <svg viewBox="0 0 120 50" width="100%" height="100%" preserveAspectRatio="none">
              {/* Multi-lobed cloud shape */}
              <ellipse cx="35" cy="35" rx="30" ry="14" fill={cloud.dark ? '#4a4a5a' : '#e0e4e8'} />
              <ellipse cx="60" cy="28" rx="28" ry="18" fill={cloud.dark ? '#3a3a4a' : '#d0d4d8'} />
              <ellipse cx="85" cy="33" rx="25" ry="13" fill={cloud.dark ? '#3a3a4a' : '#d8dce0'} />
              <ellipse cx="50" cy="22" rx="22" ry="15" fill={cloud.dark ? '#505060' : '#e8ecf0'} />
              <ellipse cx="72" cy="24" rx="18" ry="12" fill={cloud.dark ? '#484858' : '#e4e8ec'} />
              {/* Cloud bottom highlight */}
              <ellipse cx="55" cy="38" rx="35" ry="8" fill={cloud.dark ? '#555568' : '#f0f2f4'} opacity="0.5" />
            </svg>
          </div>
        ))}

        {/* === RAIN PARTICLES === */}
        {rainDrops.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {rainDrops.map(drop => (
              <line key={drop.id}
                x1={drop.left} y1="0"
                x2={drop.left - 0.5} y2={drop.height / 10}
                stroke="rgba(180,200,220,0.6)"
                strokeWidth={drop.width / 10}
                strokeLinecap="round"
                style={{
                  animation: `${weatherType === 'rain-heavy' || weatherType === 'thunderstorm' ? 'rain-fall-heavy' : 'rain-fall'} ${drop.duration}s linear infinite`,
                  animationDelay: `-${drop.delay}s`,
                  opacity: drop.opacity,
                }}
              />
            ))}
          </svg>
        )}

        {/* === SNOW PARTICLES === */}
        {snowFlakes.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {snowFlakes.map(flake => (
              <circle key={flake.id}
                cx={flake.left} cy="0"
                r={flake.size / 10}
                fill="white"
                style={{
                  animation: `snow-fall ${flake.duration}s linear infinite`,
                  animationDelay: `-${flake.delay}s`,
                  opacity: flake.opacity,
                }}
              />
            ))}
          </svg>
        )}

        {/* === LIGHTNING FLASHES === */}
        {scene.hasLightning && (
          <>
            <div
              className="absolute inset-0 z-[16] pointer-events-none"
              style={{
                background: 'rgba(255,255,240,0.8)',
                animation: 'lightning-flash 7s ease-in-out infinite',
              }}
            />
            <div
              className="absolute inset-0 z-[16] pointer-events-none"
              style={{
                background: 'rgba(255,255,240,0.7)',
                animation: 'lightning-flash-delayed 9s ease-in-out infinite',
              }}
            />
            {/* Lightning bolt SVG */}
            <svg className="absolute z-[14] pointer-events-none" style={{ top: '2%', left: '35%', width: '6%', height: '40%' }} viewBox="0 0 30 100">
              <polygon
                points="18,0 8,35 16,35 6,70 14,70 4,100 22,55 14,55 24,25 16,25"
                fill="rgba(255,255,220,0.9)"
                style={{
                  animation: 'lightning-flash 5s ease-in-out infinite',
                }}
              />
            </svg>
          </>
        )}

        {/* === FOG OVERLAY === */}
        {scene.hasFog && (
          <>
            <div
              className="absolute z-[14] pointer-events-none"
              style={{
                top: '15%', left: '-10%', width: '120%', height: '50%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(200,200,200,0.5) 20%, rgba(210,210,210,0.6) 50%, rgba(200,200,200,0.5) 80%, transparent 100%)',
                animation: 'fog-drift 12s ease-in-out infinite',
              }}
            />
            <div
              className="absolute z-[14] pointer-events-none"
              style={{
                top: '40%', left: '-5%', width: '110%', height: '35%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(190,190,190,0.4) 30%, rgba(200,200,200,0.5) 60%, transparent 100%)',
                animation: 'fog-drift 16s ease-in-out infinite reverse',
              }}
            />
          </>
        )}

        {/* === PUDDLES (after rain) === */}
        {puddles.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[5] pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none">
            {puddles.map(p => (
              <ellipse key={p.id}
                cx={p.x} cy={p.y} rx={p.rx} ry={p.ry}
                fill="rgba(100,130,170,0.35)"
                stroke="rgba(80,110,150,0.2)"
                strokeWidth="0.3"
                style={{
                  animation: `puddle-shimmer ${2 + p.delay}s ease-in-out infinite`,
                  animationDelay: `-${p.delay}s`,
                }}
              />
            ))}
          </svg>
        )}

        {/* === PERIMETER FENCE === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2]" viewBox="0 0 160 90" preserveAspectRatio="none">
          <rect x="3" y="3" width="154" height="84" fill="none" stroke={C.fence} strokeWidth="1.2" rx="1" />
          <rect x="4" y="4" width="152" height="82" fill="none" stroke={C.fencePost} strokeWidth="0.4" strokeDasharray="0.8 1.5" />
          {[{x:3,y:3},{x:157,y:3},{x:3,y:87},{x:157,y:87},
            {x:40,y:3},{x:80,y:3},{x:120,y:3},
            {x:3,y:30},{x:3,y:58},{x:157,y:30},{x:157,y:58},
            {x:40,y:87},{x:80,y:87},{x:120,y:87},
          ].map((p,i) => (
            <rect key={i} x={p.x - 1} y={p.y - 1} width="2.5" height="2.5" fill={C.fencePost} rx="0.3" />
          ))}
        </svg>

        {/* === MAIN ROAD === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" viewBox="0 0 160 90" preserveAspectRatio="none">
          <rect x="4" y="22" width="152" height="5" fill={C.asphalt} rx="0.5" />
          <line x1="4" y1="22" x2="156" y2="22" stroke={C.sidewalk} strokeWidth="0.6" />
          <line x1="4" y1="27" x2="156" y2="27" stroke={C.sidewalk} strokeWidth="0.6" />
          {[8, 22, 36, 50, 64, 78, 92, 106, 120, 134, 148].map(x => (
            <rect key={x} x={x} y="24" width="4" height="1" fill={C.roadLine} rx="0.3" />
          ))}

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

          {/* Wet road shine when raining */}
          {isRain && (
            <rect x="4" y="22" width="152" height="5" fill="rgba(150,180,210,0.2)" rx="0.5" />
          )}
        </svg>

        {/* === ENTRANCE GATE === */}
        <div className="absolute z-[3]" style={{ left: '46%', bottom: '2%', width: '8%', height: '5%' }}>
          <svg viewBox="0 0 40 16" width="100%" height="100%">
            <rect x="0" y="0" width="18" height="16" fill={C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="2" y="2" width="14" height="12" fill={C.fencePost} />
            <rect x="22" y="0" width="18" height="16" fill={C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="24" y="2" width="14" height="12" fill={C.fencePost} />
            <rect x="18" y="4" width="4" height="8" fill={scene.grassColor} />
          </svg>
        </div>

        {/* === SILO === */}
        <div className="absolute z-[3]" style={{ left: '6%', top: '6%', width: '6%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={C.silo} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="14" fill="#999" />
            <circle cx="16" cy="16" r="8" fill="#aaa" opacity="0.6" />
            <circle cx="20" cy="20" r="10" fill="#c8b832" opacity="0.4" />
            <circle cx="20" cy="20" r="3" fill={C.black} opacity="0.3" />
            {/* Wet shine when raining */}
            {isRain && (
              <ellipse cx="14" cy="14" rx="6" ry="4" fill="rgba(150,180,210,0.3)" />
            )}
          </svg>
          <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white/80 font-mono whitespace-nowrap"
            style={{ textShadow: '1px 1px 1px black' }}>SILO</p>
        </div>

        {/* === WATER TANK === */}
        <div className="absolute z-[3]" style={{ left: '88%', top: '6%', width: '5%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={C.water} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="13" fill="#6898c8" />
            <ellipse cx="16" cy="16" rx="5" ry="3" fill="#88b8e8" opacity="0.6" />
            <circle cx="20" cy="20" r="2" fill={C.black} opacity="0.2" />
            {/* Ripples when raining */}
            {isRain && (
              <>
                <circle cx="20" cy="20" r="8" fill="none" stroke="rgba(200,220,240,0.4)" strokeWidth="0.5"
                  style={{ animation: 'puddle-shimmer 1.5s ease-in-out infinite' }} />
                <circle cx="20" cy="20" r="11" fill="none" stroke="rgba(200,220,240,0.3)" strokeWidth="0.5"
                  style={{ animation: 'puddle-shimmer 2s ease-in-out infinite', animationDelay: '0.5s' }} />
              </>
            )}
          </svg>
          <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white/80 font-mono whitespace-nowrap"
            style={{ textShadow: '1px 1px 1px black' }}>AGUA</p>
        </div>

        {/* === TREES (with wind sway) === */}
        {[
          { x: '14%', y: '8%' }, { x: '18%', y: '13%' },
          { x: '82%', y: '9%' }, { x: '78%', y: '14%' },
          { x: '38%', y: '10%' },
          { x: '6%', y: '55%' }, { x: '90%', y: '60%' },
          { x: '4%', y: '80%' }, { x: '92%', y: '82%' },
          { x: '10%', y: '92%' }, { x: '84%', y: '94%' },
        ].map((pos, i) => (
          <div key={i} style={{
            animation: scene.windSway === 'strong' ? `wind-sway-strong ${1.5 + (i % 3) * 0.3}s ease-in-out infinite` :
                       scene.windSway === 'light' ? `wind-sway ${2 + (i % 3) * 0.4}s ease-in-out infinite` : 'none',
            animationDelay: `${(i % 5) * 0.3}s`,
          }}>
            <TopDownTree x={pos.x} y={pos.y} variant={i % 3} weatherType={weatherType} />
          </div>
        ))}

        {/* === HEDGES === */}
        {[
          { x: '20%', y: '7%', w: '10%', h: '2%' },
          { x: '65%', y: '8%', w: '12%', h: '2%' },
          { x: '30%', y: '93%', w: '14%', h: '2%' },
          { x: '55%', y: '92%', w: '16%', h: '2%' },
        ].map((h, i) => (
          <div key={i} className="absolute z-[3] rounded-sm" style={{
            left: h.x, top: h.y, width: h.w, height: h.h,
            background: isRain ? '#2a6a25' : C.hedge,
            border: `1.5px solid ${C.treeShade}`,
            transition: 'background 2000ms',
          }} />
        ))}

        {/* === SHEDS === */}
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
                style={{ backgroundColor: isRain ? 'rgba(0,0,0,0.35)' : C.shadow }} />

              {/* Shed body */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100"
                preserveAspectRatio="none" style={{ imageRendering: 'auto' }}>
                <rect x="2" y="2" width="96" height="96" fill={phase.fill}
                  stroke={C.black} strokeWidth="3" rx="1" />
                <rect x="6" y="6" width="88" height="88" fill={phase.roof}
                  stroke={C.outline} strokeWidth="1" rx="0.5" />
                <rect x="6" y="6" width="88" height="20" fill="white" opacity={isRain ? 0.06 : 0.12} rx="0.5" />

                {[20, 40, 60, 80].map(y => (
                  <line key={y} x1="6" y1={y} x2="94" y2={y} stroke={C.outline} strokeWidth="0.3" opacity="0.3" />
                ))}
                {[25, 50, 75].map(x => (
                  <line key={x} x1={x} y1="6" x2={x} y2="94" stroke={C.outline} strokeWidth="0.3" opacity="0.3" />
                ))}

                <rect x="38" y="78" width="24" height="20" fill={C.door} stroke={C.black} strokeWidth="1.5" rx="0.5" />
                <rect x="40" y="80" width="20" height="16" fill="#7a6a4e" />
                <circle cx="56" cy="88" r="2" fill={C.roadLine} stroke={C.black} strokeWidth="0.5" />

                <rect x="10" y="30" width="12" height="40" fill={C.dirt} stroke={C.outline} strokeWidth="0.8" rx="0.5" />
                <rect x="78" y="30" width="12" height="40" fill={C.dirt} stroke={C.outline} strokeWidth="0.8" rx="0.5" />
                <rect x="12" y="32" width="8" height="36" fill="#c8a832" opacity="0.5" rx="0.5" />
                <rect x="80" y="32" width="8" height="36" fill="#c8a832" opacity="0.5" rx="0.5" />

                <rect x="26" y="10" width="48" height="6" fill={C.water} stroke={C.outline} strokeWidth="0.5" rx="0.5" />

                {/* Wet roof shine when raining */}
                {isRain && (
                  <rect x="2" y="2" width="96" height="96" fill="rgba(150,180,210,0.12)" rx="1" />
                )}

                {isHov && (
                  <rect x="0" y="0" width="100" height="100" fill="white" opacity="0.15" rx="2"
                    stroke="white" strokeWidth="2" strokeOpacity="0.5" />
                )}
              </svg>

              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-20"
                style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black' }}>
                <p className={`text-[8px] font-bold font-mono ${isHov ? 'text-white' : 'text-white/80'}`}>
                  {shed.name}
                </p>
              </div>

              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black/50 z-20"
                style={{ backgroundColor: phase.accent }}
              />
            </div>
          )
        })}

        {/* === WALKING CHICKENS (hide during heavy rain) === */}
        {!scene.chickensHidden && (
          <>
            <TopDownChicken x="12%" y="88%" delay={0} tick={tick} />
            <TopDownChicken x="75%" y="86%" delay={3} tick={tick} />
            <TopDownChicken x="48%" y="18%" delay={1} tick={tick} />
          </>
        )}

        {/* Chickens seeking shelter under sheds during rain */}
        {scene.chickensHidden && (
          <>
            <TopDownChicken x="25%" y="42%" delay={0} tick={tick} sheltered />
            <TopDownChicken x="60%" y="45%" delay={3} tick={tick} sheltered />
            <TopDownChicken x="40%" y="40%" delay={1} tick={tick} sheltered />
          </>
        )}

        {/* === FARM SIGN === */}
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

        {/* === WEATHER STATUS BADGE (bottom-left) === */}
        {weatherLoaded && (
          <div className="absolute z-20 bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/15 rounded-full px-2.5 py-1"
            style={{ animation: 'weather-transition 1s ease-out' }}>
            <WeatherStatusDot weatherType={weatherType} />
            <span className="text-[8px] font-bold text-white/80 font-mono">
              {weather?.current.condition || ''}
            </span>
            {weather?.current.temp && (
              <span className="text-[8px] text-white/60 font-mono">
                {weather.current.temp}°C
              </span>
            )}
          </div>
        )}

      </div>

      {/* === HOVER TOOLTIP === */}
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
// TOP-DOWN TREE (weather-reactive)
// ================================================================
function TopDownTree({ x, y, variant, weatherType }: { x: string; y: string; variant: number; weatherType: WeatherType }) {
  const colors = [
    { main: C.tree1, shade: C.treeShade, light: C.tree2 },
    { main: C.tree2, shade: C.tree1, light: '#4aaa42' },
    { main: '#2a8a22', shade: '#1a6a12', light: '#3aba32' },
  ]
  const c = colors[variant]

  const isRain = weatherType === 'rain-light' || weatherType === 'rain-moderate' || weatherType === 'rain-heavy' || weatherType === 'thunderstorm' || weatherType === 'showers'
  const isSnow = weatherType === 'snow'
  const isDark = weatherType === 'thunderstorm' || weatherType === 'rain-heavy'

  return (
    <div className="absolute z-[3] pointer-events-none" style={{ left: x, top: y, width: '3.5%', aspectRatio: '1' }}>
      <svg viewBox="0 0 30 30" width="100%" height="100%">
        {/* Shadow */}
        <ellipse cx="16" cy="16" rx="12" ry="12" fill={isDark ? 'rgba(0,0,0,0.35)' : C.shadow} />
        {/* Canopy */}
        <circle cx="14" cy="14" r="11"
          fill={isDark ? '#1a4a15' : isRain ? '#1e5a18' : c.main}
          stroke={isDark ? '#0a3a0a' : C.treeShade}
          strokeWidth="1.5"
          style={{ transition: 'fill 2000ms' }}
        />
        <circle cx="10" cy="10" r="6"
          fill={isDark ? '#154a10' : isRain ? '#1a5015' : c.light}
          opacity="0.5"
          style={{ transition: 'fill 2000ms' }}
        />
        <circle cx="14" cy="14" r="4" fill={c.shade} opacity="0.3" />
        {/* Snow cap */}
        {isSnow && (
          <ellipse cx="12" cy="10" rx="7" ry="4" fill="rgba(240,245,250,0.6)" />
        )}
        {/* Wet shine */}
        {isRain && (
          <ellipse cx="10" cy="10" rx="4" ry="2.5" fill="rgba(150,180,210,0.2)" />
        )}
      </svg>
    </div>
  )
}

// ================================================================
// TOP-DOWN CHICKEN
// ================================================================
function TopDownChicken({ x, y, delay, tick, sheltered }: { x: string; y: string; delay: number; tick: number; sheltered?: boolean }) {
  const angle = sheltered ? 0 : (tick * 0.8 + delay * 90) % 360
  const dx = Math.cos(angle * Math.PI / 180) * (sheltered ? 0.05 : 0.3)
  const dy = Math.sin(angle * Math.PI / 180) * (sheltered ? 0.05 : 0.2)

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
        {/* Shelter indicator (small "under roof" dot) */}
        {sheltered && (
          <circle cx="6" cy="9" r="0.8" fill="rgba(150,180,210,0.6)" />
        )}
      </svg>
    </div>
  )
}

// ================================================================
// WEATHER HUD ICON (tiny inline icon)
// ================================================================
function WeatherHudIcon({ weatherType }: { weatherType: WeatherType }) {
  switch (weatherType) {
    case 'clear':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="8" cy="8" r="4" fill="#f0c030" />
          {[0, 60, 120, 180, 240, 300].map(a => (
            <line key={a} x1={8 + 5 * Math.cos(a * Math.PI / 180)} y1={8 + 5 * Math.sin(a * Math.PI / 180)}
              x2={8 + 7 * Math.cos(a * Math.PI / 180)} y2={8 + 7 * Math.sin(a * Math.PI / 180)}
              stroke="#f0c030" strokeWidth="1" strokeLinecap="round" />
          ))}
        </svg>
      )
    case 'partly-cloudy':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <circle cx="6" cy="6" r="3" fill="#f0c030" />
          <ellipse cx="10" cy="10" rx="5" ry="3" fill="#c8d0d8" />
          <ellipse cx="8" cy="9" rx="3" ry="2" fill="#d8e0e8" />
        </svg>
      )
    case 'cloudy':
    case 'fog':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <ellipse cx="8" cy="8" rx="6" ry="3" fill="#a0a8b0" />
          <ellipse cx="6" cy="6" rx="3" ry="2" fill="#b0b8c0" />
          {weatherType === 'fog' && (
            <line x1="2" y1="12" x2="14" y2="12" stroke="#c0c8d0" strokeWidth="1" opacity="0.6" />
          )}
        </svg>
      )
    case 'rain-light':
    case 'rain-moderate':
    case 'rain-heavy':
    case 'showers':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <ellipse cx="8" cy="6" rx="5" ry="3" fill="#8090a0" />
          <ellipse cx="6" cy="5" rx="3" ry="2" fill="#90a0b0" />
          <line x1="5" y1="10" x2="4" y2="13" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="10" x2="7" y2="14" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
          <line x1="11" y1="10" x2="10" y2="13" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case 'thunderstorm':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <ellipse cx="8" cy="5" rx="5" ry="3" fill="#606878" />
          <polygon points="7,8 5,12 7,12 6,15 10,11 8,11 9,8" fill="#f0d050" />
        </svg>
      )
    case 'snow':
      return (
        <svg viewBox="0 0 16 16" width="14" height="14">
          <ellipse cx="8" cy="5" rx="5" ry="3" fill="#a0a8b0" />
          <circle cx="5" cy="11" r="1" fill="white" />
          <circle cx="8" cy="12" r="1" fill="white" />
          <circle cx="11" cy="10" r="1" fill="white" />
        </svg>
      )
    default:
      return null
  }
}

// ================================================================
// WEATHER STATUS DOT
// ================================================================
function WeatherStatusDot({ weatherType }: { weatherType: WeatherType }) {
  const colors: Record<WeatherType, string> = {
    'clear': '#f0c030',
    'partly-cloudy': '#c8d0d8',
    'cloudy': '#a0a8b0',
    'fog': '#c0c8d0',
    'rain-light': '#6090c0',
    'rain-moderate': '#4878a8',
    'rain-heavy': '#305888',
    'thunderstorm': '#f0d050',
    'showers': '#5088b8',
    'snow': '#e0e8f0',
  }
  return (
    <div className="w-2 h-2 rounded-full border border-white/30"
      style={{ backgroundColor: colors[weatherType] }}
    />
  )
}

// ================================================================
// GTA-STYLE TOOLTIP
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
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-600"
        style={{ backgroundColor: phase.accent }}>
        <span className="text-[10px] font-bold text-white font-mono">{shed.name}</span>
        <span className="text-[8px] font-bold text-white/80 bg-black/20 px-1.5 py-0.5 rounded-sm">
          {PHASE_LABELS[shed.phase]}
        </span>
      </div>

      <div className="px-2.5 py-2 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-gray-400 font-mono">AVES</span>
          <span className="text-[10px] font-bold text-white font-mono">{fmtNum(shed.hens)}</span>
        </div>

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

        <div className="border-t border-gray-700" />

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
// FIXED TOOLTIP
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
