'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: !isSupabaseConfigured() ? false : true,
    isAuthenticated: false,
  })

  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true

    if (!isSupabaseConfigured()) {
      return
    }

    let cancelled = false

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!cancelled && mountedRef.current) {
        setAuthState({
          user: session?.user ?? null,
          session,
          loading: false,
          isAuthenticated: !!session,
        })
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!cancelled && mountedRef.current) {
          setAuthState({
            user: session?.user ?? null,
            session,
            loading: false,
            isAuthenticated: !!session,
          })
        }
      }
    )

    return () => {
      cancelled = true
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error.message)
      throw error
    }
  }, [])

  return {
    ...authState,
    signOut,
    isSupabaseConfigured: isSupabaseConfigured(),
  }
}
