import { useEffect, useMemo, useState } from 'react'
// recharts se carga bajo demanda: este módulo solo se importa desde páginas con React.lazy.
// oxlint-disable-next-line react-doctor/prefer-dynamic-import
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle, CheckCircle, DollarSign, Package, PackageMinus, PackagePlus, ShoppingCart, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCLPDisplay as formatMoney } from '../../../lib/formatCLP'
import { hayQueReponer, kpisDeInventario } from '../../../lib/inventarioUnificado'
import { masVendidosConMargen, mermasDeLaSemana, movimientosDelDia, movimientosDelLocal, restarDias } from '../../../lib/resumenInventario'
import { ETIQUETA_MOVIMIENTO_STOCK } from '../../../lib/movimientosStock'
import { hoyEnChile } from '../../../lib/fondoEmergencia'
import { getProductsReport } from '../../../lib/reportsApi'
import { sumarUnidades } from '../../../lib/inventoryApi'
import { formatChileTime } from '../../../utils/chileDateTime'
import RegistrarStockModal from '../RegistrarStockModal'
import StockStatusBadge from '../StockStatusBadge'

const DISTRIBUCION = [
  { id: 'optimo', label: 'Óptimo', color: 'hsl(var(--success))' },
  { id: 'bajo', label: 'Bajo', color: 'hsl(var(--warning))' },
  { id: 'critico', label: 'Crítico', color: 'hsl(var(--destructive))' },
]

