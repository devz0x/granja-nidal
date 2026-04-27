import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth-api'
import { apiRateLimit } from '@/lib/rate-limit'

// In-memory cache for weather data (30 minutes)
let weatherCache: {
  data: Record<string, unknown>
  timestamp: number
} | null = null

const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export const runtime = 'nodejs'

// GET /api/weather — fetch weather for Dominican Republic
export async function GET(req: NextRequest) {
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = apiRateLimit(clientIp)
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes.' }, { status: 429 })
  }

  const authResult = await verifyAuth()
  if (authResult.error) return authResult.error

  // Check cache
  if (weatherCache && (Date.now() - weatherCache.timestamp) < CACHE_TTL) {
    return NextResponse.json({ ...weatherCache.data, cached: true })
  }

  try {
    // Use Open-Meteo free weather API (no API key needed)
    // San José de los Llanos, San Pedro de Macorís: lat 18.6167, lon -69.5000
    const geoRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=18.6167&longitude=-69.5000&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=America%2FSanto_Domingo&forecast_days=5', {
      next: { revalidate: 1800 }
    })

    if (!geoRes.ok) throw new Error('Weather API unavailable')

    const wdata = await geoRes.json()

    const current = wdata.current || {}
    const daily = wdata.daily || {}

    const currentTemp = Math.round(current.temperature_2m || 28)
    const feelsLike = Math.round(current.apparent_temperature || 30)
    const humidity = current.relative_humidity_2m || 75
    const windSpeed = Math.round((current.wind_speed_10m || 12))
    const windDir = current.wind_direction_10m || 0

    const WMO_CODES: Record<number, string> = {
      0: 'Despejado', 1: 'Principalmente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
      45: 'Niebla', 48: 'Niebla con escarcha', 51: 'Lluvia ligera', 53: 'Lluvia moderada',
      55: 'Lluvia fuerte', 61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia fuerte',
      71: 'Nevada ligera', 73: 'Nevada moderada', 75: 'Nevada fuerte', 80: 'Chubascos',
      81: 'Chubascos moderados', 82: 'Chubascos fuertes', 95: 'Tormenta', 96: 'Tormenta con granizo',
    }

    const weatherCode = current.weather_code || 2
    const condition = WMO_CODES[weatherCode] || 'Parcialmente nublado'

    // Wind direction label
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const windDirection = dirs[Math.round(windDir / 45) % 8] || 'NE'

    // 5-day forecast
    const forecast: Record<string, unknown>[] = []
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado']
    for (let i = 0; i < (daily.time?.length || 0); i++) {
      const date = new Date(daily.time[i])
      forecast.push({
        date: date.toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' }),
        dayOfWeek: dayNames[date.getDay()],
        tempMax: Math.round(daily.temperature_2m_max?.[i] || 30),
        tempMin: Math.round(daily.temperature_2m_min?.[i] || 22),
        condition: WMO_CODES[daily.weather_code?.[i]] || 'Parcialmente nublado',
        humidity: daily.precipitation_probability_max?.[i] || 40,
        windSpeed: Math.round(daily.wind_speed_10m_max?.[i] || 10),
      })
    }

    // Production correlation
    const optimalMin = 18
    const optimalMax = 25
    const isOptimal = currentTemp >= optimalMin && currentTemp <= optimalMax

    let productionImpact = 'optimo'
    let productionMessage = 'Temperatura en rango optimo para produccion de huevos.'
    let impactPercentage = 0

    if (currentTemp > 30) {
      productionImpact = 'negativo-alto'
      productionMessage = 'Temperatura elevada. Se espera reduccion significativa en produccion (10-20%).'
      impactPercentage = -15
    } else if (currentTemp > optimalMax) {
      productionImpact = 'negativo'
      productionMessage = 'Temperatura ligeramente alta. Posible reduccion leve en produccion (5-10%).'
      impactPercentage = -8
    } else if (currentTemp < 15) {
      productionImpact = 'negativo-alto'
      productionMessage = 'Temperatura muy baja. Las aves consumen mas alimento para mantenerse calientes.'
      impactPercentage = -12
    } else if (currentTemp < optimalMin) {
      productionImpact = 'negativo'
      productionMessage = 'Temperatura ligeramente baja. Monitorear consumo de alimento.'
      impactPercentage = -5
    }

    // Extreme weather alerts
    const alerts: string[] = []
    if (currentTemp >= 35) alerts.push('Temperatura extrema: riesgo de estres calorico en las aves.')
    if (currentTemp >= 33) alerts.push('Activar ventilacion adicional y asegurar agua fresca disponible.')
    if (humidity >= 85) alerts.push('Humedad alta: mayor riesgo de enfermedades respiratorias.')
    if (windSpeed >= 30) alerts.push('Vientos fuertes: verificar estructura de galpones.')
    if (currentTemp <= 12) alerts.push('Temperatura muy baja: riesgo de hipotermia en pollitos.')
    if (weatherCode >= 95) alerts.push('Tormenta electrica: mantener aves protegidas y verificar drenaje.')

    const weatherData = {
      location: 'San José de los Llanos, San Pedro de Macorís',
      current: {
        temp: currentTemp,
        feelsLike,
        condition,
        humidity,
        windSpeed,
        windDirection,
      },
      forecast,
      production: {
        optimalRange: { min: optimalMin, max: optimalMax },
        isOptimal,
        impact: productionImpact,
        impactPercentage,
        message: productionMessage,
      },
      alerts,
      updatedAt: new Date().toISOString(),
    }

    // Cache the result
    weatherCache = {
      data: weatherData,
      timestamp: Date.now(),
    }

    return NextResponse.json(weatherData)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error desconocido'

    // Return cached data if available even if expired
    if (weatherCache) {
      return NextResponse.json({ ...weatherCache.data, cached: true, stale: true })
    }

    // Return fallback weather data
    return NextResponse.json({
      location: 'San José de los Llanos, San Pedro de Macorís',
      current: {
        temp: 28,
        feelsLike: 30,
        condition: 'Parcialmente nublado',
        humidity: 75,
        windSpeed: 12,
        windDirection: 'NE',
      },
      forecast: [],
      production: {
        optimalRange: { min: 18, max: 25 },
        isOptimal: false,
        impact: 'negativo',
        impactPercentage: -8,
        message: `No se pudo obtener datos climaticos: ${msg}`,
      },
      alerts: [],
      updatedAt: new Date().toISOString(),
      fallback: true,
    })
  }
}
