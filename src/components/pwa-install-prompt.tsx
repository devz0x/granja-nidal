'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function checkIsDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('granja-pwa-dismissed')
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const dismissed = checkIsDismissed()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (dismissed) return
    if (checkIsStandalone()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [dismissed])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    if (typeof window !== 'undefined') {
      localStorage.setItem('granja-pwa-dismissed', 'true')
    }
  }

  if (!showPrompt || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 bg-white rounded-xl shadow-lg border border-stone-200 p-4 animate-in slide-in-from-bottom-5 duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 w-6 h-6 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
      >
        <X className="w-3.5 h-3.5 text-stone-400" />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
          <Download className="w-5 h-5 text-green-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-stone-800">Instalar Granja Nidal</h3>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Accede mas rapido desde tu pantalla de inicio. Funciona sin conexion.
          </p>
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              onClick={handleInstall}
              className="h-9 text-xs bg-green-600 hover:bg-green-700 text-white min-w-[44px] min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5 mr-1" />
              Instalar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-9 text-xs text-stone-500 min-w-[44px] min-h-[44px]"
            >
              Mas tarde
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
