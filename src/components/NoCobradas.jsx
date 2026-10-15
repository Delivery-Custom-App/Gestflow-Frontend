import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '../context/AuthContext'
import { useLocals } from '../hooks/useLocals'
import { isAdminNegocioRole, isSuperAdminRole } from '../auth/roleLabel'
import { formatCLPCurrency as formatMoney } from '../lib/formatCLP'
import { hoyEnChile } from '../lib/fondoEmergencia'
import { fechaHora } from '../lib/sesiones'
import { isAlPasoLocal } from '../lib/salesModel'
import { nombreDeVendedor } from '../lib/registroTurnos'
import { listUsers } from '../lib/apiClient'
import {
  NO_COBRADAS_POR_PAGINA, TIPO_NO_COBRADA, listarNoCobradas, textosNoCobradas, totalNoCobrado, validarRango,
} from '../lib/noCobradas'

const CAMPO = 'h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))]'
const ETIQUETA = 'text-xs font-semibold text-[hsl(var(--muted-foreground))]'

/**
 * «Mesas no cobradas» del local (T-46): lo que quedó sin cobrar al cerrar la
 * caja, los pedidos de mostrador que vencieron y las mesas liberadas por el
 * administrador. Filtro por días contables (por defecto hoy), el total del
 * rango y el consumo de cada una. El dueño puede cambiar de local; el
 * encargado ve solo el suyo.
 */
