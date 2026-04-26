import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const _isConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'))

// Use createBrowserClient in the browser for cookie-based auth (readable by middleware).
// Falls back to createClient on the server (basic client, no auth context).
// For server-side API routes, use createServerSupabaseClient from './supabase/server'.
const _isBrowser = typeof window !== 'undefined'

// SECURITY FIX VULN-16: No more placeholder URL/JWT that could be exploited
// When not configured, create a client that throws clear errors on use
function createNoopClient() {
  return createClient('https://localhost', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJub29wIiwic3ViIjoibm9vcCIsInJvbGUiOiJhbm9uIiwiaWF0IjoxfQ noop', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export const supabase = _isBrowser && _isConfigured
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : _isConfigured
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createNoopClient()

export const isSupabaseConfigured = (): boolean => _isConfigured

// ================================================================
// Auth Helpers (Browser-side)
// ================================================================

export const getSession = async () => {
  if (!_isConfigured) return null
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
  if (!_isConfigured) return { data: { session: null, user: null }, error: { message: 'Supabase no configurado', name: 'NotConfigured', status: 503 } as any }
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signUpWithEmail = async (email: string, password: string) => {
  if (!_isConfigured) return { data: { session: null, user: null }, error: { message: 'Supabase no configurado', name: 'NotConfigured', status: 503 } as any }
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
// Farm ID Helpers (single-farm mode: Granja Nidal)
// ================================================================

// Get the farm ID — uses NEXT_PUBLIC_FARM_ID env var (set on Vercel)
export const getFarmId = (): string | null => {
  if (typeof window !== 'undefined') {
    const envFarmId = process.env.NEXT_PUBLIC_FARM_ID
    if (envFarmId) return envFarmId
  }
  return null
}

export const setFarmId = (_farmId: string): void => {
  // No-op in single-farm mode (farm ID comes from env var)
}

export const clearFarmId = (): void => {
  // No-op in single-farm mode (farm ID comes from env var)
}
