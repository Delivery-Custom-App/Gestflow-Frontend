import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TONOS = {
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400',
  aviso: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-200',
}

/**
 * Aviso sobre las mesas juntadas, arriba de la grilla: qué pasó, qué mesas
 * siguen ocupadas y qué se puede hacer ahora (liberar el grupo, ir a una mesa).
 *
 * `aviso`: { tono: 'error' | 'aviso', mensaje, detalle?: string[], acciones?: [{ texto, onClick }] }.
 */
export default function AvisoDeGrupo({ aviso, onCerrar }) {
  if (!aviso) return null
  return (
    <div role="alert" className={cn('flex items-start justify-between gap-3 rounded-lg border px-3 py-2', TONOS[aviso.tono] || TONOS.error)}>
      <div className="min-w-0 space-y-1.5 text-xs">
        <p className="font-semibold">{aviso.mensaje}</p>
        {aviso.detalle?.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-4">
            {aviso.detalle.map((linea) => <li key={linea}>{linea}</li>)}
          </ul>
        )}
        {aviso.acciones?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-0.5">
            {aviso.acciones.map((accion) => (
              <Button key={accion.texto} type="button" size="sm" variant="outline" onClick={accion.onClick}>{accion.texto}</Button>
            ))}
          </div>
        )}
      </div>
      <button type="button" aria-label="Cerrar aviso" onClick={onCerrar} className="shrink-0 opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}
