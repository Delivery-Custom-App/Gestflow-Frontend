import { useEffect, useMemo, useState } from 'react'
import { PackagePlus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { filtrarCatalogo, importarItemAlLocal, listarCatalogoMaestro } from '../../lib/masterCatalogApi'
import { getAuthContext } from '../../lib/apiClient'

/**
 * Importar productos del catálogo maestro al menú del local.
 *
 * Cargar la carta de un local nuevo era hasta ahora trabajo de la app móvil.
 * Los productos llegan con precio 0 e inactivos —lo decide el backend— así que
 * la pantalla lo dice antes de importar, en vez de dejar la sorpresa para
 * después.
 */
export default function ImportarCatalogoDrawer({ localId, salesModel, onClose, onImportado, yaEnElMenu = [] }) {
  const [items, setItems] = useState(null)      // null = cargando
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [elegidos, setElegidos] = useState(() => new Set())
  const [progreso, setProgreso] = useState(null) // { hechos, total }
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    let ignore = false
    listarCatalogoMaestro({ salesModel })
      .then((filas) => { if (!ignore) { setItems(filas); setError('') } })
      .catch((e) => { if (!ignore) { setItems([]); setError(e?.message || 'No se pudo cargar el catálogo') } })
    return () => { ignore = true }
  }, [salesModel])

  const nombresEnMenu = useMemo(
    () => new Set((yaEnElMenu || []).map((n) => String(n).trim().toLowerCase())),
    [yaEnElMenu],
  )
  const visibles = useMemo(() => filtrarCatalogo(items || [], busqueda), [items, busqueda])

  const alternar = (item) => {
    setElegidos((previos) => {
      const siguiente = new Set(previos)
      if (siguiente.has(item.id)) siguiente.delete(item.id)
      else siguiente.add(item.id)
      return siguiente
    })
  }

  const importar = async () => {
    const seleccion = (items || []).filter((i) => elegidos.has(i.id))
    if (seleccion.length === 0) return
    const { businessId } = await getAuthContext()
    const fallidos = []
    const sinStock = []
    const categorias = new Set()
    let importados = 0

    setResultado(null)
    setProgreso({ hechos: 0, total: seleccion.length })
    for (const [i, item] of seleccion.entries()) {
      try {
        const producto = await importarItemAlLocal(item.id, { businessId, localId })
        importados += 1
        if (producto?.avisoStock) sinStock.push({ nombre: item.name, motivo: producto.avisoStock })
        if (item.category_name) categorias.add(item.category_name)
      } catch (e) {
        fallidos.push({ nombre: item.name, motivo: e?.message || 'error desconocido' })
      }
      setProgreso({ hechos: i + 1, total: seleccion.length })
    }
    setProgreso(null)
    setResultado({ importados, fallidos, sinStock, categorias: [...categorias] })
    setElegidos(new Set())
    if (importados > 0) onImportado?.()
  }

  const importando = progreso !== null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" role="presentation" onClick={importando ? undefined : onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col border-l border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-2xl">

        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.1)]">
              <PackagePlus size={18} className="text-[hsl(var(--primary))]" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[hsl(var(--foreground))]">Importar del catálogo</h2>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Productos ya descritos, listos para sumar a la carta</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={importando}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-40">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-800/50 dark:bg-red-950/30">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {resultado && (
            <div className="mb-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] p-3">
              <p className="text-sm font-semibold text-[hsl(var(--foreground))]">
                {resultado.importados} producto{resultado.importados === 1 ? '' : 's'} en el menú del local
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Llegan sin precio y desactivados: ponles precio en la carta para poder venderlos.
              </p>
              {resultado.categorias?.length > 0 && (
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                  Los encuentras en {resultado.categorias.length === 1 ? 'la categoría' : 'las categorías'}{' '}
                  <strong className="text-[hsl(var(--foreground))]">{resultado.categorias.join(', ')}</strong>.
                </p>
              )}
              {resultado.sinStock?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {resultado.sinStock.map((f) => (
                    <li key={f.nombre} className="text-xs text-amber-700 dark:text-amber-400">
                      {f.nombre}: quedó en el menú, pero no se pudo crear su registro de stock ({f.motivo}), así que no aparece en Control de stock.
                    </li>
                  ))}
                </ul>
              )}
              {resultado.fallidos.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {resultado.fallidos.map((f) => (
                    <li key={f.nombre} className="text-xs text-red-600 dark:text-red-400">{f.nombre}: {f.motivo}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, categoría o proveedor"
              aria-label="Buscar en el catálogo"
              className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)]"
            />
          </div>

          {items === null && <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando el catálogo…</p>}

          {items !== null && visibles.length === 0 && (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              {busqueda ? 'Ningún producto coincide con la búsqueda.' : 'El catálogo maestro está vacío.'}
            </p>
          )}

          <ul className="space-y-2">
            {visibles.map((item) => {
              const yaEsta = nombresEnMenu.has(String(item.name).trim().toLowerCase())
              const elegido = elegidos.has(item.id)
              return (
                <li key={item.id}>
                  <label className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                    yaEsta
                      ? 'border-[hsl(var(--border))] opacity-60'
                      : elegido
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.06)] cursor-pointer'
                        : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted)/0.4)] cursor-pointer'
                  }`}>
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={elegido}
                      disabled={yaEsta || importando}
                      onChange={() => alternar(item)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-[hsl(var(--foreground))]">{item.name}</span>
                      <span className="block text-xs text-[hsl(var(--muted-foreground))]">
                        {item.category_name} · {item.provider}
                      </span>
                    </span>
                    {yaEsta && (
                      <span className="shrink-0 rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">
                        Ya en el menú
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-[hsl(var(--border))] px-6 py-4">
          {importando ? (
            <div>
              <p className="mb-2 text-sm text-[hsl(var(--foreground))]">
                Importando {progreso.hechos} de {progreso.total}…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                <div
                  className="h-full rounded-full bg-[hsl(var(--primary))] transition-all"
                  style={{ width: `${Math.round((progreso.hechos / progreso.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {elegidos.size > 0
                  ? `${elegidos.size} elegido${elegidos.size === 1 ? '' : 's'}`
                  : 'Elige los productos que quieras sumar'}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cerrar</Button>
                <Button size="sm" onClick={importar} disabled={elegidos.size === 0}>
                  Importar {elegidos.size > 0 ? elegidos.size : ''}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
