import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  // Only warn in browser
  console.warn('Supabase credentials not configured. Using localStorage fallback.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const isSupabaseConfigured = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey)
}

// Get the farm ID from env or localStorage
export const getFarmId = (): string | null => {
  // Check env first
  if (typeof window !== 'undefined') {
    const envFarmId = process.env.NEXT_PUBLIC_FARM_ID
    if (envFarmId) return envFarmId
    
    // Check localStorage
    const stored = localStorage.getItem('granja-wd80-farm-id')
    if (stored) return stored
  }
  return null
}

export const setFarmId = (farmId: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('granja-wd80-farm-id', farmId)
  }
}

export const clearFarmId = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('granja-wd80-farm-id')
  }
}
