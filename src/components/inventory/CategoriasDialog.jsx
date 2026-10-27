import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteCategory, mensajeEliminarCategoria, patchCategory, postCategory } from '../../lib/inventoryApi'
import { cambiarColorCategoria, esColorValido, guardarOrden, moverCategoria, ordenarCategorias } from '../../lib/categoriasOrden'

const CAMPO =
  'h-9 min-w-0 flex-1 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm ' +
  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]'
const BOTON_ICONO =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] ' +
  'hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] disabled:opacity-40'

/**
 * Categorías de carta en un solo lugar (#176): nombre, color (cambiar o
 * quitar), subir, bajar y eliminar, y agregar una nueva. Valen para productos
 * y platos preparados. Antes estaban repartidas entre Menú (donde «Eliminar»
 * no funcionaba) y Control de stock.
 */
export default function CategoriasDialog({ localId, categorias = [], onClose, onCambio }) {
  const ordenadas = ordenarCategorias(categorias)
  const [nombres, setNombres] = useState({})
  const [nueva, setNueva] = useState('')
  const [ocupado, setOcupado] = useState('')
  const [error, setError] = useState('')

  const hacer = async (clave, accion, porDefecto) => {
    setOcupado(clave)
    setError('')
    try {
      await accion()
      await onCambio?.()
    } catch (e) {
      setError(clave.startsWith('eliminar') ? mensajeEliminarCategoria(e) : String(e?.detail || e?.message || porDefecto).replace(/^\d{3}:\s*/, ''))
    } finally {
      setOcupado('')
    }
  }

  const renombrar = (cat) => {
    const nombre = String(nombres[cat.id] ?? cat.name).trim()
    if (!nombre || nombre === cat.name) return
    hacer(`nombre-${cat.id}`, async () => {
      await patchCategory(cat.id, { name: nombre })
      setNombres((prev) => { const sig = { ...prev }; delete sig[cat.id]; return sig })
    }, 'No se pudo renombrar la categoría.')
  }

  const color = (cat, valor) => {
    if (valor && !esColorValido(valor)) { setError('El color debe ser #RRGGBB'); return }
    hacer(`color-${cat.id}`, () => cambiarColorCategoria(cat.id, valor || null), 'No se pudo cambiar el color.')
  }

  const mover = (cat, direccion) => {
    const cambios = moverCategoria(ordenadas, cat.id, direccion)
    if (cambios.length) hacer(`mover-${cat.id}`, () => guardarOrden(cambios), 'No se pudo cambiar el orden.')
  }

  const eliminar = (cat) => {
    if (!window.confirm(`¿Eliminar la categoría "${cat.name}"? Esta acción no se puede deshacer.`)) return
    hacer(`eliminar-${cat.id}`, () => deleteCategory(cat.id), 'No se pudo eliminar la categoría.')
  }

  const agregar = (e) => {
    e.preventDefault()
    const nombre = nueva.trim()
    if (!nombre) return
    hacer('nueva', async () => {
      await postCategory({ local_id: localId, name: nombre, is_active: true })
      setNueva('')
    }, 'No se pudo crear la categoría.')
  }

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !ocupado) onClose?.() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Categorías de carta</DialogTitle>
          <DialogDescription>Ordenan la carta de Mesas y Venta directa. Valen para productos y platos preparados.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-6 pb-6">
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {ordenadas.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Aún no hay categorías.</p>
          ) : (
            <ul aria-label="Categorías" className="max-h-[50vh] space-y-2 overflow-y-auto">
              {ordenadas.map((cat, i) => (
                <li key={cat.id} className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-2 py-2">
                  <input type="color" aria-label={`Color de ${cat.name}`} value={cat.color || '#888888'}
                    disabled={Boolean(ocupado)} onChange={(e) => color(cat, e.target.value)}
                    className="h-8 w-8 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0" />
                  <input aria-label={`Nombre de ${cat.name}`} value={nombres[cat.id] ?? cat.name}
                    onChange={(e) => setNombres((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    onBlur={() => renombrar(cat)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renombrar(cat) } }}
                    className={CAMPO} />
                  {cat.color && (
                    <button type="button" className="shrink-0 text-[11px] font-semibold text-[hsl(var(--muted-foreground))] hover:underline"
                      disabled={Boolean(ocupado)} onClick={() => color(cat, null)}>
                      Quitar color
                    </button>
                  )}
                  <button type="button" aria-label={`Subir ${cat.name}`} className={BOTON_ICONO}
                    disabled={i === 0 || Boolean(ocupado)} onClick={() => mover(cat, 'arriba')}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label={`Bajar ${cat.name}`} className={BOTON_ICONO}
                    disabled={i === ordenadas.length - 1 || Boolean(ocupado)} onClick={() => mover(cat, 'abajo')}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" aria-label={`Eliminar ${cat.name}`} className={`${BOTON_ICONO} hover:text-red-600`}
                    disabled={Boolean(ocupado)} onClick={() => eliminar(cat)}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={agregar} className="flex gap-2 border-t border-[hsl(var(--border))] pt-3">
            <label htmlFor="categorias-nueva" className="sr-only">Nombre de la nueva categoría</label>
            <input id="categorias-nueva" value={nueva} onChange={(e) => setNueva(e.target.value)}
              placeholder="Nueva categoría" className={CAMPO} />
            <Button type="submit" size="sm" disabled={!nueva.trim() || Boolean(ocupado)}>
              <Plus size={14} className="mr-1" /> Agregar
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
