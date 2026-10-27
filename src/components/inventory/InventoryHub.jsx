import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { HelpCircle, LayoutDashboard, Package, UtensilsCrossed, X } from 'lucide-react'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import { useInventarioDelLocal } from '../../hooks/useInventarioDelLocal'
import { cn } from '@/lib/utils'
import InventoryShell from './InventoryShell'
import ResumenInventario from './unificado/ResumenInventario'
import ProductosInventario from './unificado/ProductosInventario'
import PlatosPreparados from './unificado/PlatosPreparados'

/** Las partes de Inventario y su dirección (`/inventario`, `/inventario/productos`, `/inventario/platos`). */
const PARTES_INVENTARIO = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard, ruta: '' },
  { id: 'productos', label: 'Productos', icon: Package, ruta: 'productos' },
  { id: 'platos', label: 'Platos preparados', icon: UtensilsCrossed, ruta: 'platos' },
]

const GUIA = [
  { titulo: 'Resumen', texto: 'Cómo está el stock: los indicadores, la distribución óptimo, bajo y crítico, lo que hay que reponer (con «Sumar»), los movimientos de hoy y los más vendidos de la semana.' },
  { titulo: 'Productos', texto: 'Los productos que se cuentan por unidades: precio, costo, stock, estado y «En venta». Desde cada fila se suma lo que llegó, se corrige el conteo, se registra una merma o se ve el historial.' },
  { titulo: 'Platos preparados', texto: 'Los que se preparan y van a la comanda de cocina: no llevan stock por unidades. Se editan y se ponen o se quitan de la venta.' },
  { titulo: '«En venta»', texto: 'Encendido, el producto aparece en la carta de Mesas y Venta directa; apagado, se oculta. Vale solo para este local.' },
  { titulo: 'Para todos los locales', texto: 'El nombre, el precio, el costo y la categoría son del negocio: al cambiarlos cambian en todos los locales. El stock y «En venta» son de cada local.' },
]

/**
 * Inventario en una sola sección (#174): Resumen · Productos · Platos
 * preparados. Reemplaza a Estado Inventario, Menú y Control de stock sin
 * perder sus campos ni acciones.
 */
function InventoryHub() {
  const { localId } = useParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const selectedLocal = useSelectedLocal(localId)
  const inventario = useInventarioDelLocal(localId)
  const [guiaAbierta, setGuiaAbierta] = useState(false)
  const parte = PARTES_INVENTARIO.find((p) => p.ruta && pathname.replace(/\/+$/, '').endsWith(`/inventario/${p.ruta}`))?.id || 'resumen'

  const irA = (p) => navigate(`/local/${localId}/inventario${p.ruta ? `/${p.ruta}` : ''}`, { state: { local: selectedLocal } })
  const conConteo = (p) => (p.id === 'productos' && inventario.filas.length ? String(inventario.filas.length) : null)

  return (
    <InventoryShell>
      <div className="flex flex-col gap-5 px-5 py-6 pb-10">
        {/* Encabezado de la sección: oscuro en los dos temas, con el ámbar de la marca (como Administración). */}
        <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-[#0D0D1F] via-[#22223B] to-[#4A3410] px-5 py-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[hsl(var(--primary))]">Inventario</p>
            <h1 className="font-marca text-2xl font-bold tracking-tight">{PARTES_INVENTARIO.find((p) => p.id === parte).label}</h1>
            <p className="mt-0.5 text-sm text-white/75">{selectedLocal?.name ? `${selectedLocal.name} · ` : ''}stock, precios y lo que está en venta</p>
          </div>
          <button type="button" onClick={() => setGuiaAbierta(true)}
            className="flex min-h-9 items-center gap-1.5 self-start rounded-lg border border-white/25 bg-white/10 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/20 sm:self-auto">
            <HelpCircle size={13} />
            <span>¿Cómo funciona esta pantalla?</span>
          </button>
        </div>

        <div role="tablist" aria-label="Partes de Inventario" className="flex flex-wrap gap-2">
          {PARTES_INVENTARIO.map((p) => {
            const on = p.id === parte
            const extra = conConteo(p)
            return (
              <button key={p.id} type="button" role="tab" aria-selected={on} onClick={() => irA(p)}
                className={cn('inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm transition-colors',
                  on
                    ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] font-bold text-[hsl(var(--background))] shadow-md'
                    : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                <p.icon size={15} aria-hidden="true" />
                {p.label}
                {extra && (
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold',
                    on ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--foreground))]')}>
                    {extra}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {parte === 'resumen' && (
          <ResumenInventario localId={localId} filas={inventario.filas} loading={inventario.loading} recargar={inventario.recargar} />
        )}
        {parte === 'productos' && (
          <ProductosInventario localId={localId} salesModel={selectedLocal?.sales_model} {...inventario} />
        )}
        {parte === 'platos' && (
          <PlatosPreparados localId={localId} categorias={inventario.categorias} onCambio={inventario.recargar} />
        )}
      </div>

      {guiaAbierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onClick={() => setGuiaAbierta(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="guia-inventario" onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-4">
              <h2 id="guia-inventario" className="flex items-center gap-2 text-sm font-bold text-[hsl(var(--foreground))]">
                <HelpCircle size={16} className="text-[hsl(var(--primary))]" /> Guía — Inventario
              </h2>
              <button type="button" aria-label="Cerrar guía" onClick={() => setGuiaAbierta(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {GUIA.map((g) => (
                <div key={g.titulo} className="rounded-xl bg-[hsl(var(--muted)/0.4)] p-3">
                  <p className="mb-0.5 text-xs font-semibold text-[hsl(var(--foreground))]">{g.titulo}</p>
                  <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{g.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </InventoryShell>
  )
}

export default InventoryHub
