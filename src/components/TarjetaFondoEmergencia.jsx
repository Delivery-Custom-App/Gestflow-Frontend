import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, LifeBuoy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useAuth } from '../context/AuthContext'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { getFondoDelLocal, listarMovimientos, mensajeDeErrorDelFondo, puedeManejarFondo } from '../lib/fondoEmergencia'

/** Cuántos movimientos recientes se muestran en la tarjeta. */
export const MOVIMIENTOS_EN_TARJETA = 5

function fecha(valor) {
  const d = valor ? new Date(valor) : null
  if (!d || Number.isNaN(d.getTime())) return '—'
  // dd/mm armado a mano: el formato de es-CL cambia según el navegador.
  const partes = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'numeric', timeZone: 'America/Santiago' }).formatToParts(d)
  const parte = (tipo) => String(partes.find((p) => p.type === tipo)?.value ?? '').padStart(2, '0')
  return `${parte('day')}/${parte('month')}`
}

const linkCls = 'inline-flex items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))] hover:underline'

/**
 * Fondo de emergencia en el dashboard del local (T-27): saldo, últimos
 * movimientos y acceso a la sección de Administración (T-26) para aportar,
 * usar o ver todo. Solo el dueño y el encargado. Detrás de la bandera
 * `fondoEmergencia` (la decide LocalDashboard) hasta que exista el B-09.
 */
export default function TarjetaFondoEmergencia({ localId }) {
  const { userRole } = useAuth()
  const permitido = puedeManejarFondo(userRole)
  const [estado, setEstado] = useState({ cargando: true, error: '', fondo: null, movimientos: [] })
  const destino = `/local/${localId}/administrativo/fondo-emergencia`

  useEffect(() => {
    if (!permitido || !localId) return undefined
    let ignore = false
    getFondoDelLocal(localId)
      .then(async (fondo) => {
        const movimientos = fondo ? await listarMovimientos(fondo.id, { limit: MOVIMIENTOS_EN_TARJETA }) : []
        if (!ignore) setEstado({ cargando: false, error: '', fondo, movimientos: movimientos.slice(0, MOVIMIENTOS_EN_TARJETA) })
      })
      .catch((e) => { if (!ignore) setEstado({ cargando: false, error: mensajeDeErrorDelFondo(e), fondo: null, movimientos: [] }) })
    return () => { ignore = true }
  }, [localId, permitido])

  if (!permitido) return null
  const { cargando, error, fondo, movimientos } = estado

  return (
    <Card aria-labelledby="tarjeta-fondo-titulo">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle id="tarjeta-fondo-titulo" className="flex items-center gap-2 text-sm">
            <LifeBuoy size={15} className="text-[hsl(var(--primary))]" /> Fondo de emergencia
          </CardTitle>
          {fondo && (
            <Link to={destino} className={linkCls}>
              Aportar, usar o ver todo <ChevronRight size={13} />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {cargando ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el fondo…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
        ) : !fondo ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Este local todavía no tiene fondo de emergencia.</p>
            <Link to={destino} className={linkCls}>Crear fondo de emergencia <ChevronRight size={13} /></Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
            <div className="shrink-0">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Saldo actual</p>
              <p data-testid="saldo-tarjeta-fondo" className="text-2xl font-bold text-[hsl(var(--foreground))]">{formatMoney(Number(fondo.saldo) || 0)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">Últimos movimientos</p>
              {movimientos.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay aportes ni usos.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[hsl(var(--border))]">
                  {movimientos.map((mov) => {
                    const esUso = mov.tipo === 'uso'
                    return (
                      <li key={mov.id} className="flex items-center gap-3 py-1.5 text-sm">
                        <span className="w-12 shrink-0 text-xs text-[hsl(var(--muted-foreground))]">{fecha(mov.created_at)}</span>
                        <span className="w-14 shrink-0 text-xs">{esUso ? 'Uso' : 'Aporte'}</span>
                        <span className={cn('w-24 shrink-0 text-right font-semibold', esUso ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400')}>
                          {esUso ? '− ' : '+ '}{formatMoney(Number(mov.monto) || 0)}
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
