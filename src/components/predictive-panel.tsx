'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, Target, DollarSign, BarChart3, ChevronLeft } from 'lucide-react'
import { getFarmId } from '@/lib/supabase'

interface PredictionData {
  summary: {
    data_points: number
    trend_direction: string
    trend_slope: number
    current_avg_7day: number
    current_avg_30day: number
    current_feed_7day: number
    current_feed_30day: number
  }
  moving_averages: Array<{ date: string; eggs: number; ma7: number; ma30: number }>
  predictions_30days: Array<{
    date: string
    predicted_eggs: number
    predicted_feed: number
    predicted_mortality: number
    lower_conf: number
    upper_conf: number
  }>
  batch_analysis: Array<{
    batch_id: string
    batch_name: string
    hens: number
    cycle_month: number
    laying_rate: number
    is_laying: boolean
    avg_daily_eggs: number
    avg_daily_mortality: number
    mortality_risk: string
    sale_recommendation: string
  }>
  revenue_forecast: Array<{
    month: string
    eggs: number
    revenue: number
    feed_cost: number
    net: number
    trend: string
  }>
  regression: {
    egg_slope: number
    egg_intercept: number
    feed_slope: number
    mortality_slope: number
  }
}

function fmtRD(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

import { FARM_ID } from '@/lib/constants'

function fmtNum(value: number): string {
  return new Intl.NumberFormat('es-DO').format(value)
}

export default function PredictivePanel({ goBack }: { goBack: () => void }) {
  const [data, setData] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAllPredictions, setShowAllPredictions] = useState(false)

  const fetchData = useCallback(async () => {
    if (!FARM_ID) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/predictions?farm_id=${FARM_ID}`)
      if (!res.ok) throw new Error('Error al cargar predicciones')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const trendIcon = data?.summary.trend_direction === 'ascendente'
    ? <TrendingUp className="w-4 h-4 text-green-600" />
    : data?.summary.trend_direction === 'descendente'
      ? <TrendingDown className="w-4 h-4 text-red-600" />
      : <Minus className="w-4 h-4 text-stone-500" />

  const trendColor = data?.summary.trend_direction === 'ascendente'
    ? 'text-green-700'
    : data?.summary.trend_direction === 'descendente'
      ? 'text-red-700'
      : 'text-stone-600'

  const riskBadge = (risk: string) => {
    if (risk === 'alto') return <Badge className="bg-red-100 text-red-700 text-[10px]">Alto</Badge>
    if (risk === 'moderado') return <Badge className="bg-amber-100 text-amber-700 text-[10px]">Moderado</Badge>
    return <Badge className="bg-green-100 text-green-700 text-[10px]">Bajo</Badge>
  }

  // Simple mini chart using divs
  const MiniChart = ({ values, height = 60, color = 'bg-green-400' }: { values: number[]; height?: number; color?: string }) => {
    if (values.length === 0) return null
    const max = Math.max(...values, 1)
    return (
      <div className="flex items-end gap-[1px] w-full" style={{ height }}>
        {values.slice(-30).map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${color} opacity-70`}
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
            title={`${fmtNum(v)} huevos`}
          />
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <h2 className="text-lg font-bold text-stone-800">Analisis Predictivo</h2>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
          <span className="ml-3 text-stone-500 text-sm">Calculando predicciones...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
            <ChevronLeft className="w-4 h-4" /> Volver
          </Button>
          <h2 className="text-lg font-bold text-stone-800">Analisis Predictivo</h2>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-10 h-10 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-stone-600">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData} className="mt-3">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  const predDays = showAllPredictions ? data.predictions_30days : data.predictions_30days.slice(0, 14)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 text-xs h-8">
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
        <h2 className="text-lg font-bold text-stone-800">Analisis Predictivo</h2>
        <Badge variant="outline" className="text-[10px]">{data.summary.data_points} dias de datos</Badge>
        <Button variant="ghost" size="sm" onClick={fetchData} className="ml-auto text-xs">
          <Loader2 className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} /> Actualizar
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Tendencia</span>
            </div>
            <div className="flex items-center gap-2">
              {trendIcon}
              <span className={`text-sm font-bold ${trendColor}`}>
                {data.summary.trend_direction.charAt(0).toUpperCase() + data.summary.trend_direction.slice(1)}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 mt-0.5">Pendiente: {data.regression.egg_slope > 0 ? '+' : ''}{data.regression.egg_slope} huevos/dia</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Promedio 7 dias</span>
            </div>
            <p className="text-sm font-bold text-amber-700">{fmtNum(data.summary.current_avg_7day)}</p>
            <p className="text-[10px] text-stone-400">{fmtNum(data.summary.current_avg_30day)} (30 dias)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-violet-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Feed 7 dias</span>
            </div>
            <p className="text-sm font-bold text-violet-700">{data.summary.current_feed_7day.toFixed(1)} kg/dia</p>
            <p className="text-[10px] text-stone-400">{data.summary.current_feed_30day.toFixed(1)} (30 dias)</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-medium text-stone-500 uppercase">Mortalidad Trend</span>
            </div>
            <p className={`text-sm font-bold ${data.regression.mortality_slope > 0 ? 'text-red-700' : 'text-green-700'}`}>
              {data.regression.mortality_slope > 0 ? '+' : ''}{data.regression.mortality_slope}/dia
            </p>
            <p className="text-[10px] text-stone-400">aves perdidas por dia</p>
          </CardContent>
        </Card>
      </div>

      {/* Moving Averages Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-green-600" /> Promedios Moviles
          </CardTitle>
          <CardDescription className="text-[11px]">Produccion diaria con promedios de 7 y 30 dias</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <MiniChart values={data.moving_averages.map(d => d.ma7)} height={80} color="bg-green-400" />
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-green-400 opacity-70" />
                <span className="text-[10px] text-stone-500">Promedio 7 dias</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-amber-400 opacity-70" />
                <span className="text-[10px] text-stone-500">Promedio 30 dias</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm bg-stone-300" />
                <span className="text-[10px] text-stone-500">Produccion real</span>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-stone-500 border-b">
                    <th className="text-left py-1">Fecha</th>
                    <th className="text-right py-1">Real</th>
                    <th className="text-right py-1">MA7</th>
                    <th className="text-right py-1">MA30</th>
                  </tr>
                </thead>
                <tbody>
                  {data.moving_averages.slice(-14).reverse().map((d, i) => (
                    <tr key={i} className="border-b border-stone-50">
                      <td className="py-1 text-stone-600">{d.date}</td>
                      <td className="text-right text-stone-800">{fmtNum(d.eggs)}</td>
                      <td className="text-right text-green-700">{fmtNum(d.ma7)}</td>
                      <td className="text-right text-amber-700">{fmtNum(d.ma30)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 30-Day Prediction */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-600" /> Prediccion 30 Dias
              </CardTitle>
              <CardDescription className="text-[11px]">Produccion estimada con intervalo de confianza</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-[10px] h-7" onClick={() => setShowAllPredictions(!showAllPredictions)}>
              {showAllPredictions ? 'Mostrar menos' : 'Mostrar todo'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-stone-500 border-b">
                  <th className="text-left py-1.5">Fecha</th>
                  <th className="text-right py-1.5">Prediccion</th>
                  <th className="text-right py-1.5">Feed (kg)</th>
                  <th className="text-right py-1.5">Mort.</th>
                  <th className="text-right py-1.5">Intervalo</th>
                </tr>
              </thead>
              <tbody>
                {predDays.map((d, i) => (
                  <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                    <td className="py-1.5 text-stone-600">{d.date}</td>
                    <td className="text-right font-medium text-stone-800">{fmtNum(d.predicted_eggs)}</td>
                    <td className="text-right text-stone-500">{d.predicted_feed.toFixed(1)}</td>
                    <td className="text-right text-stone-500">{d.predicted_mortality.toFixed(2)}</td>
                    <td className="text-right text-stone-400 text-[10px]">
                      {fmtNum(d.lower_conf)} - {fmtNum(d.upper_conf)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Forecast */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" /> Proyeccion de Ingresos (3 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.revenue_forecast.map((m, i) => {
              const trendIcon = m.trend === 'up'
                ? <TrendingUp className="w-4 h-4 text-green-600" />
                : m.trend === 'down'
                  ? <TrendingDown className="w-4 h-4 text-red-600" />
                  : <Minus className="w-4 h-4 text-stone-500" />
              return (
                <div key={i} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-700">{m.month}</span>
                      {trendIcon}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] text-stone-400">Ingreso</p>
                        <p className="text-sm font-bold text-green-700">{fmtRD(m.revenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-stone-400">Feed</p>
                        <p className="text-sm font-bold text-red-700">{fmtRD(m.feed_cost)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-stone-400">Neto</p>
                        <p className={`text-sm font-bold ${m.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtRD(m.net)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-stone-400">{fmtNum(m.eggs)} huevos estimados</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Batch Analysis */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" /> Analisis por Lote
          </CardTitle>
          <CardDescription className="text-[11px]">Riesgo de mortalidad y momento optimo de venta</CardDescription>
        </CardHeader>
        <CardContent>
          {data.batch_analysis.length === 0 ? (
            <p className="text-xs text-stone-400 text-center py-4">No hay lotes para analizar.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.batch_analysis.map((b) => (
                <div key={b.batch_id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-stone-700">{b.batch_name}</span>
                      <Badge variant="outline" className="text-[9px]">
                        {b.is_laying ? 'Postura' : 'No postura'}
                      </Badge>
                      {riskBadge(b.mortality_risk)}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-stone-400">Ciclo</p>
                      <p className="text-xs font-bold">{b.cycle_month} meses</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div className="bg-stone-50 rounded p-1.5 text-center">
                      <p className="text-[9px] text-stone-400">Aves</p>
                      <p className="text-xs font-bold">{fmtNum(b.hens)}</p>
                    </div>
                    <div className="bg-stone-50 rounded p-1.5 text-center">
                      <p className="text-[9px] text-stone-400">Postura %</p>
                      <p className="text-xs font-bold">{b.laying_rate}%</p>
                    </div>
                    <div className="bg-stone-50 rounded p-1.5 text-center">
                      <p className="text-[9px] text-stone-400">Mort./dia</p>
                      <p className="text-xs font-bold">{b.avg_daily_mortality}</p>
                    </div>
                  </div>
                  <div className={`text-[11px] p-2 rounded ${b.sale_recommendation.includes('Recomendado') ? 'bg-amber-50 text-amber-700' : b.sale_recommendation.includes('no esta') ? 'bg-stone-50 text-stone-600' : 'bg-green-50 text-green-700'}`}>
                    <strong>Recomendacion:</strong> {b.sale_recommendation}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
