'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-stone-800">Algo salio mal</h1>
              <p className="text-sm text-stone-500">
                Ocurrio un error inesperado en la aplicacion. Por favor, recarga la pagina para continuar.
              </p>
              {this.state.error && (
                <p className="text-xs text-stone-400 font-mono bg-stone-50 rounded-lg p-3 text-left overflow-auto max-h-32">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              onClick={this.handleReload}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
