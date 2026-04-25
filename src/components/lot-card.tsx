'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, TrendingUp, TrendingDown, Egg, Wheat, Bell } from 'lucide-react'
import type { BatchConfig, PhaseKey, CalculationsResult } from '@/lib/farm-data'
import { fmtRD, fmtNum, fmtPct, PHASE_COLORS, getAlertCountForBatch } from '@/lib/farm-data'

interface LotCardProps {
  batch: BatchConfig
  calc: CalculationsResult
  config: { eggPrice: number; feedPhases: Record<PhaseKey, { label: string; consumption: number; price: number; weeks: string }> }
  onClick: () => void
}

export default function LotCard({ batch, calc, config, onClick }: LotCardProps) {
  const detail = calc.batchDetails.find(b => b.id === batch.id)
  const feed = config.feedPhases[batch.phase]
  const alertCount = getAlertCountForBatch(batch.id)

  const borderColor: Record<PhaseKey, string> = {
    pre_inicio: 'border-l-gray-400',
    inicio: 'border-l-sky-400',
    crecimiento: 'border-l-cyan-400',
    pre_postura: 'border-l-amber-400',
    postura: 'border-l-green-500',
  }

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-all duration-200 border-l-4 ${borderColor[batch.phase]} hover:-translate-y-0.5 group`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: Name + Phase + Alert */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-stone-800 truncate group-hover:text-stone-900">{batch.name}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge className={`${PHASE_COLORS[batch.phase]} text-[10px]`}>
                {feed.label}
              </Badge>
              {batch.isLaying && (
                <span className="text-[9px] text-green-600 font-medium">{batch.layingRate}% postura</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {alertCount > 0 && (
              <div className="relative">
                <Bell className="w-4 h-4 text-red-500" />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-stone-400" />
            <div>
              <p className="text-xs font-bold text-stone-700">{fmtNum(batch.hens)}</p>
              <p className="text-[9px] text-stone-400">aves</p>
            </div>
          </div>

          {detail?.isLaying && (
            <>
              <div className="flex items-center gap-1.5">
                <Egg className="w-3.5 h-3.5 text-orange-400" />
                <div>
                  <p className="text-xs font-bold text-stone-700">{fmtNum(detail.eggsPerDay)}/dia</p>
                  <p className="text-[9px] text-stone-400">huevos</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                <div>
                  <p className="text-xs font-bold text-green-700">{fmtRD(detail.eggRevenue)}</p>
                  <p className="text-[9px] text-stone-400">ingreso/mes</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-amber-500" />
                <div>
                  <p className="text-xs font-bold text-red-600">{fmtRD(detail.monthlyFeedCost)}</p>
                  <p className="text-[9px] text-stone-400">feed/mes</p>
                </div>
              </div>
            </>
          )}

          {!detail?.isLaying && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3.5 h-3.5 text-stone-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-600">Mes {batch.cycleMonth}</p>
                  <p className="text-[9px] text-stone-400">del ciclo</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <div>
                  <p className="text-xs font-bold text-red-600">{fmtRD(detail?.monthlyFeedCost || 0)}</p>
                  <p className="text-[9px] text-stone-400">feed/mes</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Net balance bar */}
        {detail && (
          <div className={`mt-3 pt-3 border-t ${detail.netBalance >= 0 ? 'border-green-100' : 'border-red-100'}`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500">Balance mensual</span>
              <span className={`text-sm font-bold ${detail.netBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {detail.netBalance >= 0 ? '+' : ''}{fmtRD(detail.netBalance)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
