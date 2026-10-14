import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fechaHora } from '../../lib/sesiones'
import {
  EVENTOS_POR_PAGINA, detallesEvento, etiquetaEvento, listarHistorialTurno, montoEvento,
} from '../../lib/historialTurno'

/**
 * Historial del turno (T-43): cada evento en orden, con la hora, qué pasó,
 * quién lo hizo, el monto y el método, el motivo y, en el cierre, el arqueo.
 * Paginado según `X-Total-Count`.
 */
export default function HistorialTurno({ cajaId }) {
  const [pagina, setPagina] = useState(0)
  const [estado, setEstado] = useState({ clave: '', eventos: [], total: 0, error: '' })
  const clave = `${cajaId}|${pagina}`

  useEffect(() => {
    let ignore = false
    listarHistorialTurno(cajaId, { limit: EVENTOS_POR_PAGINA, offset: pagina * EVENTOS_POR_PAGINA })
      .then(({ eventos, total }) => { if (!ignore) setEstado({ clave, eventos, total, error: '' }) })
      .catch((e) => { if (!ignore) setEstado({ clave, eventos: [], total: 0, error: String(e?.detail || e?.message || 'No se pudo cargar el historial').replace(/^\d{3}:\s*/, '') }) })
    return () => { ignore = true }
  }, [cajaId, pagina, clave])

  if (estado.clave !== clave) return <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando el historial…</p>
  if (estado.error) return <p role="alert" className="text-xs text-red-600">{estado.error}</p>
  const totalPaginas = Math.max(1, Math.ceil(estado.total / EVENTOS_POR_PAGINA))

  return (
    <div className="flex flex-col gap-2">
      {estado.eventos.length === 0 ? (
        <p className="text-xs text-[hsl(var(--muted-foreground))]">Este turno todavía no tiene eventos.</p>
      ) : (
        <ol aria-label="Historial del turno" className="flex flex-col gap-1.5">
          {estado.eventos.map((ev) => {
            const montoTexto = montoEvento(ev)
            const detalles = detallesEvento(ev)
            return (
              <li key={ev.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold text-[hsl(var(--foreground))]">{etiquetaEvento(ev.tipo)}</span>
                  <span className="text-[hsl(var(--muted-foreground))]">{fechaHora(ev.created_at)}</span>
                </div>
                {(montoTexto || detalles.length > 0) && (
                  <p className="mt-0.5 text-[hsl(var(--foreground))]">{[montoTexto, ...detalles].filter(Boolean).join(' · ')}</p>
                )}
                {ev.motivo && <p className="mt-0.5 text-[hsl(var(--foreground))]">Motivo: {ev.motivo}</p>}
                {ev.actor_email && <p className="mt-0.5 text-[hsl(var(--muted-foreground))]">{ev.actor_email}</p>}
              </li>
            )
          })}
        </ol>
      )}
      {estado.total > EVENTOS_POR_PAGINA && (
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span>Página {pagina + 1} de {totalPaginas} · {estado.total} eventos</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
          </span>
        </div>
      )}
    </div>
  )
}
