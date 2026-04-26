'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Cloud, Sun, CloudRain, CloudLightning, Thermometer, Droplets, Wind,
  AlertTriangle, RefreshCw, TrendingUp, TrendingDown, Minus, Eye,
} from 'lucide-react'

// ================================================================
// TYPES
// ================================================================
interface WeatherData {
  location: string
  current: {
    temp: number
    feelsLike: number
    condition: string
    humidity: number
    windSpeed: number
    windDirection: string
  }
  forecast: Array<{
    date: string
    dayOfWeek: string
    tempMax: number
    tempMin: number
    condition: string
    humidity: number
    windSpeed: number
  }>
  production: {
    optimalRange: { min: number; max: number }
    isOptimal: boolean
    impact: 'optimo' | 'negativo' | 'negativo-alto'
    impactPercentage: number
    message: string
  }
  alerts: string[]
  updatedAt: string
  cached?: boolean
  fallback?: boolean
}

interface WeatherWidgetProps {
  avgProduction?: number | null
  fmtNum: (v: number) => string
}

// ================================================================
// WEATHER CONDITION ICONS
// ================================================================
function getWeatherIcon(condition: string) {
  const c = condition.toLowerCase()
  if (c.includes('lluvia') || c.includes('rain')) return <CloudRain className="w-6 h-6" />
  if (c.includes('tron') || c.includes('thunder')) return <CloudLightning className="w-6 h-6" />
  if (c.includes('soleado') || c.includes('sunny') || c.includes('caluroso')) return <Sun className="w-6 h-6" />
  return <Cloud className="w-6 h-6" />
}

function getForecastIcon(condition: string) {
  const c = condition.toLowerCase()
  if (c.includes('lluvia') || c.includes('rain')) return <CloudRain className="w-4 h-4" />
  if (c.includes('tron') || c.includes('thunder')) return <CloudLightning className="w-4 h-4" />
  if (c.includes('soleado') || c.includes('sunny')) return <Sun className="w-4 h-4" />
  return <Cloud className="w-4 h-4" />
}

function getImpactIcon(impact: string) {
  switch (impact) {
    case 'optimo': return <TrendingUp className="w-3.5 h-3.5 text-green-600" />
    case 'negativo': return <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
    case 'negativo-alto': return <TrendingDown className="w-3.5 h-3.5 text-red-600" />
    default: return <Minus className="w-3.5 h-3.5 text-stone-400" />
  }
}

function getImpactBadge(impact: string) {
  switch (impact) {
    case 'optimo': return <Badge className="bg-green-100 text-green-700 text-[10px]">Optimo</Badge>
    case 'negativo': return <Badge className="bg-amber-100 text-amber-700 text-[10px]">Moderado</Badge>
    case 'negativo-alto': return <Badge className="bg-red-100 text-red-700 text-[10px]">Alto riesgo</Badge>
    default: return <Badge variant="outline" className="text-[10px]">Desconocido</Badge>
  }
}

function getTempColor(temp: number, isOptimal: boolean): string {
  if (isOptimal) return 'text-green-700'
  if (temp >= 33) return 'text-red-600'
  if (temp >= 30) return 'text-orange-600'
  if (temp <= 15) return 'text-blue-600'
  return 'text-stone-700'
}

