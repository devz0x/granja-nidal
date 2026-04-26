'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { isSupabaseConfigured, getFarmId, setFarmId as storeFarmId } from '@/lib/supabase'
import type { FarmConfig, BatchConfig, StructuralExpense, MonthlyRecord } from '@/lib/farm-data'
import {
  DEFAULT_CONFIG, DEFAULT_FEED, DEFAULT_STRUCTURAL_EXPENSES,
} from '@/lib/farm-data'

// ================================================================
// SUPABASE CONNECTION CHECK
// ================================================================
export function useSupabaseStatus() {
  return useQuery({
    queryKey: ['supabase-status'],
    queryFn: async () => {
      const configured = isSupabaseConfigured()
      const farmId = getFarmId()
      return { configured, farmId }
    },
    staleTime: 60000,
    refetchOnWindowFocus: false,
  })
}

// ================================================================
// MAIN DATA PROVIDER HOOK (Supabase only — no localStorage)
// ================================================================
export function useFarmData() {
  const queryClient = useQueryClient()
  const { configured, farmId } = useSupabaseStatus()

  const useSupabase = configured && !!farmId

  // ---- Config ----
  const configQuery = useQuery({
    queryKey: ['farm-config', farmId],
    queryFn: async (): Promise<FarmConfig> => {
      if (!useSupabase || !farmId) return DEFAULT_CONFIG
      const res = await fetch(`/api/config?farm_id=${farmId}`)
      const data = await res.json()
      if (data.config && Object.keys(data.config).length > 0) {
        return { ...DEFAULT_CONFIG, ...data.config, feedPhases: { ...DEFAULT_FEED, ...(data.config.feedPhases || {}) } }
      }
      return DEFAULT_CONFIG
    },
    staleTime: 30000,
  })

  // ---- Batches ----
  const batchesQuery = useQuery({
    queryKey: ['batches', farmId],
    queryFn: async (): Promise<BatchConfig[]> => {
      if (!useSupabase || !farmId) return []
      const res = await fetch(`/api/batches?farm_id=${farmId}`)
      const data = await res.json()
      if (data.batches && data.batches.length > 0) {
        return data.batches.map((b: Record<string, unknown>) => ({
          id: b.batch_key as string || b.id as string,
          name: b.name as string,
          hens: b.hens as number,
          layingRate: b.laying_rate as number,
          isLaying: b.is_laying as boolean,
          cycleMonth: b.cycle_month as number,
          phase: b.phase as BatchConfig['phase'],
        }))
      }
      return []
    },
    staleTime: 30000,
  })

  // ---- Monthly Records ----
  const recordsQuery = useQuery({
    queryKey: ['monthly-records', farmId],
    queryFn: async (): Promise<MonthlyRecord[]> => {
      if (!useSupabase || !farmId) return []
      const res = await fetch(`/api/monthly-records?farm_id=${farmId}`)
      const data = await res.json()
      if (data.records && data.records.length > 0) {
        return data.records.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          month: r.month as string,
          date: r.record_date as string,
          batches: (r.batches_snapshot || []) as BatchConfig[],
          config: (r.config_snapshot || {}) as FarmConfig,
          notes: (r.notes || '') as string,
          revenue: (r.revenue || 0) as number,
          expenses: (r.expenses || 0) as number,
          net: (r.net || 0) as number,
        }))
      }
      return []
    },
    staleTime: 30000,
  })

  // ---- Structural Expenses ----
  const structuralQuery = useQuery({
    queryKey: ['structural-expenses', farmId],
    queryFn: async (): Promise<StructuralExpense[]> => {
      if (!useSupabase || !farmId) return DEFAULT_STRUCTURAL_EXPENSES
      const res = await fetch(`/api/structural-expenses?farm_id=${farmId}`)
      const data = await res.json()
      if (data.expenses && data.expenses.length > 0) {
        return data.expenses.map((e: Record<string, unknown>) => ({
          id: e.id as string,
          description: (e.description || '') as string,
          amount: (e.amount || 0) as number,
          frequency: (e.frequency || 'unico') as StructuralExpense['frequency'],
          dateAdded: (e.created_at || '') as string,
          isActive: (e.is_active !== undefined ? e.is_active : true) as boolean,
        }))
      }
      return DEFAULT_STRUCTURAL_EXPENSES
    },
    staleTime: 30000,
  })

  // ---- Mutation: Save Config ----
  const saveConfigMutation = useMutation({
    mutationFn: async (config: FarmConfig) => {
      if (useSupabase && farmId) {
        await fetch(`/api/config?farm_id=${farmId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config }),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['farm-config'] })
    },
  })

  // ---- Mutation: Save Batches ----
  const saveBatchesMutation = useMutation({
    mutationFn: async (batches: BatchConfig[]) => {
      if (useSupabase && farmId) {
        for (const batch of batches) {
          const existingRes = await fetch(`/api/batches?farm_id=${farmId}`)
          const existingData = await existingRes.json()
          const existing = existingData.batches?.find((b: Record<string, unknown>) => b.batch_key === batch.id)
          if (existing) {
            await fetch(`/api/batches/${existing.id}?farm_id=${farmId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: batch.name,
                hens: batch.hens,
                laying_rate: batch.layingRate,
                is_laying: batch.isLaying,
                cycle_month: batch.cycleMonth,
                phase: batch.phase,
              }),
            })
          } else {
            await fetch(`/api/batches?farm_id=${farmId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                batch_key: batch.id,
                name: batch.name,
                hens: batch.hens,
                laying_rate: batch.layingRate,
                is_laying: batch.isLaying,
                cycle_month: batch.cycleMonth,
                phase: batch.phase,
                sort_order: 0,
              }),
            })
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
    },
  })

  // ---- Mutation: Save Records ----
  const saveRecordsMutation = useMutation({
    mutationFn: async (records: MonthlyRecord[]) => {
      // Records are saved via Supabase API in page.tsx
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthly-records'] })
    },
  })

  // ---- Mutation: Save Structural ----
  const saveStructuralMutation = useMutation({
    mutationFn: async (expenses: StructuralExpense[]) => {
      // Structural expenses are saved via Supabase API in page.tsx
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structural-expenses'] })
    },
  })

  // ---- Check connection ----
  const checkConnectionMutation = useMutation({
    mutationFn: async (inputFarmId: string) => {
      const res = await fetch(`/api/farm?farm_id=${inputFarmId}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      return data.farm
    },
    onSuccess: (farm) => {
      if (farm) {
        storeFarmId(farm.id)
        queryClient.invalidateQueries()
      }
    },
  })

  // ---- Convenience: Set farm ID ----
  const setFarmId = useCallback((id: string) => {
    storeFarmId(id)
    queryClient.invalidateQueries()
  }, [queryClient])

  return {
    useSupabase,
    configured: configured && !!farmId,
    farmId,

    // Data
    config: configQuery.data ?? DEFAULT_CONFIG,
    batches: batchesQuery.data ?? [],
    records: recordsQuery.data ?? [],
    structuralExpenses: structuralQuery.data ?? DEFAULT_STRUCTURAL_EXPENSES,

    // Loading
    isLoading: configQuery.isLoading || batchesQuery.isLoading,

    // Mutations
    saveConfig: saveConfigMutation.mutate,
    saveBatches: saveBatchesMutation.mutate,
    saveRecords: saveRecordsMutation.mutate,
    saveStructural: saveStructuralMutation.mutate,
    checkConnection: checkConnectionMutation.mutate,
    setFarmId,
    refetch: () => {
      queryClient.invalidateQueries()
    },
  }
}
