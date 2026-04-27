'use client'

import { useOffline } from '@/hooks/use-offline'
import { useSyncExternalStore, useEffect, useRef } from 'react'
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

// Online status subscription for useSyncExternalStore
function subscribeToOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function getServerSnapshot() {
  return true
}

export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribeToOnline, getOnlineSnapshot, getServerSnapshot)
  const { isSyncing, queueCount, syncQueue } = useOffline()
  const queueCountRef = useRef(queueCount)
  queueCountRef.current = queueCount

  // Show toast when coming back online
  useEffect(() => {
    const handleBackOnline = () => {
      const currentQueueCount = queueCountRef.current
      toast.success('Conexion restablecida', {
        description: currentQueueCount > 0 ? `Sincronizando ${currentQueueCount} cambios pendientes...` : 'Todos los datos estan actualizados.',
        duration: 4000,
      })
    }

    const handleSyncComplete = ((e: CustomEvent) => {
      const { success, remaining } = e.detail || {}
      if (success > 0) {
        toast.success('Sincronizacion completa', {
          description: remaining > 0
            ? `${success} cambios sincronizados. ${remaining} pendientes.`
            : `${success} cambios sincronizados correctamente.`,
          duration: 3000,
        })
      }
    }) as EventListener

    window.addEventListener('granja-back-online', handleBackOnline)
    window.addEventListener('granja-sync-complete', handleSyncComplete)

    return () => {
      window.removeEventListener('granja-back-online', handleBackOnline)
      window.removeEventListener('granja-sync-complete', handleSyncComplete)
    }
  }, [])

  if (isOnline && !isSyncing && queueCount === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {!isOnline && (
        <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm shadow-lg">
          <WifiOff className="w-4 h-4" />
          <span className="font-medium">Sin conexion a internet</span>
          <span className="text-red-200 text-xs">Los cambios se guardaran localmente</span>
        </div>
      )}
      {isOnline && isSyncing && (
        <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm shadow-lg">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="font-medium">Sincronizando...</span>
          <span className="text-amber-100 text-xs">Enviando cambios pendientes</span>
        </div>
      )}
      {isOnline && !isSyncing && queueCount > 0 && (
        <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm shadow-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span className="font-medium">{queueCount} cambios pendientes</span>
          <button
            onClick={syncQueue}
            className="ml-2 px-3 py-0.5 bg-white/20 hover:bg-white/30 rounded-full text-xs font-medium transition-colors"
          >
            Sincronizar ahora
          </button>
        </div>
      )}
    </div>
  )
}
