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

// ================================================================
// Auth Helpers
// ================================================================

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export const getUser = async () => {
  const session = await getSession()
  return session?.user ?? null
}

export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getUser()
  return user?.id ?? null
}

export const getCurrentUserEmail = async (): Promise<string | null> => {
  const user = await getUser()
  return user?.email ?? null
}

export const signInWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

// Get the auth token from the current session for server-side use
export const getAuthToken = async (): Promise<string | null> => {
  const session = await getSession()
  return session?.access_token ?? null
}

// ================================================================
// Farm ID Helpers
// ================================================================

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
