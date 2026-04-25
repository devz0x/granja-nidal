import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const _isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

// Only create the client if properly configured; otherwise use a no-op placeholder
// that won't crash on import. The app checks isSupabaseConfigured() before any calls.
export const supabase = _isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDc4NzE0MDF9.placeholder')

export const isSupabaseConfigured = (): boolean => _isConfigured

// Get the farm ID from env or localStorage
export const getFarmId = (): string | null => {
  if (typeof window !== 'undefined') {
    const envFarmId = process.env.NEXT_PUBLIC_FARM_ID
    if (envFarmId) return envFarmId

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
