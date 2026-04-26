'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface QueuedMutation {
  id: string
  url: string
  method: string
  body: string
  timestamp: number
}

const QUEUE_KEY = 'granja-nidal-offline-queue'
const SYNCING_KEY = 'granja-nidal-syncing'

export function useOffline() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Detect online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateStatus = () => {
      const online = navigator.onLine
      setIsOnline(online)
    }

    updateStatus()

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  // Listen for online event to trigger sync with toast
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      // Show toast
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Granja Nidal', {
          body: 'Conexion restablecida - Sincronizando...',
          icon: '/icon-192.png',
        })
      }

      // Also dispatch custom event for toast
      window.dispatchEvent(new CustomEvent('granja-back-online'))

      // Start syncing after a short delay
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = setTimeout(() => {
        syncQueue()
      }, 1500)
    }

    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('online', handleOnline)
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [])

  // Get queue count on mount and after changes
  const updateQueueCount = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') as QueuedMutation[]
      setQueueCount(queue.length)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    updateQueueCount()
  }, [updateQueueCount, isOnline, isSyncing])

  // Queue a failed mutation
  const queueMutation = useCallback((url: string, method: string, body: unknown) => {
    if (typeof window === 'undefined') return
    try {
      const queue: QueuedMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
      queue.push({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        url,
        method,
        body: JSON.stringify(body),
        timestamp: Date.now(),
      })
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
      setQueueCount(queue.length)
    } catch { /* ignore */ }
  }, [])

  // Retry all queued mutations
  const syncQueue = useCallback(async () => {
    if (typeof window === 'undefined') return

    // Prevent multiple syncs
    if (localStorage.getItem(SYNCING_KEY)) return
    localStorage.setItem(SYNCING_KEY, 'true')
    setIsSyncing(true)

    try {
      const queue: QueuedMutation[] = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')

      if (queue.length === 0) {
        setIsSyncing(false)
        localStorage.removeItem(SYNCING_KEY)
        return
      }

      let successCount = 0
      let failCount = 0
      const remaining: QueuedMutation[] = []

      for (const item of queue) {
        try {
          const res = await fetch(item.url, {
            method: item.method,
            headers: { 'Content-Type': 'application/json' },
            body: item.body,
          })

          if (res.ok) {
            successCount++
          } else {
            failCount++
            remaining.push(item)
          }
        } catch {
          failCount++
          remaining.push(item)
        }
      }

      // Update queue
      localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
      setQueueCount(remaining.length)

      // Dispatch sync complete event
      window.dispatchEvent(new CustomEvent('granja-sync-complete', {
        detail: { success: successCount, failed: failCount, remaining: remaining.length }
      }))

    } catch { /* ignore */ } finally {
      setIsSyncing(false)
      localStorage.removeItem(SYNCING_KEY)
    }
  }, [])

  // Wrapper for fetch that auto-queues failed mutations
  const offlineFetch = useCallback(async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response | null> => {
    if (isOnline) {
      try {
        const res = await fetch(url, options)
        if (!res.ok && (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE')) {
          // Queue if mutation failed (e.g. network error mid-request)
          if (options.body) {
            queueMutation(url, options.method || 'GET', options.body)
          }
        }
        return res
      } catch {
        // Network error - queue mutation
        if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
          if (options.body) {
            queueMutation(url, options.method || 'GET', options.body)
          }
        }
        return null
      }
    } else {
      // Offline: queue mutations
      if (options.method === 'POST' || options.method === 'PUT' || options.method === 'DELETE') {
        if (options.body) {
          queueMutation(url, options.method || 'GET', options.body)
        }
      }
      return null
    }
  }, [isOnline, queueMutation])

  return {
    isOnline,
    isSyncing,
    queueCount,
    queueMutation,
    syncQueue,
    offlineFetch,
  }
}