function Kpi({ icon: Icon, label, value, tono, sub }) {
  return (
    <Card className={`h-full border-l-4 ${tono.borde}`}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tono.fondo} ${tono.texto}`}><Icon size={18} /></span>
        <div className="min-w-0">
          <p className="text-xs leading-tight text-[hsl(var(--muted-foreground))]">{label}</p>
          <p className="mt-0.5 text-xl font-bold text-[hsl(var(--foreground))]">{value}</p>
          {sub && <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

const TONO = {
  marca: { borde: 'border-l-[hsl(var(--primary))]', fondo: 'bg-[hsl(var(--primary)/0.12)]', texto: 'text-[hsl(var(--primary))]' },
  ok: { borde: 'border-l-emerald-500', fondo: 'bg-emerald-50 dark:bg-emerald-950', texto: 'text-emerald-600' },
  bajo: { borde: 'border-l-amber-500', fondo: 'bg-amber-50 dark:bg-amber-950', texto: 'text-amber-600' },
  critico: { borde: 'border-l-red-500', fondo: 'bg-red-50 dark:bg-red-950', texto: 'text-red-600' },
}

/**
 * Inventario · Resumen (#175): los KPI de siempre, Por reponer y Mermas de la
 * semana, la distribución del stock, «Hay que reponer» con «Sumar», los
 * movimientos del día y los más vendidos de la semana. Cuenta sobre la misma
 * lista que Productos.
 */
export default function ResumenInventario({ localId, filas = [], productos = [], loading, recargar }) {
  const kpis = useMemo(() => kpisDeInventario(filas), [filas])
  const reponer = useMemo(() => hayQueReponer(filas), [filas])
  const [sumando, setSumando] = useState(null)
  const [movs, setMovs] = useState({ movimientos: [], recortado: false, cargando: true })
  const [ranking, setRanking] = useState(null)

  // Los movimientos se vuelven a pedir solo si cambian los productos con stock o su stock.
  const claveMovs = filas.filter((f) => f.inventory_id).map((f) => `${f.inventory_id}:${f.stock_current}`).join('|')
  useEffect(() => {
    let vigente = true
    movimientosDelLocal(filas)
      .then((r) => { if (vigente) setMovs({ ...r, cargando: false }) })
      .catch(() => { if (vigente) setMovs({ movimientos: [], recortado: false, cargando: false }) })
    return () => { vigente = false }
    // `claveMovs` resume `filas`: así no se repite la consulta en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveMovs])

  useEffect(() => {
    if (!localId) return undefined
    let vigente = true
    const hoy = hoyEnChile()
    getProductsReport(localId, { startDate: restarDias(hoy, 6), endDate: hoy })
      .then((r) => { if (vigente) setRanking(Array.isArray(r?.ranking) ? r.ranking : []) })
      .catch(() => { if (vigente) setRanking([]) })
    return () => { vigente = false }
  }, [localId])

  const delDia = movimientosDelDia(movs.movimientos).slice(0, 10)
  const mermas = mermasDeLaSemana(movs.movimientos)
  const vendidos = masVendidosConMargen(ranking || [], [...filas, ...productos])
  const distribucion = DISTRIBUCION.map((d) => ({ ...d, cantidad: kpis[d.id] })).filter((d) => d.cantidad > 0)
  const conStock = kpis.optimo + kpis.bajo + kpis.critico

  const guardarSuma = async (datos) => {
    await sumarUnidades(sumando.inventory_id, datos.cantidad, datos.motivo)
    setSumando(null)
    await recargar?.()
  }

  const vacio = (texto) => <p className="py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{texto}</p>

  return (
    <section aria-labelledby="inventario-resumen" className="flex flex-col gap-4">
      <h2 id="inventario-resumen" className="sr-only">Resumen</h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Indicadores del stock">
        <Kpi icon={Package} label="Total productos" value={loading && !filas.length ? '—' : kpis.total} tono={TONO.marca} />
        <Kpi icon={CheckCircle} label="Stock óptimo" value={kpis.optimo} tono={TONO.ok} />
        <Kpi icon={TrendingDown} label="Stock bajo" value={kpis.bajo} tono={TONO.bajo} />
        <Kpi icon={AlertTriangle} label="Stock crítico" value={kpis.critico} tono={TONO.critico} />
        <Kpi icon={DollarSign} label="Valor total" value={formatMoney(kpis.valorTotal)} tono={TONO.marca} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={ShoppingCart} label="Por reponer" value={kpis.porReponer} sub="Bajo el mínimo o en su nivel crítico" tono={TONO.bajo} />
        <Kpi icon={PackageMinus} label="Mermas de la semana" value={movs.cargando ? '—' : `${mermas} u.`} sub="Unidades perdidas o vencidas" tono={TONO.critico} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-base">Distribución de stock</CardTitle></CardHeader>
          <CardContent>
            {conStock === 0 ? vacio('Sin productos con stock registrado.') : (
              <div className="flex items-center gap-4">
                <div className="h-[160px] w-[160px] shrink-0" role="img"
                  aria-label={`Distribución del stock: ${distribucion.map((d) => `${d.label} ${d.cantidad}`).join(', ')}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={distribucion} dataKey="cantidad" nameKey="label" innerRadius={48} outerRadius={74}
                        stroke="hsl(var(--card))" strokeWidth={2} isAnimationActive={false}>
                        {distribucion.map((d) => <Cell key={d.id} fill={d.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, nombre) => [`${v} productos`, nombre]}
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="min-w-0 flex-1 space-y-2" aria-label="Leyenda de la distribución">
                  {DISTRIBUCION.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                      <span className="flex-1 text-[hsl(var(--foreground))]">{d.label}</span>
                      <span className="tabular-nums font-semibold text-[hsl(var(--foreground))]">{kpis[d.id]}</span>
                      <span className="w-10 text-right tabular-nums text-xs text-[hsl(var(--muted-foreground))]">
                        {Math.round((kpis[d.id] / conStock) * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-base">Hay que reponer</CardTitle></CardHeader>
          <CardContent>
            {reponer.length === 0 ? vacio('No hay productos bajo su mínimo. Todo en orden.') : (
              <ul aria-label="Productos por reponer" className="divide-y divide-[hsl(var(--border))]">
                {reponer.slice(0, 8).map((f) => (
                  <li key={f.inventory_id} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{f.product_name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Quedan {Number(f.stock_current) || 0} · mínimo {Number(f.stock_min) || 0}</p>
                    </div>
                    <StockStatusBadge row={f} />
                    <Button type="button" size="sm" variant="outline" onClick={() => setSumando(f)} aria-label={`Sumar unidades a ${f.product_name}`}>
                      <PackagePlus size={14} className="mr-1" /> Sumar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {reponer.length > 8 && <p className="pt-2 text-xs text-[hsl(var(--muted-foreground))]">Y {reponer.length - 8} más: míralos en Productos con el filtro Bajo o Crítico.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Últimos movimientos de hoy</CardTitle></CardHeader>
          <CardContent>
            {movs.cargando ? vacio('Cargando movimientos…') : delDia.length === 0 ? vacio('Hoy no hubo movimientos de stock.') : (
              <ul aria-label="Movimientos de hoy" className="divide-y divide-[hsl(var(--border))]">
                {delDia.map((m, i) => (
                  <li key={`${m.inventory_id}-${m.created_at}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                    <span className="w-12 shrink-0 tabular-nums text-xs text-[hsl(var(--muted-foreground))]">{formatChileTime(m.created_at)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold text-[hsl(var(--foreground))]">{m.product_name}</span>
                      <span className="text-[hsl(var(--muted-foreground))]"> · {ETIQUETA_MOVIMIENTO_STOCK[m.tipo] || m.tipo}{m.actor_email ? ` · ${m.actor_email}` : ''}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold text-[hsl(var(--foreground))]">
                      {Number(m.delta) > 0 ? `+${Number(m.delta)}` : Number(m.delta) || 0}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {movs.recortado && (
              <p className="pt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Se muestran los movimientos de los primeros productos. Para los demás, abre su Historial en Productos.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Más vendidos de la semana</CardTitle></CardHeader>
          <CardContent>
            {ranking === null ? vacio('Cargando ventas…') : vendidos.length === 0 ? vacio('Sin ventas en los últimos 7 días.') : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[hsl(var(--muted-foreground))]">
                    <th className="py-1 font-medium">Producto</th>
                    <th className="py-1 text-right font-medium">Unidades</th>
                    <th className="py-1 text-right font-medium">Margen por unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {vendidos.map((v) => (
                    <tr key={v.product_id} className="border-t border-[hsl(var(--border))]">
                      <td className="py-2 font-semibold text-[hsl(var(--foreground))]">{v.nombre}</td>
                      <td className="py-2 text-right tabular-nums">{v.unidades}</td>
                      <td className="py-2 text-right tabular-nums">{v.margen == null ? '—' : formatMoney(v.margen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {sumando && (
        <RegistrarStockModal modo="sumar" row={sumando} onGuardar={guardarSuma} onClose={() => setSumando(null)} />
      )}
    </section>
  )
}
