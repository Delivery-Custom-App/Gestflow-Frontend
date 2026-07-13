import { useEffect, useState } from 'react'
import { WifiOff, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NetworkErrorModal() {
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    const handler = (e) => setError(e.detail)
    window.addEventListener('api:network-error', handler)
    return () => window.removeEventListener('api:network-error', handler)
  }, [])

  if (!error) return null

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/health`, { method: 'HEAD' })
      if (res.ok || res.status < 500) setError(null)
    } catch {
      // still offline — keep modal open
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[hsl(var(--card))] rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-modal-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 shrink-0">
              <WifiOff size={20} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Sin conexión</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                {error.method !== 'GET' ? 'La acción no se completó.' : 'No se pudieron cargar los datos.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-5 leading-relaxed">
          Verificá tu conexión a internet y volvé a intentarlo. Si el problema persiste, contactá soporte.
        </p>

        <div className="flex gap-2">
          <Button
            className="flex-1 gap-2"
            onClick={handleRetry}
            disabled={retrying}
          >
            <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Verificando…' : 'Reintentar'}
          </Button>
          <Button variant="outline" onClick={() => setError(null)}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  )
}