// ================================================================
// WEATHER WIDGET COMPONENT
// ================================================================
export default function WeatherWidget({ avgProduction, fmtNum }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/weather')
      if (res.ok) {
        const data = await res.json()
        setWeather(data)
      } else {
        setError('Error al obtener datos climaticos')
      }
    } catch {
      setError('Sin conexion al servicio climatico')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWeather()
  }, [])

  // Auto-refresh every 30 minutes
  useEffect(() => {
    const interval = setInterval(fetchWeather, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  // Derived calculations
  const tempStatus = useMemo(() => {
    if (!weather) return { color: 'text-stone-700', bg: 'bg-stone-50', label: 'N/A' }
    const { temp } = weather.current
    if (weather.production.isOptimal) return { color: 'text-green-700', bg: 'bg-green-50', label: 'Optimo' }
    if (temp >= 33) return { color: 'text-red-600', bg: 'bg-red-50', label: 'Caluroso' }
    if (temp >= 25) return { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Calido' }
    if (temp <= 12) return { color: 'text-blue-600', bg: 'bg-blue-50', label: 'Frio' }
    return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Aceptable' }
  }, [weather])

  // ================================================================
  // LOADING
  // ================================================================
  if (loading && !weather) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center py-6 text-stone-400">
            <div className="w-5 h-5 border-2 border-stone-300 border-t-sky-500 rounded-full animate-spin mr-2" />
            <span className="text-xs">Cargando clima...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !weather) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center py-4 text-stone-400">
            <Cloud className="w-8 h-8 mx-auto mb-1 opacity-30" />
            <p className="text-xs">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchWeather} className="mt-2 text-xs h-8 gap-1">
              <RefreshCw className="w-3 h-3" /> Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!weather) return null

  return (
    <div className="space-y-3">
      {/* Main Weather Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${tempStatus.bg} flex items-center justify-center`}>
                <Thermometer className={`w-4 h-4 ${tempStatus.color}`} />
              </div>
              <div>
                <CardTitle className="text-sm">Clima Actual</CardTitle>
                <CardDescription className="text-[10px]">{weather.location}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {weather.cached && (
                <Badge variant="outline" className="text-[9px] text-stone-400">Cacheado</Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchWeather}
                className="h-7 w-7 p-0 text-stone-400 hover:text-stone-600 min-w-[44px] min-h-[44px]"
                disabled={loading}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            {/* Current conditions */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getTempColor(weather.current.temp, weather.production.isOptimal)}`}>
                  {weather.current.temp}°C
                </div>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {getWeatherIcon(weather.current.condition)}
                  <span className="text-[11px] text-stone-600">{weather.current.condition}</span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-right">
              <div>
                <div className="flex items-center justify-end gap-1 text-stone-400">
                  <Thermometer className="w-3 h-3" />
                  <span className="text-[10px]">Sensacion</span>
                </div>
                <p className="text-xs font-medium">{weather.current.feelsLike}°C</p>
              </div>
              <div>
                <div className="flex items-center justify-end gap-1 text-stone-400">
                  <Droplets className="w-3 h-3" />
                  <span className="text-[10px]">Humedad</span>
                </div>
                <p className="text-xs font-medium">{weather.current.humidity}%</p>
              </div>
              <div>
                <div className="flex items-center justify-end gap-1 text-stone-400">
                  <Wind className="w-3 h-3" />
                  <span className="text-[10px]">Viento</span>
                </div>
                <p className="text-xs font-medium">{weather.current.windSpeed} km/h {weather.current.windDirection}</p>
              </div>
              <div>
                <div className="flex items-center justify-end gap-1 text-stone-400">
                  <Eye className="w-3 h-3" />
                  <span className="text-[10px]">Rango opt.</span>
                </div>
                <p className="text-xs font-medium">{weather.production.optimalRange.min}-{weather.production.optimalRange.max}°C</p>
              </div>
            </div>
          </div>

          {/* Production Impact */}
          <div className={`mt-3 p-2.5 rounded-lg border ${
            weather.production.isOptimal ? 'border-green-200 bg-green-50' :
            weather.production.impact === 'negativo-alto' ? 'border-red-200 bg-red-50' :
            'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                {getImpactIcon(weather.production.impact)}
                <span className="text-xs font-semibold">
                  Impacto en Produccion
                </span>
              </div>
              {getImpactBadge(weather.production.impact)}
            </div>
            <p className="text-[11px] text-stone-600">{weather.production.message}</p>
            {weather.production.impactPercentage !== 0 && avgProduction && (
              <p className="text-[10px] text-stone-500 mt-1">
                Produccion estimada ajustada: {fmtNum(Math.round(avgProduction * (1 + weather.production.impactPercentage / 100)))} huevos/dia
                {weather.production.impactPercentage < 0 && ` (${weather.production.impactPercentage}%)`}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Weather Alerts */}
      {weather.alerts.length > 0 && (
        <Alert className="border-red-300 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm text-red-800">
            <strong>Alertas climaticas:</strong>
            <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
              {weather.alerts.map((alert, i) => (
                <li key={i}>{alert}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* 5-Day Forecast */}
      {weather.forecast.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-600" />
              Pronostico 5 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {weather.forecast.map((day, i) => {
                const isDayOptimal = day.tempMax >= weather.production.optimalRange.min && day.tempMax <= weather.production.optimalRange.max + 3
                return (
                  <div key={i} className={`text-center p-2 rounded-lg border ${isDayOptimal ? 'border-green-200 bg-green-50/50' : 'border-stone-100 bg-stone-50/50'}`}>
                    <p className="text-[10px] font-medium text-stone-600 capitalize">{day.date}</p>
                    <div className="flex justify-center my-1">
                      {getForecastIcon(day.condition)}
                    </div>
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-xs font-bold">{day.tempMax}°</span>
                      <span className="text-[10px] text-stone-400">/</span>
                      <span className="text-[10px] text-stone-500">{day.tempMin}°</span>
                    </div>
                    <p className="text-[9px] text-stone-400 mt-0.5 capitalize truncate">{day.condition}</p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
