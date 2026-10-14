import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, LifeBuoy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import {
  TIPO_LABEL, fechaCorta, getFondo, mensajeDeErrorDelFondo, puedeManejarFondo, restaSaldo, tieneFondo,
} from '../lib/fondoEmergencia'

/** Cuántos movimientos recientes se muestran en la tarjeta. */
export const MOVIMIENTOS_EN_TARJETA = 5

const linkCls = 'inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))] hover:underline'

/**
 * Fondo de emergencia en el dashboard del local (T-27): saldo, monto fijo, lo
 * gastado en la semana y los últimos movimientos, con acceso a la sección de
 * Administración (T-26). Solo el dueño y el encargado.
 */
export default function TarjetaFondoEmergencia({ localId }) {
  const { userRole } = useAuth()
  const permitido = puedeManejarFondo(userRole)
  const [estado, setEstado] = useState({ cargando: true, error: '', fondo: null })
  const destino = `/local/${localId}/administrativo/fondo-emergencia`

  useEffect(() => {
    if (!permitido || !localId) return undefined
    let ignore = false
    getFondo(localId)
      .then((fondo) => { if (!ignore) setEstado({ cargando: false, error: '', fondo }) })
      .catch((e) => { if (!ignore) setEstado({ cargando: false, error: mensajeDeErrorDelFondo(e), fondo: null }) })
    return () => { ignore = true }
  }, [localId, permitido])

  if (!permitido) return null
  const { cargando, error, fondo } = estado
  const hay = tieneFondo(fondo)
  const ultimos = hay ? fondo.movimientos.slice(0, MOVIMIENTOS_EN_TARJETA) : []

  return (
    <Card aria-labelledby="tarjeta-fondo-titulo">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle id="tarjeta-fondo-titulo" className="flex items-center gap-2 text-sm">
            <LifeBuoy size={15} className="text-[hsl(var(--primary))]" /> Fondo de emergencia
          </CardTitle>
          {hay && (
            <Link to={destino} className={linkCls}>
              Registrar o ver todo <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el fondo…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
        ) : !hay ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local todavía no tiene fondo de emergencia.</p>
            <Link to={destino} className={linkCls}>Crear fondo de emergencia <ChevronRight size={13} /></Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
            <div className="flex shrink-0 flex-col gap-2">
              <div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">Saldo actual</p>
                <p data-testid="saldo-tarjeta-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(fondo.saldo)}</p>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Monto fijo <span data-testid="monto-fijo-tarjeta-fondo" className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(fondo.montoFijo)}</span>
                {' · '}Gastado esta semana <span data-testid="gastado-tarjeta-fondo" className="font-semibold text-[hsl(var(--foreground))]">{formatMoney(fondo.gastadoSemana)}</span>
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Últimos movimientos</p>
              {ultimos.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No hay movimientos esta semana.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[hsl(var(--border))]">
                  {ultimos.map((mov) => {
                    const resta = restaSaldo(mov.tipo)
                    return (
                      <li key={mov.id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="w-12 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{fechaCorta(mov.fecha).slice(0, 5)}</span>
                        <span className="w-20 shrink-0 text-xs">{TIPO_LABEL[mov.tipo] || mov.tipo}</span>
                        <span className={cn('w-24 shrink-0 text-right font-semibold', resta ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
                          {resta ? '− ' : '+ '}{formatMoney(mov.monto)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[hsl(var(--muted-foreground))]">{mov.motivo || '—'}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
