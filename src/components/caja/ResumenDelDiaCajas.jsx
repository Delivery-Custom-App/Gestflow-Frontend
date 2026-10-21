import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { textoDiferencia } from '../../lib/arqueo'
import { hoyEnChile } from '../../lib/fondoEmergencia'
import { mensajeCajaFisica, resumenParaPantalla, resumenesDeHoy, sumarResumenDelDia } from '../../lib/cajaFisica'

const dinero = (v) => (v === null || v === undefined ? '—' : formatMoney(v))
const claseDif = (v) => (v === null || v === undefined ? '' : v < 0 ? 'text-red-600' : v > 0 ? 'text-amber-700' : 'text-emerald-700')

function Cifra({ id, etiqueta, valor, destacada = false, clase = '' }) {
  return (
    <div className={cn('rounded-lg border p-3', destacada ? 'border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]')}>
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{etiqueta}</span>
      <span data-testid={`dia-${id}`} className={cn('mt-1 block text-sm font-bold text-[hsl(var(--foreground))]', clase)}>{valor}</span>
    </div>
  )
}

/**
 * Resumen del día con la caja física mandando (#133): suma las aperturas de
 * hoy de todas las cajas del local. Cada apertura trae su resumen calculado por
 * el backend (fondo, ventas por medio, ingresos, retiros, esperado, contado y
 * diferencia); aquí solo se suman. Lo contado y la diferencia son de las cajas
 * ya cerradas. `version` cambia al abrir o cerrar una caja.
 */
export default function ResumenDelDiaCajas({ cajasFisicas = [], version = 0, hoy = hoyEnChile() }) {
  const [estado, setEstado] = useState({ clave: '', items: [], error: '' })
  const ids = (Array.isArray(cajasFisicas) ? cajasFisicas : []).map((c) => c.id).join(',')
  const clave = `${ids}|${version}|${hoy}`

  useEffect(() => {
    let ignore = false
    resumenesDeHoy(cajasFisicas, hoy)
      .then((items) => { if (!ignore) setEstado({ clave, items, error: '' }) })
      .catch((err) => { if (!ignore) setEstado({ clave, items: [], error: mensajeCajaFisica(err, 'No se pudo armar el resumen del día') }) })
    return () => { ignore = true }
  // Se vuelve a pedir cuando cambian las cajas, el día o se abre o cierra una (`clave`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave])

  if (estado.clave !== clave) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Armando el resumen del día…</p>
  if (estado.error) return <p role="alert" className="text-sm text-red-600">{estado.error}</p>
  if (estado.items.length === 0) return <p className="text-sm text-[hsl(var(--muted-foreground))]">Hoy todavía no se ha abierto ninguna caja en este local.</p>

  const dia = sumarResumenDelDia(estado.items)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        {dia.aperturas} apertura{dia.aperturas !== 1 ? 's' : ''} hoy · {dia.abiertas} abierta{dia.abiertas !== 1 ? 's' : ''} · {dia.cerradas} cerrada{dia.cerradas !== 1 ? 's' : ''}
        {dia.sinResumen > 0 && ` · ${dia.sinResumen} sin resumen disponible`}
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra id="fondo" etiqueta="Fondo de apertura" valor={dinero(dia.fondo)} />
        <Cifra id="ventas" etiqueta="Vendido" valor={dinero(dia.totalVendido)} />
        <Cifra id="ingresos" etiqueta="Ingresos de caja" valor={dinero(dia.ingresosCaja)} />
        <Cifra id="retiros" etiqueta="Retiros" valor={dinero(dia.retiros)} />
        <Cifra id="esperado" etiqueta="Efectivo esperado" valor={dinero(dia.esperado)} destacada />
        <Cifra id="contado" etiqueta="Contado (cajas cerradas)" valor={dia.contado === null ? 'Sin cierres' : dinero(dia.contado)} />
        <Cifra id="diferencia" etiqueta="Diferencia (cajas cerradas)" valor={dia.diferencia === null ? 'Sin cierres' : textoDiferencia(dia.diferencia)} clase={claseDif(dia.diferencia)} />
        <Cifra id="medios" etiqueta="Ventas por medio"
          valor={`Efectivo ${dinero(dia.ventas.efectivo)} · Tarjeta ${dinero(dia.ventas.tarjeta)} · Transf. ${dinero(dia.ventas.transferencia)}`} />
      </div>
      <ul aria-label="Cajas de hoy" className="flex flex-col gap-1.5">
        {estado.items.map(({ apertura, resumen }) => {
          const r = resumen ? resumenParaPantalla(resumen) : null
          const abierta = String(apertura.status) === 'open'
          return (
            <li key={apertura.id} className="grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-xs sm:grid-cols-6">
              <span className="flex items-center gap-2 font-semibold text-[hsl(var(--foreground))] sm:col-span-2">
                {apertura.cajaNombre}
                <Badge variant={abierta ? 'success' : 'destructive'}>{abierta ? 'Abierta' : 'Cerrada'}</Badge>
              </span>
              {r ? (
                <>
                  <span>Fondo {dinero(r.fondo)}</span>
                  <span>Esperado {dinero(r.esperado)}</span>
                  <span>{abierta ? 'Sin cerrar' : `Contado ${dinero(r.contado)}`}</span>
                  <span className={cn('font-semibold', claseDif(r.diferencia))}>{abierta ? '' : textoDiferencia(r.diferencia) ?? '—'}</span>
                </>
              ) : (
                <span className="text-[hsl(var(--muted-foreground))] sm:col-span-4">No se pudo leer su resumen.</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
