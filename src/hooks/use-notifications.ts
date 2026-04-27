'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

import { FARM_ID } from '@/lib/constants'
const CHECK_INTERVAL = 2 * 60 * 1000 // 2 minutes

export interface NotificationItem {
  id: string
  type: 'feed_low' | 'vaccine_due' | 'reminder_overdue'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const lastAlertIdsRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      return perm
    }
    return 'denied'
  }, [])

  // Track permission changes with a ref
  const permissionRef = useRef(permission)

  // Send browser notification + in-app toast
  const notify = useCallback((item: Omit<NotificationItem, 'read' | 'timestamp' | 'id'>) => {
    const id = `${item.type}-${item.title}-${Date.now()}`
    const notif: NotificationItem = {
      ...item,
      id,
      timestamp: new Date(),
      read: false,
    }

    // Avoid duplicate alerts for same title within session
    if (lastAlertIdsRef.current.has(item.title)) return
    lastAlertIdsRef.current.add(item.title)

    // In-app toast
    toast.warning(item.title, {
      description: item.message,
      duration: 8000,
    })

    // Browser notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(item.title, {
          body: item.message,
          icon: '/logo.jpg',
          tag: id,
        })
      } catch {
        // Browser notification failed, toast already shown
      }
    }

    setNotifications(prev => [notif, ...prev].slice(0, 50))
  }, [])

  // Check feed inventory levels
  const checkFeedInventory = useCallback(async () => {
    if (!FARM_ID) return
    try {
      const res = await fetch(`/api/feed-inventory?farm_id=${FARM_ID}`)
      if (!res.ok) return
      const data = await res.json()
      const items = data.inventory || []
      for (const item of items) {
        if (item.current_stock_kg <= item.reorder_level_kg && item.current_stock_kg >= 0) {
          notify({
            type: 'feed_low',
            title: `⚠️ Stock bajo de alimento`,
            message: `${item.phase}: ${item.current_stock_kg.toFixed(0)} kg (min: ${item.reorder_level_kg.toFixed(0)} kg). Reordenar pronto.`,
          })
        }
      }
    } catch {
      // Silently fail
    }
  }, [notify])

  // Check vaccination due dates
  const checkVaccinations = useCallback(async () => {
    if (!FARM_ID) return
    try {
      const res = await fetch(`/api/vaccinations?farm_id=${FARM_ID}`)
      if (!res.ok) return
      const data = await res.json()
      const vaccines = data.vaccinations || []
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const threeDays = new Date(today)
      threeDays.setDate(threeDays.getDate() + 3)

      for (const v of vaccines) {
        if (v.status !== 'programada') continue
        if (!v.next_dose) continue
        const dueDate = new Date(v.next_dose)
        dueDate.setHours(0, 0, 0, 0)

        if (dueDate < today) {
          notify({
            type: 'vaccine_due',
            title: `💉 Vacuna vencida: ${v.vaccine_name}`,
            message: `La vacuna "${v.vaccine_name}" debio aplicarse el ${v.next_dose}.`,
          })
        } else if (dueDate <= threeDays) {
          notify({
            type: 'vaccine_due',
            title: `💉 Vacuna proxima: ${v.vaccine_name}`,
            message: `"${v.vaccine_name}" programada para ${v.next_dose}.`,
          })
        }
      }
    } catch {
      // Silently fail
    }
  }, [notify])

  // Check urgent reminders
  const checkReminders = useCallback(async () => {
    if (!FARM_ID) return
    try {
      const res = await fetch(`/api/reminders?farm_id=${FARM_ID}&limit=500`)
      if (!res.ok) return
      const data = await res.json()
      const reminders = data.reminders || []
      const today = new Date().toISOString().split('T')[0]

      for (const r of reminders) {
        if (r.status !== 'pendiente') continue
        if (r.priority === 'urgente' && r.due_date && r.due_date < today) {
          notify({
            type: 'reminder_overdue',
            title: `🔔 Recordatorio urgente vencido`,
            message: `"${r.title}" — vencio el ${r.due_date}.`,
          })
        }
      }
    } catch {
      // Silently fail
    }
  }, [notify])

  // Run all checks
  const runChecks = useCallback(async () => {
    await Promise.allSettled([
      checkFeedInventory(),
      checkVaccinations(),
      checkReminders(),
    ])
  }, [checkFeedInventory, checkVaccinations, checkReminders])

  // Auto-check every 2 minutes
  useEffect(() => {
    // Initial check after a short delay
    const timeout = setTimeout(() => {
      runChecks()
    }, 5000)

    intervalRef.current = setInterval(runChecks, CHECK_INTERVAL)

    return () => {
      clearTimeout(timeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [runChecks])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
    lastAlertIdsRef.current.clear()
  }, [])

  return {
    notifications,
    unreadCount,
    requestPermission,
    permission,
    markAllRead,
    clearAll,
    runChecks,
  }
}
