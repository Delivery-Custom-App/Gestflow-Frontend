import { useEffect, useState } from 'react'
import { X, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cambiarSiSePrepara, getInventarioDelProducto } from '../../lib/inventoryApi'
import { sePrepara } from '../../lib/tipoProducto'
import InterruptorSePrepara from './InterruptorSePrepara'

const numInputCls =
  'h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm shadow-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

const soloDigitos = (val) => val.replace(/\D/g, '')

/**
 * Editar un producto: si se prepara o se cuenta por unidades. Al apagarlo se
 * piden el stock actual y el mínimo en este local (si ya tenía, vienen
 * cargados). El tipo es del producto, así que vale para todos los locales.
 */
export default function EditarProductoModal({ localId, producto, onClose, onSaved }) {
  const productId = producto.product_id || producto.id
  const [prepara, setPrepara] = useState(() => sePrepara(producto))
  const [stockActual, setStockActual] = useState('0')
  const [stockMin, setStockMin] = useState('0')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // Si tiene stock en este local, se parte de esos números.
  useEffect(() => {
    let ignore = false
    getInventarioDelProducto(localId, productId)
      .then((fila) => {
        if (ignore || !fila) return
        setStockActual(String(Math.round(Number(fila.stock_actual) || 0)))
        setStockMin(String(Math.round(Number(fila.stock_min) || 0)))
      })
      .catch(() => { /* sin datos previos: se parte de 0 */ })
    return () => { ignore = true }
  }, [localId, productId])

  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true)
    setError('')
    try {
      await cambiarSiSePrepara(localId, productId, { prepara, stockActual, stockMin })
      onSaved?.({ ...producto, stock_deduction_mode: prepara ? 'RECIPE_BASED' : 'DIRECT_STOCK' })
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el producto.')
      setGuardando(false)
    }
  }

  const cerrar = () => { if (!guardando) onClose?.() }

  return (
    <div className="fixed inset-0" style={{ zIndex: 500 }}>
      <div role="presentation" className="absolute inset-0 bg-black/60" onClick={cerrar} />
      <div role="dialog" aria-modal="true" aria-labelledby="editar-producto-titulo"
        className="absolute inset-y-0 right-0 w-full max-w-lg bg-[hsl(var(--card))] shadow-2xl border-l border-[hsl(var(--border))] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[hsl(var(--border))] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <Pencil className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div className="min-w-0">
              <h2 id="editar-producto-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">Editar producto</h2>
              <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{producto.product_name || producto.name}</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={cerrar} disabled={guardando}
            className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50">
            <X className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          </button>
        </div>

        <form id="editar-producto-form" onSubmit={guardar} className="flex-1 overflow-y-auto flex flex-col gap-5 px-6 py-6">
          {error && (
            <p className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">{error}</p>
          )}

          <InterruptorSePrepara id="ep-se-prepara" checked={prepara} onChange={setPrepara} disabled={guardando} />

          {!prepara && (
            <fieldset className="border border-[hsl(var(--border))] rounded-lg px-4 pb-4 pt-2">
              <legend className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide px-1">
                Stock en este local
              </legend>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ep-stock-actual">Actual</Label>
                  <input id="ep-stock-actual" type="text" inputMode="numeric" value={stockActual}
                    onChange={(ev) => setStockActual(soloDigitos(ev.target.value))} disabled={guardando} className={numInputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ep-stock-min">Mínimo</Label>
                  <input id="ep-stock-min" type="text" inputMode="numeric" value={stockMin}
                    onChange={(ev) => setStockMin(soloDigitos(ev.target.value))} disabled={guardando} className={numInputCls} />
                </div>
              </div>
            </fieldset>
          )}

          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Este cambio vale para el producto en todos los locales del negocio.
          </p>
        </form>

        <div className="shrink-0 border-t border-[hsl(var(--border))] px-6 py-4 flex gap-2 justify-end">
          <Button type="button" variant="outline" onClick={cerrar} disabled={guardando}>Cancelar</Button>
          <Button type="submit" form="editar-producto-form" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  )
}
