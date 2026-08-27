import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import {
  getCategoriesForLocal,
  patchCategory,
  patchProduct,
  postCategory,
} from '../../lib/inventoryApi'
import { fetchLocalMenuCatalog } from '../../lib/salesApi'
import { apiRequest } from '../../lib/apiClient'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import InventoryShell from './InventoryShell'
import NuevoProductoModal from './NuevoProductoModal'
import LoadingSpinner from '../LoadingSpinner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  GripVertical, Plus, Pencil, Trash2, MoreHorizontal,
  Eye, ArrowUpDown, Sparkles, UtensilsCrossed, Search,
} from 'lucide-react'

function MenuBuilderPage() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [topTab, setTopTab] = useState('edit') // edit | preview | settings

  const [menuOpenId, setMenuOpenId] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [togglingId, setTogglingId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setError('')
    setLoading(true)
    try {
      const [cats, menu] = await Promise.all([
        getCategoriesForLocal(localId),
        fetchLocalMenuCatalog(localId, { includeInactive: true }),
      ])

      const fromApi = (Array.isArray(cats) ? cats : [])
        .filter((c) => c?.id && c?.name)
        .map((c) => ({
          id: String(c.id),
          name: String(c.name).trim(),
        }))

      const flatProducts = (menu.categories || []).flatMap((c) =>
        (c.products || []).map((p) => ({
          ...p,
          category_id: String(c.id),
          category_name: c.name,
        })),
      )

      const catList = [...fromApi]
      for (const c of menu.categories || []) {
        if (!catList.some((x) => x.id === String(c.id))) {
          catList.push({ id: String(c.id), name: c.name })
        }
      }
      catList.sort((a, b) => a.name.localeCompare(b.name, 'es'))

      setCategories(catList)
      setProducts(flatProducts)
      setSelectedCategoryId((prev) => {
        if (prev && catList.some((c) => c.id === prev)) return prev
        return catList[0]?.id || ''
      })
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el menú.')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    load()
  }, [load])

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) || null,
    [categories, selectedCategoryId],
  )

  const categoryProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => String(p.category_id || '') === String(selectedCategoryId))
      .filter((p) => !q || String(p.product_name || p.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.product_name || a.name).localeCompare(String(b.product_name || b.name), 'es'))
  }, [products, selectedCategoryId, search])

  const countsByCategory = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      const key = String(p.category_id || '')
      map.set(key, (map.get(key) || 0) + 1)
    }
    return map
  }, [products])

  const previewCategories = useMemo(() => {
    const map = new Map()
    for (const p of products) {
      if (!p.is_active) continue
      const key = String(p.category_id || '__none__')
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: p.category_name || categories.find((c) => c.id === key)?.name || 'Sin categoría',
          products: [],
        })
      }
      map.get(key).products.push(p)
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [products, categories])

  async function handleCreateCategory(e) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name || !localId) return
    setCategorySaving(true)
    try {
      await postCategory({ local_id: localId, name })
      setNewCategoryName('')
      toast.success('Categoría creada')
      await load()
    } catch (err) {
      toast.error(err?.message || 'No se pudo crear la categoría')
    } finally {
      setCategorySaving(false)
    }
  }

  async function handleRenameCategory(e) {
    e.preventDefault()
    const name = editingCategoryName.trim()
    if (!name || !editingCategoryId) return
    setCategorySaving(true)
    try {
      await patchCategory(editingCategoryId, { name })
      setEditingCategoryId('')
      setEditingCategoryName('')
      setMenuOpenId('')
      toast.success('Categoría actualizada')
      await load()
    } catch (err) {
      toast.error(err?.message || 'No se pudo renombrar')
    } finally {
      setCategorySaving(false)
    }
  }

  async function handleToggleActive(product) {
    const productId = product.product_id || product.id
    if (!productId) return
    const next = !product.is_active
    setTogglingId(String(productId))
    try {
      await patchProduct(productId, { is_active: next })
      if (product.local_product_id) {
        await apiRequest(`/local-products/${encodeURIComponent(String(product.local_product_id))}`, {
          method: 'PATCH',
          body: { is_active: next },
        })
      }
      setProducts((prev) =>
        prev.map((row) =>
          String(row.product_id || row.id) === String(productId)
            ? {
                ...row,
                is_active: next,
                product_is_active: next,
                local_product_is_active: next,
              }
            : row,
        ),
      )
      toast.success(next ? 'Visible en mesas y carta' : 'Oculto de mesas y carta')
    } catch (err) {
      toast.error(err?.message || 'No se pudo cambiar el estado')
    } finally {
      setTogglingId('')
    }
  }

  return (
    <InventoryShell>
      <div className="flex h-full min-h-0 flex-col bg-[hsl(var(--background))]">
        {/* Top tabs */}
        <div className="shrink-0 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 sm:px-6">
          <div className="flex items-end gap-6 pt-4">
            <div className="mr-auto pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]">
                  <UtensilsCrossed className="h-4 w-4" />
                </span>
                <div>
                  <h1 className="text-lg font-black tracking-tight text-[hsl(var(--foreground))]">
                    Creador de menú
                  </h1>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {selectedLocal?.name || 'Local'} · misma carta que verás en Mesas / POS
                  </p>
                </div>
              </div>
            </div>
            {[
              { id: 'edit', label: 'Edición de menú' },
              { id: 'preview', label: 'Vista previa' },
              { id: 'settings', label: 'Ajustes' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTopTab(tab.id)}
                className={cn(
                  'relative pb-3 text-sm font-semibold transition-colors',
                  topTab === tab.id
                    ? 'text-[hsl(var(--primary))]'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                {tab.label}
                {topTab === tab.id && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[hsl(var(--primary))]" />
                )}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading && !products.length && !categories.length ? (
          <div className="flex flex-1 items-center justify-center p-10">
            <LoadingSpinner message="Cargando menú..." />
          </div>
        ) : topTab === 'settings' ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-[hsl(var(--muted-foreground))]">
            Ajustes del menú (visibilidad pública, orden, etc.) llegarán en una siguiente iteración.
          </div>
        ) : topTab === 'preview' ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
              Vista previa de lo que aparece al pedir en <span className="font-semibold text-[hsl(var(--foreground))]">Mesas</span>
              {' '}(solo platos en venta).
            </div>
            {previewCategories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] px-6 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]">
                No hay platos en venta. Activa “En venta” en Edición de menú.
              </div>
            ) : (
              <div className="mx-auto max-w-2xl space-y-5">
                {previewCategories.map((cat) => (
                  <section key={cat.id}>
                    <h2 className="mb-2 text-sm font-bold text-[hsl(var(--foreground))]">{cat.name}</h2>
                    <div className="space-y-2">
                      {cat.products.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{p.name}</p>
                          </div>
                          <p className="shrink-0 text-sm font-black text-[hsl(var(--primary))]">
                            {formatMoney(Number(p.price) || 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_min(240px,28%)]">
            {/* ── Categories ── */}
            <aside className="flex min-h-0 flex-col border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] lg:border-b-0 lg:border-r">
              <div className="px-4 pb-2 pt-5">
                <h2 className="text-sm font-bold text-[hsl(var(--foreground))]">Categorías</h2>
                <p className="mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                  Organiza la carta por familia
                </p>
              </div>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
                {categories.length === 0 ? (
                  <p className="px-2 py-4 text-xs text-[hsl(var(--muted-foreground))]">
                    Aún no hay categorías.
                  </p>
                ) : (
                  categories.map((cat) => {
                    const active = cat.id === selectedCategoryId
                    const count = countsByCategory.get(cat.id) || 0
                    return (
                      <div key={cat.id} className="relative">
                        {editingCategoryId === cat.id ? (
                          <form
                            onSubmit={handleRenameCategory}
                            className="flex items-center gap-1 rounded-xl border border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary)/0.08)] px-2 py-1.5"
                          >
                            <input
                              value={editingCategoryName}
                              onChange={(e) => setEditingCategoryName(e.target.value)}
                              className="h-8 min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 text-sm"
                              autoFocus
                            />
                            <button type="submit" className="text-xs font-bold text-[hsl(var(--primary))]" disabled={categorySaving}>
                              OK
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategoryId(cat.id)
                              setMenuOpenId('')
                            }}
                            className={cn(
                              'group flex w-full items-center gap-2 rounded-xl px-2.5 py-2.5 text-left text-sm transition-colors',
                              active
                                ? 'bg-[hsl(var(--primary)/0.12)] font-semibold text-[hsl(var(--primary))]'
                                : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted)/0.5)]',
                            )}
                          >
                            <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-35" />
                            <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                            <span className={cn('text-[10px] tabular-nums', active ? 'opacity-80' : 'text-[hsl(var(--muted-foreground))]')}>
                              {count}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation()
                                setMenuOpenId((id) => (id === cat.id ? '' : cat.id))
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.stopPropagation()
                                  setMenuOpenId((id) => (id === cat.id ? '' : cat.id))
                                }
                              }}
                              className="rounded-md p-1 opacity-0 transition-opacity hover:bg-[hsl(var(--muted))] group-hover:opacity-100"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        )}
                        {menuOpenId === cat.id && (
                          <div className="absolute right-2 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] py-1 shadow-lg">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium hover:bg-[hsl(var(--muted)/0.6)]"
                              onClick={() => {
                                setEditingCategoryId(cat.id)
                                setEditingCategoryName(cat.name)
                                setMenuOpenId('')
                              }}
                            >
                              <Pencil className="h-3 w-3" /> Editar
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                              onClick={() => {
                                setMenuOpenId('')
                                toast.info('Eliminar categoría llegará en una próxima versión.')
                              }}
                            >
                              <Trash2 className="h-3 w-3" /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
              <form onSubmit={handleCreateCategory} className="shrink-0 border-t border-[hsl(var(--border))] p-3 space-y-2">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nombre de categoría"
                  className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)]"
                />
                <Button
                  type="submit"
                  variant="outline"
                  className="w-full justify-center gap-1.5"
                  disabled={categorySaving || !newCategoryName.trim()}
                >
                  <Plus className="h-4 w-4" /> Nueva categoría
                </Button>
              </form>
            </aside>

            {/* ── Dish list ── */}
            <section className="flex min-h-0 flex-col bg-[hsl(var(--background))]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-[hsl(var(--foreground))]">
                    {selectedCategory?.name || 'Sin categoría'}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                    <span>{categoryProducts.length} ítem{categoryProducts.length === 1 ? '' : 's'}</span>
                    <span className="text-[hsl(var(--border))]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Eye className="h-3 w-3" /> Misma carta que Mesas
                    </span>
                  </p>
                </div>
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar plato…"
                    className="h-9 w-full rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.25)]"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 sm:p-5">
                {!selectedCategoryId ? (
                  <p className="py-10 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Selecciona o crea una categoría para ver sus platos.
                  </p>
                ) : categoryProducts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card))] px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Sin platos en esta categoría</p>
                    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      Agrega un producto para que aparezca en la carta.
                    </p>
                    <Button className="mt-4 gap-1.5" onClick={() => setModalOpen(true)}>
                      <Plus className="h-4 w-4" /> Agregar plato
                    </Button>
                  </div>
                ) : (
                  categoryProducts.map((item) => {
                    const pid = String(item.product_id || item.id)
                    const active = item.is_active !== false
                    const price = Number(item.price) || 0
                    return (
                      <article
                        key={pid}
                        className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-sm transition-shadow hover:shadow-md"
                      >
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted)/0.55)] text-[hsl(var(--muted-foreground))]">
                          <UtensilsCrossed className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[hsl(var(--foreground))]">
                            {item.product_name || item.name}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-[hsl(var(--muted-foreground))]">
                            {item.is_active ? 'Disponible en mesas' : 'Oculto en mesas'}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[hsl(var(--foreground))]">
                            {formatMoney(price)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2.5 pl-2">
                          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]">
                            <span>En venta</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={active}
                              disabled={togglingId === pid}
                              onClick={() => handleToggleActive(item)}
                              className={cn(
                                'relative isolate h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors',
                                active ? 'bg-sky-500' : 'bg-[hsl(var(--muted))]',
                              )}
                            >
                              <span
                                className={cn(
                                  'pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200',
                                  active ? 'translate-x-5' : 'translate-x-0',
                                )}
                              />
                            </button>
                          </label>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-xs font-semibold text-[hsl(var(--primary))] hover:underline"
                              onClick={() => toast.info('Edición rápida de plato próximamente. Usa inventario para costos/stock.')}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:underline"
                              onClick={() => toast.info('Eliminar plato próximamente.')}
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            </section>

            {/* ── Actions ── */}
            <aside className="flex flex-col gap-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 lg:border-l lg:border-t-0">
              <p className="text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Acciones
              </p>
              <Button
                className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-3 py-2.5 text-left text-sm font-bold leading-snug"
                onClick={() => setModalOpen(true)}
                disabled={!localId}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>Agregar plato</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-3 py-2.5 text-left text-sm leading-snug"
                onClick={() => toast.info('Reconocimiento de carta con IA aún no está disponible.')}
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                <span>Continuar reconocimiento</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-3 py-2.5 text-left text-sm leading-snug"
                onClick={() => toast.info('Ordenamiento manual de platos llegará pronto.')}
              >
                <ArrowUpDown className="h-4 w-4 shrink-0" />
                <span>Ordenar platos</span>
              </Button>
              <div className="mt-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Los platos con “En venta” son exactamente los que aparecen al tomar pedido en Mesas.
                Stock y costos se gestionan en Control de stock / Recetas.
              </div>
            </aside>
          </div>
        )}
      </div>

      <NuevoProductoModal
        open={modalOpen}
        localId={localId}
        onClose={() => setModalOpen(false)}
        onSuccess={async () => {
          setModalOpen(false)
          await load()
          toast.success('Plato agregado a la carta')
        }}
      />
    </InventoryShell>
  )
}

export default MenuBuilderPage
