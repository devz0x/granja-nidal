'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        retry: 1,
      },
    },
  }))

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed, non-critical
      })
    }
  }, [])

  // Listen for back-online toast events
  useEffect(() => {
    const handleBackOnline = () => {
      // toast will be triggered by the OfflineBanner component
    }
    const handleSyncComplete = ((e: CustomEvent) => {
      const { success, failed, remaining } = e.detail || {}
      if (success > 0) {
        console.log(`Sync complete: ${success} succeeded, ${failed} failed, ${remaining} remaining`)
      }
    }) as EventListener

    window.addEventListener('granja-back-online', handleBackOnline)
    window.addEventListener('granja-sync-complete', handleSyncComplete)

    return () => {
      window.removeEventListener('granja-back-online', handleBackOnline)
      window.removeEventListener('granja-sync-complete', handleSyncComplete)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  )
}
