import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, UtensilsCrossed } from 'lucide-react'
import { cambiarEnVentaEnLocal, removeFromLocalMenu } from '../../../lib/inventoryApi'
import { listarPlatosPreparados, margenDe } from '../../../lib/inventarioUnificado'
import { formatCLPDisplay as formatMoney } from '../../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { InterruptorEnVenta } from '../ProductsTable'
import CategoryFilterSelect from '../CategoryFilterSelect'
import EditarProductoModal from '../EditarProductoModal'
import NuevoProductoModal from '../NuevoProductoModal'
import LoadingSpinner from '../../LoadingSpinner'

/**
 * Inventario · Platos preparados (#174): lo del Menú para los productos que
 * se preparan. Una tarjeta por plato con «En venta» (solo este local),
 * precio, costo, margen, Editar y Quitar del menú.
 */
export default function PlatosPreparados({ localId, categorias = [], onCambio }) {
  const [platos, setPlatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('')
  const [editando, setEditando] = useState(null)
  const [nuevoAbierto, setNuevoAbierto] = useState(false)
  const [togglingId, setTogglingId] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPlatos(await listarPlatosPreparados(localId))
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los platos preparados.')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => { cargar() }, [cargar])

  // Un plato que deja de prepararse pasa a Productos: se avisa para que se recargue.
  const recargarTodo = async () => { await cargar(); await onCambio?.() }

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return platos.filter((p) => (!q || String(p.name).toLowerCase().includes(q)) && (!categoria || p.category_id === categoria))
  }, [platos, busqueda, categoria])

  const cambiarEnVenta = async (plato) => {
    const siguiente = !plato.en_venta
    const id = String(plato.local_product_id)
    const marcar = (v) => setPlatos((prev) => prev.map((p) => (String(p.local_product_id) === id ? { ...p, en_venta: v } : p)))
    setTogglingId(id)
    setError('')
    marcar(siguiente)
    try {
      await cambiarEnVentaEnLocal(plato.local_product_id, siguiente)
    } catch (e) {
      marcar(!siguiente)
      setError(e?.message || 'No se pudo cambiar «En venta».')
    } finally {
      setTogglingId('')
    }
  }

  const quitarDelMenu = async (plato) => {
    if (!window.confirm(`¿Quitar "${plato.name}" del menú de este local? El producto sigue existiendo en el negocio y en los otros locales.`)) return
    setError('')
    try {
      await removeFromLocalMenu(plato.local_product_id)
      setEditando(null)
      setPlatos((prev) => prev.filter((p) => String(p.local_product_id) !== String(plato.local_product_id)))
    } catch (e) {
      setError(e?.message || 'No se pudo quitar del menú.')
    }
  }

  return (
    <section aria-labelledby="inventario-platos" className="flex flex-col gap-4">
      <h2 id="inventario-platos" className="sr-only">Platos preparados</h2>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true"><Search size={16} /></span>
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar plato…"
            aria-label="Buscar platos preparados" autoComplete="off"
            className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]" />
        </div>
        <CategoryFilterSelect value={categoria} onChange={setCategoria} options={categorias} />
        <Button type="button" size="sm" onClick={() => setNuevoAbierto(true)}>
          <Plus size={14} className="mr-1" /> Nuevo plato preparado
        </Button>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading && platos.length === 0 ? (
        <LoadingSpinner message="Cargando platos…" />
      ) : visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center">
          <p className="text-sm font-semibold text-[hsl(var(--foreground))]">{platos.length ? 'Ningún plato coincide con la búsqueda.' : 'Todavía no hay platos preparados.'}</p>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Son los productos que van a la comanda de cocina y no se cuentan por unidades.</p>
        </div>
      ) : (
        <ul aria-label="Platos preparados" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((p) => {
            const margen = margenDe({ price: p.price, cost: p.cost })
            return (
              <li key={p.local_product_id || p.id} className="flex flex-col gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]" aria-hidden="true">
                    <UtensilsCrossed size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[hsl(var(--foreground))]">{p.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{p.category_name}</p>
                  </div>
                  {p.local_product_id && (
                    <InterruptorEnVenta nombre={p.name} enVenta={p.en_venta} disabled={togglingId === String(p.local_product_id)}
                      onCambiar={() => cambiarEnVenta(p)} />
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Precio</dt>
                    <dd className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{formatMoney(p.price)}</dd>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Costo</dt>
                    <dd className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{p.cost == null ? '—' : formatMoney(p.cost)}</dd>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--muted)/0.5)] px-2 py-1.5">
                    <dt className="text-[10px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Margen</dt>
                    <dd className="text-sm font-bold tabular-nums text-[hsl(var(--foreground))]">{margen == null ? '—' : formatMoney(margen)}</dd>
                  </div>
                </dl>
                <div className="flex items-center justify-end gap-3">
                  {p.local_product_id && (
                    <button type="button" className="text-xs font-semibold text-red-600 hover:underline" aria-label={`Quitar ${p.name} del menú`}
                      onClick={() => quitarDelMenu(p)}>
                      Quitar del menú
                    </button>
                  )}
                  <Button type="button" size="sm" variant="outline" aria-label={`Editar ${p.name}`} onClick={() => setEditando(p)}>Editar</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {editando && (
        <EditarProductoModal localId={localId} producto={editando} categorias={categorias}
          onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); recargarTodo() }} />
      )}
      <NuevoProductoModal open={nuevoAbierto} localId={localId} platoPreparado onClose={() => setNuevoAbierto(false)} onSuccess={recargarTodo} />
    </section>
  )
}
