import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const CAMPO =
  'h-10 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm shadow-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'

const soloDigitos = (val) => val.replace(/\D/g, '')

const TITULO = {
  sumar: 'Sumar unidades',
  corregir: 'Corregir conteo',
  empezar: 'Empezar a controlar stock',
}

/**
 * Registrar el stock por unidades de un producto:
 * - `sumar`: llegó mercadería; se suma a lo que hay, sin calcular a mano.
 * - `corregir`: el conteo físico no coincide; el stock pasa a ser lo contado.
 * - `empezar`: el producto todavía no tiene stock registrado en el local.
 * `onGuardar(datos)` hace la llamada; si falla, el error se muestra aquí.
 */
export default function RegistrarStockModal({ modo, row, onGuardar, onClose }) {
  const actual = Number(row?.stock_current ?? 0)
  const [cantidad, setCantidad] = useState('')
  const [minimo, setMinimo] = useState('0')
  const [critico, setCritico] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const n = cantidad === '' ? null : Number(cantidad)

  const guardar = async (e) => {
    e.preventDefault()
    setError('')
    if (modo === 'sumar' && !(n > 0)) { setError('Indica cuántas unidades llegaron.'); return }
    if (modo !== 'sumar' && n == null) { setError(modo === 'corregir' ? 'Indica cuántas unidades contaste.' : 'Indica cuántas unidades hay.'); return }
    if (modo === 'empezar' && critico !== '' && Number(critico) > Number(minimo || 0)) {
      setError('El nivel crítico no puede ser mayor que el mínimo.'); return
    }
    setGuardando(true)
    try {
      await onGuardar(modo === 'empezar'
        ? { stockActual: n, stockMin: Number(minimo) || 0, stockCritical: critico === '' ? null : Number(critico) }
        : { cantidad: n })
    } catch (err) {
      setError(err?.message || 'No se pudo guardar.')
      setGuardando(false)
    }
  }

  const resultado = modo === 'sumar' && n > 0
    ? `Quedarán ${actual + n} unidades.`
    : modo === 'corregir' && n != null
      ? (n === actual ? 'Coincide con el sistema.' : `Diferencia: ${n - actual > 0 ? '+' : ''}${n - actual} unidades.`)
      : null

  return (
    <div className="fixed inset-0" style={{ zIndex: 500 }}>
      <div role="presentation" className="absolute inset-0 bg-black/60" onClick={() => !guardando && onClose()} />
      <div role="dialog" aria-modal="true" aria-labelledby="registrar-stock-titulo"
        className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
          <div className="min-w-0">
            <h2 id="registrar-stock-titulo" className="text-base font-bold text-[hsl(var(--foreground))]">{TITULO[modo]}</h2>
            <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{row?.product_name || row?.name}</p>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={guardando}
            className="rounded-lg p-1.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] disabled:opacity-40">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={guardar} className="flex flex-col gap-4 px-5 py-4">
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {modo !== 'empezar' && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              El sistema tiene <strong className="text-[hsl(var(--foreground))]">{actual}</strong> unidad{actual === 1 ? '' : 'es'}.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="registrar-stock-cantidad">
              {modo === 'sumar' ? '¿Cuántas unidades llegaron?' : modo === 'corregir' ? '¿Cuántas unidades contaste?' : 'Unidades que hay hoy'}
            </Label>
            {/* oxlint-disable-next-line react-doctor/no-autofocus -- foco en el único dato que se pide */}
            <input id="registrar-stock-cantidad" type="text" inputMode="numeric" autoFocus value={cantidad}
              onChange={(e) => setCantidad(soloDigitos(e.target.value))} disabled={guardando} className={CAMPO} />
            {resultado && <p className="text-xs font-medium text-[hsl(var(--primary))]">{resultado}</p>}
          </div>

          {modo === 'empezar' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="registrar-stock-minimo">Mínimo</Label>
                <input id="registrar-stock-minimo" type="text" inputMode="numeric" value={minimo}
                  onChange={(e) => setMinimo(soloDigitos(e.target.value))} disabled={guardando} className={CAMPO} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="registrar-stock-critico">Nivel crítico</Label>
                <input id="registrar-stock-critico" type="text" inputMode="numeric" placeholder="Opcional" value={critico}
                  onChange={(e) => setCritico(soloDigitos(e.target.value))} disabled={guardando} className={CAMPO} />
              </div>
              <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))]">
                Con el mínimo se avisa que queda poco; con el nivel crítico, que hay que reponer ya.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