export default function NoCobradas({ localId }) {
  const { userRole } = useAuth()
  const navigate = useNavigate()
  const puedeElegirLocal = isAdminNegocioRole(userRole) || isSuperAdminRole(userRole)
  const { locales } = useLocals()
  const alPaso = isAlPasoLocal(locales.find((l) => String(l.id) === String(localId)))
  const { titulo } = textosNoCobradas(alPaso)
  const hoy = hoyEnChile()
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [estado, setEstado] = useState({ clave: '', filas: [], error: '' })
  const [pagina, setPagina] = useState(0)
  const [abierta, setAbierta] = useState(null)
  const [usuarios, setUsuarios] = useState(new Map())
  const problemaRango = validarRango({ desde, hasta })
  const clave = `${localId}|${desde}|${hasta}`

  useEffect(() => {
    if (problemaRango || !localId) return undefined
    let ignore = false
    listarNoCobradas(localId, { desde, hasta })
      .then((filas) => { if (!ignore) setEstado({ clave, filas, error: '' }) })
      .catch((e) => { if (!ignore) setEstado({ clave, filas: [], error: String(e?.detail || e?.message || 'No se pudo cargar').replace(/^\d{3}:\s*/, '') }) })
    return () => { ignore = true }
  }, [localId, desde, hasta, clave, problemaRango])

  useEffect(() => {
    let ignore = false
    listUsers().then((us) => { if (!ignore) setUsuarios(new Map(us.map((u) => [String(u.id), u]))) }).catch(() => {})
    return () => { ignore = true }
  }, [])

  const cargando = !problemaRango && estado.clave !== clave
  const filas = cargando ? [] : estado.filas
  const totalPaginas = Math.max(1, Math.ceil(filas.length / NO_COBRADAS_POR_PAGINA))
  const paginaActual = Math.min(pagina, totalPaginas - 1)
  const visibles = filas.slice(paginaActual * NO_COBRADAS_POR_PAGINA, (paginaActual + 1) * NO_COBRADAS_POR_PAGINA)
  const cambiarFiltro = (setter) => (e) => { setter(e.target.value); setPagina(0); setAbierta(null) }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {puedeElegirLocal && locales.length > 1 && (
          <div className="flex flex-col gap-1">
            <label htmlFor="no-cobradas-local" className={ETIQUETA}>Local</label>
            <select id="no-cobradas-local" value={localId} className={CAMPO}
              onChange={(e) => navigate(`/local/${e.target.value}/administrativo/no-cobradas`)}>
              {locales.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="no-cobradas-desde" className={ETIQUETA}>Desde</label>
          <input id="no-cobradas-desde" type="date" value={desde} max={hoy} onChange={cambiarFiltro(setDesde)} className={CAMPO} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="no-cobradas-hasta" className={ETIQUETA}>Hasta</label>
          <input id="no-cobradas-hasta" type="date" value={hasta} max={hoy} onChange={cambiarFiltro(setHasta)} className={CAMPO} />
        </div>
      </div>

      {problemaRango && <p role="alert" className="text-sm text-red-600">{problemaRango}</p>}
      {estado.error && !cargando && <p role="alert" className="text-sm text-red-600">{estado.error}</p>}

      {!problemaRango && (
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-sm">
          {cargando ? 'Buscando…' : (
            <>Sin cobrar en el rango: <strong data-testid="total-no-cobrado">{formatMoney(totalNoCobrado(filas))}</strong> · {filas.length} {filas.length === 1 ? 'registro' : 'registros'}</>
          )}
        </div>
      )}

      {!cargando && !problemaRango && !estado.error && (
        filas.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No quedó nada sin cobrar en esas fechas.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm" aria-label={titulo}>
              <thead className="bg-[hsl(var(--muted))] text-left text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-3 py-2"><span className="sr-only">Detalle</span></th>
                  <th className="px-3 py-2">Tipo</th>
                  {!alPaso && <th className="px-3 py-2">Mesa</th>}
                  <th className="px-3 py-2">Hora</th>
                  {!alPaso && <th className="px-3 py-2">Mesero</th>}
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Cerró</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const abiertaEsta = abierta === f.evento_id
                  const consumo = Array.isArray(f.consumo) ? f.consumo : []
                  return (
                    <Fragment key={f.evento_id}>
                      <tr className="border-t border-[hsl(var(--border))]">
                        <td className="px-3 py-2">
                          <button type="button" aria-expanded={abiertaEsta} aria-label={`Ver consumo de ${f.mesa || 'pedido'}`}
                            onClick={() => setAbierta(abiertaEsta ? null : f.evento_id)} className="rounded p-1 hover:bg-[hsl(var(--muted))]">
                            {abiertaEsta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td className="px-3 py-2">{TIPO_NO_COBRADA[f.tipo] || f.tipo}</td>
                        {!alPaso && <td className="px-3 py-2">{f.mesa || '—'}</td>}
                        <td className="px-3 py-2 whitespace-nowrap">{fechaHora(f.hora)}</td>
                        {!alPaso && <td className="px-3 py-2">{f.mesero_id ? nombreDeVendedor(usuarios, f.mesero_id) : '—'}</td>}
                        <td className="px-3 py-2 text-right font-semibold">{formatMoney(Number(f.total))}</td>
                        <td className="px-3 py-2">{f.motivo || '—'}</td>
                        <td className="px-3 py-2 text-xs">{f.registrado_por_email || '—'}</td>
                      </tr>
                      {abiertaEsta && (
                        <tr className="bg-[hsl(var(--muted))]/40">
                          <td />
                          <td colSpan={alPaso ? 5 : 7} className="px-3 py-2">
                            {consumo.length === 0 ? (
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">Sin consumo registrado.</span>
                            ) : (
                              <ul aria-label={`Consumo de ${f.mesa || 'pedido'}`} className="flex flex-col gap-0.5 text-xs">
                                {consumo.map((c, i) => (
                                  <li key={`${c.producto}-${i}`} className="flex justify-between gap-3">
                                    <span>{Number(c.cantidad)} × {c.producto} ({formatMoney(Number(c.precio))})</span>
                                    <span className="font-semibold">{formatMoney(Number(c.subtotal))}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {!cargando && filas.length > NO_COBRADAS_POR_PAGINA && (
        <div className="flex items-center justify-between gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Página {paginaActual + 1} de {totalPaginas}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" disabled={paginaActual === 0} onClick={() => setPagina(paginaActual - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={paginaActual >= totalPaginas - 1} onClick={() => setPagina(paginaActual + 1)}>Siguiente</Button>
          </span>
        </div>
      )}
    </div>
  )
}
