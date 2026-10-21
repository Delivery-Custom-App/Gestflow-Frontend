import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fechaHora } from '../../lib/sesiones'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { textoDiferencia } from '../../lib/arqueo'
import { APERTURAS_POR_PAGINA, listarAperturas, mensajeCajaFisica } from '../../lib/cajaFisica'

const dinero = (v) => (v === null || v === undefined || v === '' ? '—' : formatMoney(Number(v)))
const claseDif = (v) => (Number(v) < 0 ? 'text-red-600' : Number(v) > 0 ? 'text-amber-700' : 'text-emerald-700')

/**
 * Historial de aperturas de una caja física (#133): cada apertura con quién la
 * abrió, el fondo y su nota, y —si se cerró— quién, lo contado, lo esperado,
 * la diferencia y la nota. De la más nueva a la más vieja, paginado.
 */
export default function HistorialAperturas({ caja, onClose }) {
  const [pagina, setPagina] = useState(0)
  const [estado, setEstado] = useState({ clave: '', aperturas: [], total: 0, error: '' })
  const clave = `${caja.id}|${pagina}`

  useEffect(() => {
    let ignore = false
    listarAperturas(caja.id, { offset: pagina * APERTURAS_POR_PAGINA })
      .then(({ aperturas, total }) => { if (!ignore) setEstado({ clave, aperturas, total, error: '' }) })
      .catch((err) => { if (!ignore) setEstado({ clave, aperturas: [], total: 0, error: mensajeCajaFisica(err, 'No se pudo cargar el historial') }) })
    return () => { ignore = true }
  }, [caja.id, pagina, clave])

  const cargando = estado.clave !== clave
  const totalPaginas = Math.max(1, Math.ceil(estado.total / APERTURAS_POR_PAGINA))

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onClose() }}>
      <DialogContent overlayClassName="bg-black/60 backdrop-blur-md" className="flex max-h-[90vh] max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>Historial de la caja</DialogTitle>
          <DialogDescription>{caja?.name || 'Caja física'}: cada vez que se abrió y se cerró.</DialogDescription>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto">
        {cargando ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el historial…</p>
        ) : estado.error ? (
          <p role="alert" className="text-sm text-red-600">{estado.error}</p>
        ) : estado.aperturas.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Esta caja todavía no se ha abierto.</p>
        ) : (
          <ol aria-label="Aperturas de la caja" className="flex flex-col gap-2">
            {estado.aperturas.map((a) => (
              <li key={a.id} className="rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs">
                <p className="font-semibold text-[hsl(var(--foreground))]">
                  {a.status === 'open' ? 'Abierta' : 'Cerrada'} · abrió {a.abierta_por_email || '—'} el {fechaHora(a.abierta_at)}
                </p>
                <p>
                  Fondo {dinero(a.monto_apertura)}
                  {a.diferencia_apertura !== null && a.diferencia_apertura !== undefined && Number(a.diferencia_apertura) !== 0 && (
                    <span className={cn('font-semibold', claseDif(a.diferencia_apertura))}> · {textoDiferencia(Number(a.diferencia_apertura))} respecto del cierre anterior</span>
                  )}
                </p>
                {a.nota_apertura && <p>Nota de apertura: {a.nota_apertura}</p>}
                {a.status !== 'open' && (
                  <>
                    <p className="mt-1">
                      Cerró {a.cerrada_por_email || '—'} el {fechaHora(a.cerrada_at)} · contado {dinero(a.monto_cierre_declarado)} · esperado {dinero(a.efectivo_esperado_cierre)}
                    </p>
                    {a.diferencia_cierre !== null && a.diferencia_cierre !== undefined && (
                      <p className={cn('font-semibold', claseDif(a.diferencia_cierre))}>{textoDiferencia(Number(a.diferencia_cierre))}</p>
                    )}
                    {a.nota_cierre && <p>Nota de cierre: {a.nota_cierre}</p>}
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        </DialogBody>
        {estado.total > APERTURAS_POR_PAGINA && (
          <DialogFooter className="items-center justify-between text-xs text-[hsl(var(--muted-foreground))] sm:justify-between">
            <span>Página {pagina + 1} de {totalPaginas}</span>
            <span className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
              <Button size="sm" variant="outline" disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
            </span>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
