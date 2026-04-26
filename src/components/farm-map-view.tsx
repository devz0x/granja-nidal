'use client'

import { useMemo, useState, useEffect, useRef, useCallback } from 'react'

// ================================================================
// TYPES
// ================================================================
type PhaseKey = 'pre_inicio' | 'inicio' | 'crecimiento' | 'pre_postura' | 'postura'

type WeatherType = 'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'rain-light' | 'rain-moderate' | 'rain-heavy' | 'thunderstorm' | 'showers' | 'snow'

type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night'

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
// TIME OF DAY DETECTION (Dominican Republic timezone)
// ================================================================
function getTimeOfDay(): TimeOfDay {
  const now = new Date()
  // Use DR timezone
  const drTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santo_Domingo' }))
  const hour = drTime.getHours()
  if (hour >= 6 && hour < 7) return 'dawn'
  if (hour >= 7 && hour < 17) return 'day'
  if (hour >= 17 && hour < 19) return 'dusk'
  return 'night'
}

function isNightTime(tod: TimeOfDay): boolean {
  return tod === 'night' || tod === 'dusk'
}

function isDayTime(tod: TimeOfDay): boolean {
  return tod === 'day' || tod === 'dawn'
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
  nightSkyGradient: string
  grassColor: string; grassColor2: string; grassColor3: string
  nightGrassColor: string
  overlayOpacity: number; overlayColor: string
  rainDrops: number; cloudCount: number; cloudSpeed: string
  hasLightning: boolean; hasSun: boolean; hasFog: boolean
  snowFlakes: number; puddles: boolean
  windSway: 'none' | 'light' | 'strong'
  chickensHidden: boolean
}> = {
  'clear': {
    skyGradient: 'linear-gradient(180deg, #4a90d9 0%, #7ec8e3 30%, #b8e4f0 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #0a0e2a 0%, #141838 30%, #1e2848 60%, transparent 100%)',
    grassColor: '#3d8b37', grassColor2: '#2d7a27', grassColor3: '#4d9b47', nightGrassColor: '#1a3a18',
    overlayOpacity: 0, overlayColor: 'transparent',
    rainDrops: 0, cloudCount: 0, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: true, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'partly-cloudy': {
    skyGradient: 'linear-gradient(180deg, #6a9fd8 0%, #8eb8d8 30%, #b8d0e8 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #0c1028 0%, #161a38 30%, #202a48 60%, transparent 100%)',
    grassColor: '#3d8b37', grassColor2: '#2d7a27', grassColor3: '#4d9b47', nightGrassColor: '#1a3a18',
    overlayOpacity: 0, overlayColor: 'transparent',
    rainDrops: 0, cloudCount: 3, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'cloudy': {
    skyGradient: 'linear-gradient(180deg, #787878 0%, #909090 30%, #a0a0a0 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #0e1220 0%, #1a1e30 30%, #242838 60%, transparent 100%)',
    grassColor: '#358030', grassColor2: '#2a6a25', grassColor3: '#458840', nightGrassColor: '#183518',
    overlayOpacity: 0.12, overlayColor: '#555',
    rainDrops: 0, cloudCount: 6, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: false, windSway: 'light', chickensHidden: false,
  },
  'fog': {
    skyGradient: 'linear-gradient(180deg, #b0b0b0 0%, #c8c8c8 40%, #d8d8d8 70%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #101018 0%, #181820 40%, #202028 70%, transparent 100%)',
    grassColor: '#3a8535', grassColor2: '#2a7525', grassColor3: '#4a9045', nightGrassColor: '#1a3518',
    overlayOpacity: 0.25, overlayColor: '#c8c8c8',
    rainDrops: 0, cloudCount: 2, cloudSpeed: 'cloud-drift-slow',
    hasLightning: false, hasSun: false, hasFog: true, snowFlakes: 0,
    puddles: false, windSway: 'none', chickensHidden: false,
  },
  'rain-light': {
    skyGradient: 'linear-gradient(180deg, #5a6a78 0%, #6a7a88 30%, #8090a0 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #080c18 0%, #101420 30%, #181e28 60%, transparent 100%)',
    grassColor: '#2d7528', grassColor2: '#226a1e', grassColor3: '#3a8235', nightGrassColor: '#153015',
    overlayOpacity: 0.15, overlayColor: '#4a5a68',
    rainDrops: 30, cloudCount: 4, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: false,
  },
  'rain-moderate': {
    skyGradient: 'linear-gradient(180deg, #4a5a68 0%, #5a6a78 30%, #6a7a88 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #060a14 0%, #0e1218 30%, #161a22 60%, transparent 100%)',
    grassColor: '#256a20', grassColor2: '#1a5a18', grassColor3: '#307028', nightGrassColor: '#122a10',
    overlayOpacity: 0.22, overlayColor: '#3a4a58',
    rainDrops: 60, cloudCount: 5, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: true,
  },
  'rain-heavy': {
    skyGradient: 'linear-gradient(180deg, #3a4a58 0%, #4a5a68 30%, #5a6a78 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #050810 0%, #0a0e16 30%, #12161e 60%, transparent 100%)',
    grassColor: '#1e5a18', grassColor2: '#154a12', grassColor3: '#286020', nightGrassColor: '#0e250e',
    overlayOpacity: 0.32, overlayColor: '#2a3a48',
    rainDrops: 100, cloudCount: 6, cloudSpeed: 'cloud-drift-fast',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'strong', chickensHidden: true,
  },
  'thunderstorm': {
    skyGradient: 'linear-gradient(180deg, #2a2a3a 0%, #3a3a4a 30%, #4a4a5a 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #04060c 0%, #080a12 30%, #0e1018 60%, transparent 100%)',
    grassColor: '#1a4a15', grassColor2: '#103a0e', grassColor3: '#205018', nightGrassColor: '#0c200c',
    overlayOpacity: 0.38, overlayColor: '#1a1a2a',
    rainDrops: 120, cloudCount: 7, cloudSpeed: 'cloud-drift-fast',
    hasLightning: true, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'strong', chickensHidden: true,
  },
  'showers': {
    skyGradient: 'linear-gradient(180deg, #5a7080 0%, #6a8090 30%, #8098a8 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #080c16 0%, #10141e 30%, #181c26 60%, transparent 100%)',
    grassColor: '#2a7025', grassColor2: '#206a1c', grassColor3: '#358030', nightGrassColor: '#142e12',
    overlayOpacity: 0.12, overlayColor: '#4a6070',
    rainDrops: 40, cloudCount: 4, cloudSpeed: 'cloud-drift-medium',
    hasLightning: false, hasSun: false, hasFog: false, snowFlakes: 0,
    puddles: true, windSway: 'light', chickensHidden: false,
  },
  'snow': {
    skyGradient: 'linear-gradient(180deg, #8a9098 0%, #a0a8b0 30%, #b8c0c8 60%, transparent 100%)',
    nightSkyGradient: 'linear-gradient(180deg, #0a0e18 0%, #141828 30%, #1e2230 60%, transparent 100%)',
    grassColor: '#5a7a58', grassColor2: '#4a6a48', grassColor3: '#6a8a68', nightGrassColor: '#2a382a',
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
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('day')
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(iv)
  }, [])

  // Detect time of day - update every minute
  useEffect(() => {
    setTimeOfDay(getTimeOfDay())
    const iv = setInterval(() => setTimeOfDay(getTimeOfDay()), 60000)
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
        // Silently fail
      }
    }
    fetchWeather()
    const iv = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  const weatherType = useMemo<WeatherType>(() => {
    if (!weather) return 'partly-cloudy'
    return classifyWeather(weather.current.condition)
  }, [weather])

  const scene = WEATHER_SCENE[weatherType]
  const isNight = isNightTime(timeOfDay)
  const isDay = isDayTime(timeOfDay)
  const isDusk = timeOfDay === 'dusk'
  const isDawn = timeOfDay === 'dawn'

  // Pick sky/ground based on time of day
  const currentSky = isNight ? scene.nightSkyGradient : scene.skyGradient
  const currentGrass = isNight ? scene.nightGrassColor : scene.grassColor
  const currentGrass2 = isNight ? adjustColor(scene.grassColor2, -40) : scene.grassColor2
  const currentGrass3 = isNight ? adjustColor(scene.grassColor3, -40) : scene.grassColor3

  // Night overlay opacity (dusk = partial, night = full)
  const nightOverlayOpacity = isDusk ? 0.3 : isNight ? 0.45 : 0

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

  const { cols, rows, shedW, shedH } = useMemo(() => {
    const n = batches.length
    let c: number, r: number
    if (n <= 2) { c = 2; r = 1 }
    else if (n <= 4) { c = 2; r = 2 }
    else if (n <= 6) { c = 3; r = 2 }
    else if (n <= 9) { c = 3; r = 3 }
    else if (n <= 12) { c = 4; r = 3 }
    else { c = 4; r = Math.ceil(n / 4) }
    const areaW = 65, areaH = 55, gap = 4
    const w = Math.min(28, (areaW - gap * (c + 1)) / c)
    const h = Math.min(22, (areaH - gap * (r + 1)) / r)
    return { cols: c, rows: r, shedW: w, shedH: h }
  }, [batches.length])

  const shedPositions = useMemo(() => {
    const positions: { x: number; y: number }[] = []
    const startX = (100 - (cols * shedW + (cols - 1) * 4)) / 2
    const startY = 28
    for (let i = 0; i < batches.length; i++) {
      const c = i % cols
      const r = Math.floor(i / cols)
      positions.push({ x: startX + c * (shedW + 4), y: startY + r * (shedH + 4) })
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
    setTooltipPos({ x: px, y: py, side: px > 50 ? 'left' : 'right' })
  }, [])

  const activeShed = shedData.find(s => s.id === hoveredShed)

  // Particles
  const rainDrops = useMemo(() => {
    if (scene.rainDrops === 0) return []
    return Array.from({ length: scene.rainDrops }, (_, i) => ({
      id: i, left: seededRandom(i * 3.7) * 100,
      delay: seededRandom(i * 7.3 + 100) * 2,
      duration: 0.6 + seededRandom(i * 2.1) * 0.5,
      width: weatherType === 'rain-heavy' || weatherType === 'thunderstorm' ? 1.5 : 1,
      height: 12 + seededRandom(i * 5.3) * 8,
      opacity: 0.3 + seededRandom(i * 9.1) * 0.4,
    }))
  }, [scene.rainDrops, weatherType])

  const clouds = useMemo(() => {
    if (scene.cloudCount === 0) return []
    return Array.from({ length: scene.cloudCount }, (_, i) => ({
      id: i, top: 2 + seededRandom(i * 4.3 + 50) * 18,
      width: 18 + seededRandom(i * 6.1 + 80) * 22,
      height: 8 + seededRandom(i * 2.9 + 60) * 10,
      delay: seededRandom(i * 8.7 + 30) * 15,
      duration: 25 + seededRandom(i * 3.3 + 40) * 20,
      opacity: weatherType === 'thunderstorm' ? 0.85 : 0.55 + seededRandom(i * 5.1) * 0.25,
      dark: weatherType === 'thunderstorm' || weatherType === 'rain-heavy',
    }))
  }, [scene.cloudCount, weatherType])

  const snowFlakes = useMemo(() => {
    if (scene.snowFlakes === 0) return []
    return Array.from({ length: scene.snowFlakes }, (_, i) => ({
      id: i, left: seededRandom(i * 3.1 + 200) * 100,
      delay: seededRandom(i * 7.9 + 300) * 6,
      duration: 4 + seededRandom(i * 2.3) * 4,
      size: 2 + seededRandom(i * 4.7 + 400) * 3,
      opacity: 0.4 + seededRandom(i * 6.3 + 500) * 0.5,
    }))
  }, [scene.snowFlakes])

  const puddles = useMemo(() => {
    if (!scene.puddles) return []
    return Array.from({ length: 6 }, (_, i) => ({
      id: i, x: 10 + seededRandom(i * 11.3 + 700) * 80,
      y: 30 + seededRandom(i * 7.7 + 800) * 55,
      rx: 2 + seededRandom(i * 3.1 + 900) * 3,
      ry: 1 + seededRandom(i * 5.9 + 1000) * 1.5,
      delay: seededRandom(i * 9.3 + 1100) * 2,
    }))
  }, [scene.puddles])

  // Stars (only at night, deterministic)
  const stars = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      cx: seededRandom(i * 5.7 + 2000) * 100,
      cy: seededRandom(i * 3.3 + 3000) * 35,
      size: 0.5 + seededRandom(i * 8.1 + 4000) * 1.5,
      anim: (['star-twinkle', 'star-twinkle-2', 'star-twinkle-3'] as const)[i % 3],
      delay: seededRandom(i * 6.9 + 5000) * 5,
      duration: 2 + seededRandom(i * 4.3 + 6000) * 4,
    }))
  }, [])

  // Fireflies (night only)
  const fireflies = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 8 + seededRandom(i * 7.1 + 8000) * 84,
      y: 40 + seededRandom(i * 3.9 + 9000) * 50,
      anim: (['firefly', 'firefly-2'] as const)[i % 2],
      delay: seededRandom(i * 5.3 + 10000) * 8,
      duration: 4 + seededRandom(i * 2.7 + 11000) * 4,
    }))
  }, [])

  const isRain = weatherType === 'rain-light' || weatherType === 'rain-moderate' || weatherType === 'rain-heavy' || weatherType === 'thunderstorm' || weatherType === 'showers'
  const showDayBirds = isDay && !isRain && !isDusk
  const showOwl = isNight

  // Time label
  const timeLabel = isDawn ? 'AMANECER' : isDay ? 'DIA' : isDusk ? 'ATARDECER' : 'NOCHE'

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
          <div className="flex items-center gap-1 mr-2">
            <WeatherHudIcon weatherType={weatherType} />
            <span className="text-[8px] text-gray-400 font-mono">
              {weather?.current.temp ? `${weather.current.temp}°C` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1 mr-2">
            <TimeOfDayIcon timeOfDay={timeOfDay} />
            <span className="text-[8px] font-mono" style={{
              color: isNight ? '#8888cc' : isDusk ? '#cc8855' : isDawn ? '#ddaa66' : '#cccc66'
            }}>{timeLabel}</span>
          </div>
          <span className="text-[8px] font-bold text-gray-300 font-mono">POSTURA</span>
          <span className="text-sm font-bold text-yellow-400 font-mono">{calculations.layingBatches}<span className="text-gray-500 text-[10px]">/{batches.length}</span></span>
        </div>
      </div>

      {/* ========= TOP-DOWN MAP ========= */}
      <div className="relative">
      <div ref={mapRef}
        className="relative w-full border-[3px] border-gray-800 rounded-sm overflow-visible select-none"
        style={{ aspectRatio: '16 / 9' }}
      >
        {/* === SKY GRADIENT (weather + day/night) === */}
        <div className="absolute inset-0 z-[0] transition-all duration-[2000ms]"
          style={{ background: currentSky }} />

        {/* Base grass */}
        <div className="absolute inset-0 transition-all duration-[2000ms]"
          style={{ background: currentGrass }} />

        {/* Grass texture */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none">
          {[
            [10,15,25,12], [45,8,30,15], [80,12,20,10], [120,18,18,8],
            [5,50,22,14], [55,55,28,12], [95,48,24,18], [130,52,20,14],
            [15,75,30,10], [70,78,25,8], [115,74,20,12],
          ].map(([x,y,w,h], i) => (
            <rect key={i} x={x} y={y} width={w} height={h}
              fill={i % 2 === 0 ? currentGrass2 : currentGrass3}
              opacity="0.6" rx="1" style={{ transition: 'fill 2000ms' }} />
          ))}
        </svg>

        {/* === NIGHT OVERLAY === */}
        {nightOverlayOpacity > 0 && (
          <div className="absolute inset-0 z-[1] pointer-events-none"
            style={{
              backgroundColor: '#0a0a1a',
              opacity: nightOverlayOpacity,
              transition: 'opacity 3000ms',
              animation: 'night-fade 3s ease-out',
            }} />
        )}

        {/* === WEATHER OVERLAY === */}
        {scene.overlayOpacity > 0 && !isNight && (
          <div className="absolute inset-0 z-[1] pointer-events-none"
            style={{ backgroundColor: scene.overlayColor, opacity: scene.overlayOpacity, transition: 'all 2000ms' }} />
        )}

        {/* === STARS (night only) === */}
        {showOwl && (
          <svg className="absolute inset-0 w-full h-full z-[1] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {stars.map(s => (
              <circle key={s.id} cx={s.cx} cy={s.cy} r={s.size / 10} fill="white"
                style={{
                  animation: `${s.anim} ${s.duration}s ease-in-out infinite`,
                  animationDelay: `-${s.delay}s`,
                }} />
            ))}
          </svg>
        )}

        {/* === MOON (night only) === */}
        {showOwl && (
          <div className="absolute z-[1] pointer-events-none"
            style={{ top: '3%', right: '8%', width: '8%', aspectRatio: '1' }}>
            <svg viewBox="0 0 60 60" width="100%" height="100%"
              style={{ animation: 'moon-glow 6s ease-in-out infinite' }}>
              {/* Moon body */}
              <circle cx="30" cy="30" r="20" fill="#e8e4d8" />
              <circle cx="30" cy="30" r="20" fill="url(#moonGrad)" />
              {/* Crescent shadow */}
              <circle cx="38" cy="26" r="16" fill={scene.nightSkyGradient.includes('#0a0e2a') ? '#0a0e2a' : '#080c18'} />
              {/* Craters */}
              <circle cx="22" cy="28" r="3" fill="rgba(200,195,180,0.4)" />
              <circle cx="28" cy="38" r="2" fill="rgba(200,195,180,0.3)" />
              <circle cx="18" cy="35" r="1.5" fill="rgba(200,195,180,0.35)" />
              <defs>
                <radialGradient id="moonGrad" cx="40%" cy="40%">
                  <stop offset="0%" stopColor="#f0ece0" />
                  <stop offset="100%" stopColor="#d8d4c8" />
                </radialGradient>
              </defs>
            </svg>
          </div>
        )}

        {/* === SUN GLOW (clear weather, day only) === */}
        {scene.hasSun && isDay && (
          <div className="absolute z-[1] pointer-events-none" style={{ top: '-5%', right: '5%', width: '40%', aspectRatio: '1' }}>
            <div className="absolute inset-0 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(255,220,100,0.4) 0%, rgba(255,200,50,0.15) 40%, transparent 70%)',
                animation: 'sun-pulse 4s ease-in-out infinite',
              }} />
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              <g style={{ transformOrigin: '50% 50%', animation: 'sun-ray-rotate 20s linear infinite' }}>
                {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
                  <line key={angle}
                    x1="50" y1="50" x2={50 + 30 * Math.cos(angle * Math.PI / 180)} y2={50 + 30 * Math.sin(angle * Math.PI / 180)}
                    stroke="rgba(255,220,100,0.15)" strokeWidth="2" />
                ))}
              </g>
              <circle cx="50" cy="50" r="8" fill="rgba(255,220,100,0.5)" />
              <circle cx="50" cy="50" r="5" fill="rgba(255,235,150,0.6)" />
            </svg>
          </div>
        )}

        {/* === CLOUDS === */}
        {clouds.map(cloud => (
          <div key={cloud.id} className="absolute z-[2] pointer-events-none"
            style={{
              top: `${cloud.top}%`, width: `${cloud.width}%`, height: `${cloud.height}%`,
              animation: `${scene.cloudSpeed} ${cloud.duration}s linear infinite`,
              animationDelay: `-${cloud.delay}s`,
              opacity: isNight ? cloud.opacity * 0.4 : cloud.opacity,
            }}>
            <svg viewBox="0 0 120 50" width="100%" height="100%" preserveAspectRatio="none">
              <ellipse cx="35" cy="35" rx="30" ry="14" fill={isNight ? '#1a1a2a' : cloud.dark ? '#4a4a5a' : '#e0e4e8'} />
              <ellipse cx="60" cy="28" rx="28" ry="18" fill={isNight ? '#151520' : cloud.dark ? '#3a3a4a' : '#d0d4d8'} />
              <ellipse cx="85" cy="33" rx="25" ry="13" fill={isNight ? '#151520' : cloud.dark ? '#3a3a4a' : '#d8dce0'} />
              <ellipse cx="50" cy="22" rx="22" ry="15" fill={isNight ? '#1e1e2e' : cloud.dark ? '#505060' : '#e8ecf0'} />
              <ellipse cx="72" cy="24" rx="18" ry="12" fill={isNight ? '#1a1a28' : cloud.dark ? '#484858' : '#e4e8ec'} />
              <ellipse cx="55" cy="38" rx="35" ry="8" fill={isNight ? '#222232' : cloud.dark ? '#555568' : '#f0f2f4'} opacity="0.5" />
            </svg>
          </div>
        ))}

        {/* === RAIN PARTICLES === */}
        {rainDrops.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {rainDrops.map(drop => (
              <line key={drop.id} x1={drop.left} y1="0" x2={drop.left - 0.5} y2={drop.height / 10}
                stroke={isNight ? 'rgba(120,140,170,0.5)' : 'rgba(180,200,220,0.6)'}
                strokeWidth={drop.width / 10} strokeLinecap="round"
                style={{
                  animation: `${weatherType === 'rain-heavy' || weatherType === 'thunderstorm' ? 'rain-fall-heavy' : 'rain-fall'} ${drop.duration}s linear infinite`,
                  animationDelay: `-${drop.delay}s`, opacity: drop.opacity,
                }} />
            ))}
          </svg>
        )}

        {/* === SNOW PARTICLES === */}
        {snowFlakes.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[15] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {snowFlakes.map(flake => (
              <circle key={flake.id} cx={flake.left} cy="0" r={flake.size / 10} fill="white"
                style={{ animation: `snow-fall ${flake.duration}s linear infinite`, animationDelay: `-${flake.delay}s`, opacity: flake.opacity }} />
            ))}
          </svg>
        )}

        {/* === LIGHTNING FLASHES === */}
        {scene.hasLightning && (
          <>
            <div className="absolute inset-0 z-[16] pointer-events-none"
              style={{ background: 'rgba(255,255,240,0.8)', animation: 'lightning-flash 7s ease-in-out infinite' }} />
            <div className="absolute inset-0 z-[16] pointer-events-none"
              style={{ background: 'rgba(255,255,240,0.7)', animation: 'lightning-flash-delayed 9s ease-in-out infinite' }} />
            <svg className="absolute z-[14] pointer-events-none" style={{ top: '2%', left: '35%', width: '6%', height: '40%' }} viewBox="0 0 30 100">
              <polygon points="18,0 8,35 16,35 6,70 14,70 4,100 22,55 14,55 24,25 16,25"
                fill="rgba(255,255,220,0.9)" style={{ animation: 'lightning-flash 5s ease-in-out infinite' }} />
            </svg>
          </>
        )}

        {/* === FOG === */}
        {scene.hasFog && (
          <>
            <div className="absolute z-[14] pointer-events-none"
              style={{ top: '15%', left: '-10%', width: '120%', height: '50%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(200,200,200,0.5) 20%, rgba(210,210,210,0.6) 50%, rgba(200,200,200,0.5) 80%, transparent 100%)',
                animation: 'fog-drift 12s ease-in-out infinite' }} />
            <div className="absolute z-[14] pointer-events-none"
              style={{ top: '40%', left: '-5%', width: '110%', height: '35%',
                background: 'linear-gradient(90deg, transparent 0%, rgba(190,190,190,0.4) 30%, rgba(200,200,200,0.5) 60%, transparent 100%)',
                animation: 'fog-drift 16s ease-in-out infinite reverse' }} />
          </>
        )}

        {/* === PUDDLES === */}
        {puddles.length > 0 && (
          <svg className="absolute inset-0 w-full h-full z-[5] pointer-events-none" viewBox="0 0 160 90" preserveAspectRatio="none">
            {puddles.map(p => (
              <ellipse key={p.id} cx={p.x} cy={p.y} rx={p.rx} ry={p.ry}
                fill="rgba(100,130,170,0.35)" stroke="rgba(80,110,150,0.2)" strokeWidth="0.3"
                style={{ animation: `puddle-shimmer ${2 + p.delay}s ease-in-out infinite`, animationDelay: `-${p.delay}s` }} />
            ))}
          </svg>
        )}

        {/* === PERIMETER FENCE === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[2]" viewBox="0 0 160 90" preserveAspectRatio="none">
          <rect x="3" y="3" width="154" height="84" fill="none" stroke={isNight ? '#3a3a3a' : C.fence} strokeWidth="1.2" rx="1" />
          <rect x="4" y="4" width="152" height="82" fill="none" stroke={isNight ? '#2a2a2a' : C.fencePost} strokeWidth="0.4" strokeDasharray="0.8 1.5" />
          {[{x:3,y:3},{x:157,y:3},{x:3,y:87},{x:157,y:87},
            {x:40,y:3},{x:80,y:3},{x:120,y:3},
            {x:3,y:30},{x:3,y:58},{x:157,y:30},{x:157,y:58},
            {x:40,y:87},{x:80,y:87},{x:120,y:87},
          ].map((p,i) => (
            <rect key={i} x={p.x - 1} y={p.y - 1} width="2.5" height="2.5" fill={isNight ? '#2a2a2a' : C.fencePost} rx="0.3" />
          ))}
        </svg>

        {/* === MAIN ROAD === */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-[1]" viewBox="0 0 160 90" preserveAspectRatio="none">
          <rect x="4" y="22" width="152" height="5" fill={isNight ? '#2a2a2a' : C.asphalt} rx="0.5" />
          <line x1="4" y1="22" x2="156" y2="22" stroke={isNight ? '#3a3a3a' : C.sidewalk} strokeWidth="0.6" />
          <line x1="4" y1="27" x2="156" y2="27" stroke={isNight ? '#3a3a3a' : C.sidewalk} strokeWidth="0.6" />
          {[8, 22, 36, 50, 64, 78, 92, 106, 120, 134, 148].map(x => (
            <rect key={x} x={x} y="24" width="4" height="1" fill={isNight ? '#4a4a1a' : C.roadLine} rx="0.3" />
          ))}
          {shedPositions.length > 0 && (() => {
            const uniqueRows = [...new Set(shedPositions.map((_, i) => Math.floor(i / cols)))]
            return uniqueRows.map(r => {
              const firstInRow = shedPositions[r * cols]
              const midX = firstInRow ? firstInRow.x + shedW / 2 : 50
              return (
                <g key={r}>
                  <rect x={midX - 1.5} y="27" width="3" height={firstInRow ? firstInRow.y - 27 - 1 : 5}
                    fill={isNight ? '#2a2a2a' : C.asphalt} />
                  <rect x={midX - 1.2} y="27" width="2.4" height={firstInRow ? firstInRow.y - 27 - 1 : 5}
                    fill={isNight ? '#222' : C.road} opacity="0.5" />
                </g>
              )
            })
          })()}
          {isRain && <rect x="4" y="22" width="152" height="5" fill="rgba(150,180,210,0.2)" rx="0.5" />}
        </svg>

        {/* === ENTRANCE GATE === */}
        <div className="absolute z-[3]" style={{ left: '46%', bottom: '2%', width: '8%', height: '5%' }}>
          <svg viewBox="0 0 40 16" width="100%" height="100%">
            <rect x="0" y="0" width="18" height="16" fill={isNight ? '#3a3a3a' : C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="2" y="2" width="14" height="12" fill={isNight ? '#2a2a2a' : C.fencePost} />
            <rect x="22" y="0" width="18" height="16" fill={isNight ? '#3a3a3a' : C.fence} stroke={C.black} strokeWidth="1" />
            <rect x="24" y="2" width="14" height="12" fill={isNight ? '#2a2a2a' : C.fencePost} />
            <rect x="18" y="4" width="4" height="8" fill={currentGrass} />
          </svg>
        </div>

        {/* === SILO === */}
        <div className="absolute z-[3]" style={{ left: '6%', top: '6%', width: '6%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={isNight ? '#4a4a4a' : C.silo} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="14" fill={isNight ? '#555' : '#999'} />
            <circle cx="16" cy="16" r="8" fill={isNight ? '#666' : '#aaa'} opacity="0.6" />
            <circle cx="20" cy="20" r="10" fill="#c8b832" opacity="0.4" />
            <circle cx="20" cy="20" r="3" fill={C.black} opacity="0.3" />
            {isRain && <ellipse cx="14" cy="14" rx="6" ry="4" fill="rgba(150,180,210,0.3)" />}
          </svg>
          <p className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[6px] font-bold text-white/80 font-mono whitespace-nowrap"
            style={{ textShadow: '1px 1px 1px black' }}>SILO</p>
        </div>

        {/* === WATER TANK === */}
        <div className="absolute z-[3]" style={{ left: '88%', top: '6%', width: '5%', aspectRatio: '1' }}>
          <svg viewBox="0 0 40 40" width="100%" height="100%">
            <circle cx="20" cy="20" r="18" fill={isNight ? '#2a3a4a' : C.water} stroke={C.black} strokeWidth="2" />
            <circle cx="20" cy="20" r="13" fill={isNight ? '#1a2a3a' : '#6898c8'} />
            <ellipse cx="16" cy="16" rx="5" ry="3" fill={isNight ? '#2a3a4a' : '#88b8e8'} opacity="0.6" />
            <circle cx="20" cy="20" r="2" fill={C.black} opacity="0.2" />
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

        {/* === TREES === */}
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
            <TopDownTree x={pos.x} y={pos.y} variant={i % 3} weatherType={weatherType} isNight={isNight} />
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
            background: isRain ? '#2a6a25' : isNight ? '#1a3a18' : C.hedge,
            border: `1.5px solid ${isNight ? '#0e2a0e' : C.treeShade}`,
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
            <div key={shed.id} className="absolute z-10 cursor-default"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${shedW}%`, height: `${shedH}%` }}
              onMouseEnter={(e) => handleHover(shed.id, e)}
              onMouseLeave={() => setHoveredShed(null)}>
              <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-sm"
                style={{ backgroundColor: isNight ? 'rgba(0,0,0,0.45)' : isRain ? 'rgba(0,0,0,0.35)' : C.shadow }} />
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <rect x="2" y="2" width="96" height="96" fill={isNight ? adjustColor(phase.fill, -50) : phase.fill}
                  stroke={C.black} strokeWidth="3" rx="1" />
                <rect x="6" y="6" width="88" height="88" fill={isNight ? adjustColor(phase.roof, -50) : phase.roof}
                  stroke={C.outline} strokeWidth="1" rx="0.5" />
                <rect x="6" y="6" width="88" height="20" fill="white" opacity={isNight ? 0.04 : isRain ? 0.06 : 0.12} rx="0.5" />
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
                {/* Window glow at night */}
                {isNight && (
                  <>
                    <rect x="34" y="42" width="8" height="6" fill="rgba(255,200,100,0.5)" rx="0.3" />
                    <rect x="58" y="42" width="8" height="6" fill="rgba(255,200,100,0.5)" rx="0.3" />
                    <rect x="46" y="42" width="8" height="6" fill="rgba(255,200,100,0.4)" rx="0.3" />
                  </>
                )}
                {isRain && <rect x="2" y="2" width="96" height="96" fill="rgba(150,180,210,0.12)" rx="1" />}
                {isHov && (
                  <rect x="0" y="0" width="100" height="100" fill="white" opacity="0.15" rx="2"
                    stroke="white" strokeWidth="2" strokeOpacity="0.5" />
                )}
              </svg>
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-20"
                style={{ textShadow: '1px 1px 2px black, -1px -1px 2px black, 1px -1px 2px black, -1px 1px 2px black' }}>
                <p className={`text-[8px] font-bold font-mono ${isHov ? 'text-white' : 'text-white/80'}`}>{shed.name}</p>
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-black/50 z-20"
                style={{ backgroundColor: phase.accent }} />
            </div>
          )
        })}

        {/* === FLYING BIRDS (day, no rain) === */}
        {showDayBirds && (
          <>
            <FlyingBird top="5%" duration="18s" delay="0s" reverse={false} size={1} />
            <FlyingBird top="12%" duration="24s" delay="-8s" reverse={true} size={0.8} />
            <FlyingBird top="8%" duration="20s" delay="-14s" reverse={false} size={0.9} />
            <FlyingBird top="15%" duration="28s" delay="-5s" reverse={true} size={0.7} />
            <FlyingBird top="3%" duration="22s" delay="-18s" reverse={false} size={1.1} />
          </>
        )}

        {/* === HOPPING BIRDS (day, on grass) === */}
        {showDayBirds && (
          <>
            <HoppingBird x="22%" y="72%" hopAnim="bird-hop" duration="6s" delay="0s" variant={0} />
            <HoppingBird x="65%" y="78%" hopAnim="bird-hop-2" duration="7s" delay="-3s" variant={1} />
            <HoppingBird x="42%" y="82%" hopAnim="bird-hop-3" duration="5s" delay="-1.5s" variant={2} />
          </>
        )}

        {/* === OWL (night only, perched on tree) === */}
        {showOwl && <NightOwl tick={tick} />}

        {/* === FIREFLIES (night only, no rain) === */}
        {showOwl && !isRain && (
          <svg className="absolute inset-0 w-full h-full z-[12] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            {fireflies.map(f => (
              <circle key={f.id} cx={f.x} cy={f.y} r="0.4" fill="#aaff50"
                style={{
                  animation: `${f.anim} ${f.duration}s ease-in-out infinite`,
                  animationDelay: `-${f.delay}s`,
                }} />
            ))}
          </svg>
        )}

        {/* === WALKING CHICKENS === */}
        {!scene.chickensHidden && (
          <>
            <TopDownChicken x="12%" y="88%" delay={0} tick={tick} isNight={isNight} />
            <TopDownChicken x="75%" y="86%" delay={3} tick={tick} isNight={isNight} />
            <TopDownChicken x="48%" y="18%" delay={1} tick={tick} isNight={isNight} />
          </>
        )}
        {scene.chickensHidden && (
          <>
            <TopDownChicken x="25%" y="42%" delay={0} tick={tick} sheltered isNight={isNight} />
            <TopDownChicken x="60%" y="45%" delay={3} tick={tick} sheltered isNight={isNight} />
            <TopDownChicken x="40%" y="40%" delay={1} tick={tick} sheltered isNight={isNight} />
          </>
        )}

        {/* === FARM SIGN === */}
        <div className="absolute z-[4]" style={{ left: '43%', top: '19.5%', width: '14%', height: '4%' }}>
          <svg viewBox="0 0 100 30" width="100%" height="100%">
            <rect x="0" y="0" width="100" height="30" fill="#c8a848" stroke={C.black} strokeWidth="2" rx="1" />
            <rect x="3" y="3" width="94" height="24" fill="#e8d878" rx="0.5" />
            <text x="50" y="19" textAnchor="middle" fontSize="10" fill={C.black} fontFamily="monospace" fontWeight="bold">GRANJA NIDAL</text>
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

        {/* === STATUS BADGE (bottom-left) === */}
        {weatherLoaded && (
          <div className="absolute z-20 bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-white/15 rounded-full px-2.5 py-1"
            style={{ animation: 'weather-transition 1s ease-out' }}>
            <WeatherStatusDot weatherType={weatherType} />
            <span className="text-[8px] font-bold text-white/80 font-mono">
              {weather?.current.condition || ''}
            </span>
            {weather?.current.temp && (
              <span className="text-[8px] text-white/60 font-mono">{weather.current.temp}°C</span>
            )}
            <span className="text-[8px] text-white/30 font-mono">|</span>
            <TimeOfDayIcon timeOfDay={timeOfDay} small />
          </div>
        )}

      </div>
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
// FLYING BIRD (V-shape crossing the sky)
// ================================================================
function FlyingBird({ top, duration, delay, reverse, size }: {
  top: string; duration: string; delay: string; reverse: boolean; size: number
}) {
  return (
    <div className="absolute z-[8] pointer-events-none"
      style={{
        top,
        left: '-5%',
        width: `${2 * size}%`,
        animation: `${reverse ? 'bird-fly-reverse' : 'bird-fly'} ${duration} linear infinite`,
        animationDelay: delay,
      }}>
      <svg viewBox="0 0 30 20" width="100%" preserveAspectRatio="none">
        {/* Body */}
        <ellipse cx="15" cy="12" rx="4" ry="2" fill="#2a2a2a" />
        {/* Left wing - animated flap */}
        <path d="M11,12 Q6,4 1,6" fill="none" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round"
          style={{ transformOrigin: '11px 12px', animation: 'wing-flap-up 0.4s ease-in-out infinite' }} />
        {/* Right wing - animated flap */}
        <path d="M19,12 Q24,4 29,6" fill="none" stroke="#2a2a2a" strokeWidth="1.8" strokeLinecap="round"
          style={{ transformOrigin: '19px 12px', animation: 'wing-flap-down 0.4s ease-in-out infinite' }} />
        {/* Head */}
        <circle cx="10" cy="11" r="1.8" fill="#2a2a2a" />
        {/* Beak */}
        <polygon points="8,11 6,11.5 8,12" fill="#5a4020" />
        {/* Tail */}
        <polygon points="19,12 23,10 23,14" fill="#2a2a2a" />
      </svg>
    </div>
  )
}

// ================================================================
// HOPPING BIRD (small sparrow on the grass)
// ================================================================
function HoppingBird({ x, y, hopAnim, duration, delay, variant }: {
  x: string; y: string; hopAnim: string; duration: string; delay: string; variant: number
}) {
  const colors = [
    { body: '#5a4030', belly: '#8a7060', head: '#4a3020' },
    { body: '#6a5040', belly: '#9a8070', head: '#5a4030' },
    { body: '#4a3828', belly: '#7a6050', head: '#3a2818' },
  ]
  const c = colors[variant]

  return (
    <div className="absolute z-[7] pointer-events-none"
      style={{ left: x, top: y, width: '1.5%', aspectRatio: '1',
        animation: `${hopAnim} ${duration} ease-in-out infinite`,
        animationDelay: delay,
      }}>
      <svg viewBox="0 0 16 16" width="100%" height="100%">
        {/* Body */}
        <ellipse cx="8" cy="10" rx="4" ry="3.5" fill={c.body} />
        {/* Belly */}
        <ellipse cx="8" cy="11.5" rx="2.5" ry="1.5" fill={c.belly} />
        {/* Head */}
        <circle cx="8" cy="5.5" r="3" fill={c.head} />
        {/* Eye */}
        <circle cx="7" cy="5" r="0.8" fill="white" />
        <circle cx="6.8" cy="5" r="0.4" fill="black" />
        {/* Beak */}
        <polygon points="5,5.5 3,6 5,6.5" fill="#c89030" />
        {/* Tail */}
        <polygon points="12,10 15,8 15,12" fill={c.body} />
        {/* Legs (thin lines) */}
        <line x1="7" y1="13" x2="6.5" y2="15.5" stroke="#5a4020" strokeWidth="0.5" />
        <line x1="9" y1="13" x2="9.5" y2="15.5" stroke="#5a4020" strokeWidth="0.5" />
        {/* Wing mark */}
        <ellipse cx="10" cy="9.5" rx="2" ry="1.5" fill={c.head} opacity="0.5" />
      </svg>
    </div>
  )
}

// ================================================================
// NIGHT OWL (perched on the top-right tree)
// ================================================================
function NightOwl({ tick }: { tick: number }) {
  const headAngle = (tick % 30 < 15) ? 0 : 8

  return (
    <div className="absolute z-[9] pointer-events-none"
      style={{ left: '80%', top: '6%', width: '3.5%', aspectRatio: '1' }}>
      <svg viewBox="0 0 40 50" width="100%" height="100%">
        {/* Body */}
        <ellipse cx="20" cy="32" rx="10" ry="14" fill="#5a4a3a" />
        {/* Belly pattern */}
        <ellipse cx="20" cy="35" rx="7" ry="9" fill="#7a6a5a" />
        {/* Belly stripes */}
        {[28, 31, 34, 37].map(y => (
          <line key={y} x1="14" y1={y} x2="26" y2={y} stroke="#5a4a3a" strokeWidth="0.5" opacity="0.5" />
        ))}
        {/* Head (animated turn) */}
        <g style={{ transformOrigin: '20px 20px', animation: 'owl-head-turn 8s ease-in-out infinite' }}>
          <circle cx="20" cy="18" r="8" fill="#6a5a4a" />
          {/* Ear tufts */}
          <polygon points="14,12 12,4 17,10" fill="#5a4a3a" />
          <polygon points="26,12 28,4 23,10" fill="#5a4a3a" />
          {/* Facial disc */}
          <ellipse cx="20" cy="19" rx="6" ry="5.5" fill="#8a7a6a" />
          {/* Eye sockets */}
          <circle cx="17" cy="17" r="3.5" fill="#3a2a1a" />
          <circle cx="23" cy="17" r="3.5" fill="#3a2a1a" />
          {/* Glowing eyes */}
          <g style={{ animation: 'owl-eye-glow 3s ease-in-out infinite' }}>
            <circle cx="17" cy="17" r="2.5" fill="#ffcc32" />
            <circle cx="23" cy="17" r="2.5" fill="#ffcc32" />
          </g>
          {/* Pupils */}
          <g style={{ transformOrigin: '17px 17px', animation: 'owl-eye-blink 6s ease-in-out infinite' }}>
            <circle cx="17" cy="17" r="1.2" fill="#1a1a0a" />
          </g>
          <g style={{ transformOrigin: '23px 23px', animation: 'owl-eye-blink 6s ease-in-out infinite' }}>
            <circle cx="23" cy="17" r="1.2" fill="#1a1a0a" />
          </g>
          {/* Beak */}
          <polygon points="19,20 20,23 21,20" fill="#c89030" />
        </g>
        {/* Wings folded */}
        <path d="M10,28 Q8,35 11,42" fill="#4a3a2a" stroke="#3a2a1a" strokeWidth="0.5" />
        <path d="M30,28 Q32,35 29,42" fill="#4a3a2a" stroke="#3a2a1a" strokeWidth="0.5" />
        {/* Talons gripping branch */}
        <g>
          <line x1="16" y1="44" x2="14" y2="48" stroke="#8a7a5a" strokeWidth="1" />
          <line x1="20" y1="45" x2="20" y2="49" stroke="#8a7a5a" strokeWidth="1" />
          <line x1="24" y1="44" x2="26" y2="48" stroke="#8a7a5a" strokeWidth="1" />
          {/* Claw curves */}
          <path d="M14,48 Q12,49 13,48" fill="none" stroke="#8a7a5a" strokeWidth="0.5" />
          <path d="M20,49 Q18,50 19,49" fill="none" stroke="#8a7a5a" strokeWidth="0.5" />
          <path d="M26,48 Q28,49 27,48" fill="none" stroke="#8a7a5a" strokeWidth="0.5" />
        </g>
        {/* Branch */}
        <line x1="6" y1="48" x2="34" y2="48" stroke="#4a3020" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="47" x2="12" y2="49" stroke="#4a3020" strokeWidth="0.5" opacity="0.4" />
      </svg>
    </div>
  )
}

// ================================================================
// TOP-DOWN TREE
// ================================================================
function TopDownTree({ x, y, variant, weatherType, isNight }: {
  x: string; y: string; variant: number; weatherType: WeatherType; isNight: boolean
}) {
  const colors = [
    { main: C.tree1, shade: C.treeShade, light: C.tree2 },
    { main: C.tree2, shade: C.tree1, light: '#4aaa42' },
    { main: '#2a8a22', shade: '#1a6a12', light: '#3aba32' },
  ]
  const c = colors[variant]
  const isRain = weatherType === 'rain-light' || weatherType === 'rain-moderate' || weatherType === 'rain-heavy' || weatherType === 'thunderstorm' || weatherType === 'showers'
  const isSnow = weatherType === 'snow'
  const isDark = weatherType === 'thunderstorm' || weatherType === 'rain-heavy' || isNight

  return (
    <div className="absolute z-[3] pointer-events-none" style={{ left: x, top: y, width: '3.5%', aspectRatio: '1' }}>
      <svg viewBox="0 0 30 30" width="100%" height="100%">
        <ellipse cx="16" cy="16" rx="12" ry="12" fill={isDark ? 'rgba(0,0,0,0.4)' : C.shadow} />
        <circle cx="14" cy="14" r="11"
          fill={isNight ? '#0e2a0e' : isDark && !isNight ? '#1a4a15' : isRain ? '#1e5a18' : c.main}
          stroke={isNight ? '#0a1a0a' : isDark ? '#0a3a0a' : C.treeShade}
          strokeWidth="1.5" style={{ transition: 'fill 2000ms' }} />
        <circle cx="10" cy="10" r="6"
          fill={isNight ? '#122a12' : isDark && !isNight ? '#154a10' : isRain ? '#1a5015' : c.light}
          opacity="0.5" style={{ transition: 'fill 2000ms' }} />
        <circle cx="14" cy="14" r="4" fill={c.shade} opacity="0.3" />
        {isSnow && <ellipse cx="12" cy="10" rx="7" ry="4" fill="rgba(240,245,250,0.6)" />}
        {isRain && <ellipse cx="10" cy="10" rx="4" ry="2.5" fill="rgba(150,180,210,0.2)" />}
      </svg>
    </div>
  )
}

// ================================================================
// TOP-DOWN CHICKEN
// ================================================================
function TopDownChicken({ x, y, delay, tick, sheltered, isNight }: {
  x: string; y: string; delay: number; tick: number; sheltered?: boolean; isNight?: boolean
}) {
  const angle = sheltered ? 0 : (tick * 0.8 + delay * 90) % 360
  const dx = Math.cos(angle * Math.PI / 180) * (sheltered ? 0.05 : 0.3)
  const dy = Math.sin(angle * Math.PI / 180) * (sheltered ? 0.05 : 0.2)
  const bodyFill = isNight ? '#a08a18' : '#e8c820'

  return (
    <div className="absolute z-[6] pointer-events-none"
      style={{ left: x, top: y, width: '1.2%', aspectRatio: '1' }}>
      <svg viewBox="0 0 12 12" width="100%" height="100%"
        style={{ transform: `translate(${dx}%, ${dy}%)` }}>
        <ellipse cx="6" cy="6" rx="4" ry="3.5" fill={bodyFill} stroke={C.black} strokeWidth="1" />
        <circle cx="6" cy="3" r="2.5" fill={bodyFill} stroke={C.black} strokeWidth="0.8" />
        <ellipse cx="6" cy="1" rx="1.5" ry="0.8" fill="#d03030" stroke={C.black} strokeWidth="0.5" />
        {sheltered && <circle cx="6" cy="9" r="0.8" fill="rgba(150,180,210,0.6)" />}
      </svg>
    </div>
  )
}

// ================================================================
// TIME OF DAY ICON (HUD)
// ================================================================
function TimeOfDayIcon({ timeOfDay, small }: { timeOfDay: TimeOfDay; small?: boolean }) {
  const size = small ? 12 : 14
  if (timeOfDay === 'night') {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <circle cx="10" cy="10" r="8" fill="#e8e4d8" />
        <circle cx="13" cy="8" r="6" fill="#0a0e2a" />
      </svg>
    )
  }
  if (timeOfDay === 'dusk') {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <circle cx="10" cy="12" r="6" fill="#e8a040" />
        <line x1="10" y1="2" x2="10" y2="5" stroke="#e8a040" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="2" y1="12" x2="4" y2="12" stroke="#e8a040" strokeWidth="1" strokeLinecap="round" />
        <rect x="3" y="14" width="14" height="3" fill="#cc6633" rx="0.5" opacity="0.5" />
      </svg>
    )
  }
  if (timeOfDay === 'dawn') {
    return (
      <svg viewBox="0 0 20 20" width={size} height={size}>
        <circle cx="10" cy="14" r="5" fill="#f0c030" opacity="0.6" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
          <line key={a} x1={10 + 7 * Math.cos(a * Math.PI / 180)} y1={14 + 7 * Math.sin(a * Math.PI / 180)}
            x2={10 + 9 * Math.cos(a * Math.PI / 180)} y2={14 + 9 * Math.sin(a * Math.PI / 180)}
            stroke="#f0c030" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
        ))}
        <rect x="2" y="2" width="16" height="5" fill="#ffaa66" rx="1" opacity="0.4" />
      </svg>
    )
  }
  // Day
  return (
    <svg viewBox="0 0 20 20" width={size} height={size}>
      <circle cx="10" cy="10" r="5" fill="#f0c030" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <line key={a} x1={10 + 6 * Math.cos(a * Math.PI / 180)} y1={10 + 6 * Math.sin(a * Math.PI / 180)}
          x2={10 + 8.5 * Math.cos(a * Math.PI / 180)} y2={10 + 8.5 * Math.sin(a * Math.PI / 180)}
          stroke="#f0c030" strokeWidth="1" strokeLinecap="round" />
      ))}
    </svg>
  )
}

// ================================================================
// WEATHER HUD ICON
// ================================================================
function WeatherHudIcon({ weatherType }: { weatherType: WeatherType }) {
  switch (weatherType) {
    case 'clear':
      return (
        <svg viewBox="0 0 16 16" width={14} height={14}>
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
        <svg viewBox="0 0 16 16" width={14} height={14}>
          <circle cx="6" cy="6" r="3" fill="#f0c030" />
          <ellipse cx="10" cy="10" rx="5" ry="3" fill="#c8d0d8" />
          <ellipse cx="8" cy="9" rx="3" ry="2" fill="#d8e0e8" />
        </svg>
      )
    case 'cloudy': case 'fog':
      return (
        <svg viewBox="0 0 16 16" width={14} height={14}>
          <ellipse cx="8" cy="8" rx="6" ry="3" fill="#a0a8b0" />
          <ellipse cx="6" cy="6" rx="3" ry="2" fill="#b0b8c0" />
        </svg>
      )
    case 'rain-light': case 'rain-moderate': case 'rain-heavy': case 'showers':
      return (
        <svg viewBox="0 0 16 16" width={14} height={14}>
          <ellipse cx="8" cy="6" rx="5" ry="3" fill="#8090a0" />
          <ellipse cx="6" cy="5" rx="3" ry="2" fill="#90a0b0" />
          <line x1="5" y1="10" x2="4" y2="13" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
          <line x1="8" y1="10" x2="7" y2="14" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
          <line x1="11" y1="10" x2="10" y2="13" stroke="#6090c0" strokeWidth="1" strokeLinecap="round" />
        </svg>
      )
    case 'thunderstorm':
      return (
        <svg viewBox="0 0 16 16" width={14} height={14}>
          <ellipse cx="8" cy="5" rx="5" ry="3" fill="#606878" />
          <polygon points="7,8 5,12 7,12 6,15 10,11 8,11 9,8" fill="#f0d050" />
        </svg>
      )
    case 'snow':
      return (
        <svg viewBox="0 0 16 16" width={14} height={14}>
          <ellipse cx="8" cy="5" rx="5" ry="3" fill="#a0a8b0" />
          <circle cx="5" cy="11" r="1" fill="white" />
          <circle cx="8" cy="12" r="1" fill="white" />
          <circle cx="11" cy="10" r="1" fill="white" />
        </svg>
      )
    default: return null
  }
}

// ================================================================
// WEATHER STATUS DOT
// ================================================================
function WeatherStatusDot({ weatherType }: { weatherType: WeatherType }) {
  const colors: Record<WeatherType, string> = {
    'clear': '#f0c030', 'partly-cloudy': '#c8d0d8', 'cloudy': '#a0a8b0',
    'fog': '#c0c8d0', 'rain-light': '#6090c0', 'rain-moderate': '#4878a8',
    'rain-heavy': '#305888', 'thunderstorm': '#f0d050', 'showers': '#5088b8', 'snow': '#e0e8f0',
  }
  return <div className="w-2 h-2 rounded-full border border-white/30" style={{ backgroundColor: colors[weatherType] }} />
}

// ================================================================
// COLOR UTILITY
// ================================================================
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// ================================================================
// GTA-STYLE TOOLTIP
// ================================================================
function GtaTooltip({ shed }: {
  shed: { id: string; name: string; hens: number; layingRate: number; isLaying: boolean; cycleMonth: number; phase: PhaseKey; eggsPerDay: number; eggRevenue: number; feedCost: number; netBalance: number; weeksLabel: string; progress: number }
}) {
  const phase = PHASE_FILL[shed.phase]
  return (
    <div className="border-2 border-gray-700 rounded-sm overflow-hidden shadow-xl"
      style={{ background: 'linear-gradient(180deg, #2a2a2a 0%, #1a1a1a 100%)' }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-600" style={{ backgroundColor: phase.accent }}>
        <span className="text-[10px] font-bold text-white font-mono">{shed.name}</span>
        <span className="text-[8px] font-bold text-white/80 bg-black/20 px-1.5 py-0.5 rounded-sm">{PHASE_LABELS[shed.phase]}</span>
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
            <div><p className="text-[6px] text-gray-500 font-mono">INGRESO</p><p className="text-[9px] font-bold text-green-400 font-mono">{fmtRD(shed.eggRevenue)}</p></div>
            <div><p className="text-[6px] text-gray-500 font-mono">FEED</p><p className="text-[9px] font-bold text-red-400 font-mono">{fmtRD(shed.feedCost)}</p></div>
            <div><p className="text-[6px] text-gray-500 font-mono">NETO</p><p className={`text-[9px] font-bold font-mono ${shed.netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtRD(shed.netBalance)}</p></div>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[7px] text-gray-500 font-mono">CICLO</span>
            <span className="text-[8px] text-gray-300 font-mono">{shed.cycleMonth}/20</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-sm overflow-hidden">
            <div className="h-full rounded-sm transition-all duration-300"
              style={{ width: `${shed.progress}%`, backgroundColor: shed.isLaying ? phase.fill : '#6898c8' }} />
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
  shed: { id: string; name: string; hens: number; layingRate: number; isLaying: boolean; cycleMonth: number; phase: PhaseKey; eggsPerDay: number; eggRevenue: number; feedCost: number; netBalance: number; weeksLabel: string; progress: number }
}) {
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const mr = map.getBoundingClientRect()
    const shedCenterX = mr.left + (tooltipPos.x / 100) * mr.width
    const shedTop = mr.top + (tooltipPos.y / 100) * mr.height
    const offset = 10, tooltipW = 210
    let left = tooltipPos.side === 'right' ? shedCenterX + offset : shedCenterX - tooltipW - offset
    if (tooltipPos.side === 'right' && left + tooltipW > window.innerWidth - 10) left = shedCenterX - tooltipW - offset
    if (tooltipPos.side === 'left' && left < 10) left = shedCenterX + offset
    let top = shedTop
    if (top + 260 > window.innerHeight - 10) top = window.innerHeight - 270
    if (top < 10) top = 10
    setPos({ top, left })
  }, [mapRef, tooltipPos])
  return (
    <div className="fixed z-[9999] pointer-events-none" style={{ top: pos.top, left: pos.left, width: '210px', maxWidth: '210px' }}>
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
