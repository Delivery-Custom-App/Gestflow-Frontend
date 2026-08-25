import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSelectedLocal } from '../../hooks/useSelectedLocal'
import {
  deleteInventoryItem,
  getInventoryKpisByLocal,
  getInventoryProductsPage,
  patchInventoryProductUnitCost,
  patchInventoryStock,
  patchProduct,
  getCategoriesForLocal,
  patchCategory,
  postCategory,
} from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import NuevoProductoModal from './NuevoProductoModal'
import ProductsTable from './ProductsTable'
import CategoryFilterSelect from './CategoryFilterSelect'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, Package, CheckCircle, TrendingDown, AlertTriangle, DollarSign, HelpCircle, X, Plus, Pencil } from 'lucide-react'
import PageTransition from '../PageTransition'
import { formatCLPDisplay as formatMoney } from '../../lib/formatCLP'
import { getCategoryTone } from '../../lib/categoryColor'

const kpiContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const kpiItemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] } },
}

const sectionVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: 0.18 } },
}

function StockControlDashboard() {
  const { localId } = useParams()
  const selectedLocal = useSelectedLocal(localId)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [items, setItems] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [itemsLoading, setItemsLoading] = useState(true)
  const [itemsError, setItemsError] = useState('')
  const [actionError, setActionError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categoriesCatalog, setCategoriesCatalog] = useState([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [categoryActionError, setCategoryActionError] = useState('')
  const [categorySaving, setCategorySaving] = useState(false)
  const [statusFilters, setStatusFilters] = useState([])
  const pageSize = 10
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim().toLowerCase()), 320)
    return () => clearTimeout(t)
  }, [searchQuery])

  const load = useCallback(async () => {
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setError('')
    try {
      const payload = await getInventoryKpisByLocal(localId)
      setData(payload)
    } catch (e) {
      setError(e?.message || 'No se pudieron cargar los KPIs de inventario.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [localId])

  /** Catálogo de categorías: listado completo del local (sin filtros) para llenar el selector (HU-47). */
  const loadCategoriesCatalog = useCallback(async () => {
    if (!localId) return
    try {
      const rows = await getCategoriesForLocal(localId)
      const arr = Array.isArray(rows) ? rows : []
      setCategoriesCatalog(
        arr
          .filter((row) => row?.id && row?.name)
          .map((row) => ({ id: String(row.id), name: String(row.name).trim(), is_active: row.is_active !== false }))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      )
    } catch {
      /* mantener opciones previas */
    }
  }, [localId])

  const currentFilters = useMemo(
    () => ({
      category: categoryFilter || undefined,
      search: debouncedSearch || undefined,
      status: statusFilters.length ? statusFilters : undefined,
    }),
    [categoryFilter, debouncedSearch, statusFilters],
  )

  const loadItems = useCallback(
    async (filters, page) => {
      if (!localId) {
        setItemsError('No se indicó un local.')
        setItemsLoading(false)
        return
      }
      setItemsError('')
      setItemsLoading(true)
      try {
        const offset = (page - 1) * pageSize
        const { items: pageItems, total } = await getInventoryProductsPage(localId, {
          ...filters,
          limit: pageSize,
          offset,
        })
        setItems(pageItems)
        setTotalCount(total)
      } catch (e) {
        setItemsError(e?.message || 'No se pudo cargar el listado de productos.')
        setItems([])
        setTotalCount(0)
      } finally {
        setItemsLoading(false)
      }
    },
    [localId, pageSize],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    loadCategoriesCatalog()
  }, [loadCategoriesCatalog])

  useEffect(() => {
    setCurrentPage(1)
  }, [categoryFilter, debouncedSearch, statusFilters])

  useEffect(() => {
    if (!localId) return
    loadItems(currentFilters, currentPage)
  }, [localId, currentFilters, currentPage, loadItems])

  useEffect(() => {
    if (categoryFilter && !categoriesCatalog.some((c) => c.id === categoryFilter)) {
      setCategoryFilter('')
    }
  }, [categoryFilter, categoriesCatalog])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  const handlePatchStock = useCallback(
    async (row, body) => {
      if (!localId) return
      setActionError('')
      try {
        await patchInventoryStock(localId, row.inventory_id, body)
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el stock.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters, currentPage],
  )

  const handlePatchUnitCost = useCallback(
    async (row, unitCostClp) => {
      if (!localId) return
      setActionError('')
      try {
        await patchInventoryProductUnitCost(localId, row.product_id, { unitCost: unitCostClp })
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el costo.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters, currentPage],
  )

  const handlePatchProductName = useCallback(
    async (row, newName) => {
      setActionError('')
      try {
        await patchProduct(row.product_id, { name: newName.trim() })
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el nombre.')
        throw e
      }
    },
    [load, loadItems, currentFilters, currentPage],
  )

  const handleDeleteItem = useCallback(
    async (row) => {
      if (!localId) return
      setActionError('')
      try {
        await deleteInventoryItem(localId, row.inventory_id)
        await load()
        setCurrentPage(1)
        await loadItems(currentFilters, 1)
      } catch (e) {
        setActionError(e?.message || 'No se pudo eliminar el producto.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters],
  )

  const handleCreateCategory = useCallback(async (event) => {
    event.preventDefault()
    const name = newCategoryName.trim()
    if (!localId || !name) return
    setCategoryActionError('')
    setCategorySaving(true)
    try {
      await postCategory({ local_id: localId, name, is_active: true })
      setNewCategoryName('')
      await loadCategoriesCatalog()
    } catch (e) {
      setCategoryActionError(e?.message || 'No se pudo crear la categoría.')
    } finally {
      setCategorySaving(false)
    }
  }, [localId, newCategoryName, loadCategoriesCatalog])

  const startEditCategory = useCallback((category) => {
    setEditingCategoryId(category.id)
    setEditingCategoryName(category.name)
    setCategoryActionError('')
  }, [])

  const handleRenameCategory = useCallback(async (event) => {
    event.preventDefault()
    const name = editingCategoryName.trim()
    if (!editingCategoryId || !name) return
    setCategoryActionError('')
    setCategorySaving(true)
    try {
      await patchCategory(editingCategoryId, { name })
      setEditingCategoryId('')
      setEditingCategoryName('')
      await loadCategoriesCatalog()
      await loadItems(currentFilters, currentPage)
    } catch (e) {
      setCategoryActionError(e?.message || 'No se pudo renombrar la categoría.')
    } finally {
      setCategorySaving(false)
    }
  }, [editingCategoryId, editingCategoryName, loadCategoriesCatalog, loadItems, currentFilters, currentPage])

  const handleKpiClick = (filterValue) => {
    if (!filterValue) { setStatusFilters([]); return }
    setStatusFilters((prev) => (prev.includes(filterValue) ? [] : [filterValue]))
  }

  const KPI_CARDS = data
    ? [
        {
          icon: <Package size={22} />,
          label: 'Total productos',
          value: data.total_products ?? 0,
          filterValue: null,
          iconColorClass: 'text-[hsl(var(--primary))]',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-700',
          valueColorClass: 'text-[hsl(var(--foreground))]',
          activeRing: '',
        },
        {
          icon: <CheckCircle size={22} />,
          label: 'Stock óptimo',
          value: data.optimal_stock_count ?? 0,
          filterValue: 'OPTIMO',
          iconColorClass: 'text-emerald-600',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-500',
          valueColorClass: 'text-emerald-700',
          activeRing: 'ring-2 ring-emerald-400',
        },
        {
          icon: <TrendingDown size={22} />,
          label: 'Stock bajo',
          value: data.low_stock_count ?? 0,
          filterValue: 'BAJO',
          iconColorClass: 'text-amber-600',
          iconBgClass: 'bg-amber-50',
          accentClass: 'border-l-amber-500',
          valueColorClass: 'text-amber-700',
          activeRing: 'ring-2 ring-amber-400',
        },
        {
          icon: <AlertTriangle size={22} />,
          label: 'Stock crítico',
          value: data.critical_stock_count ?? 0,
          filterValue: 'CRITICO',
          iconColorClass: 'text-red-600',
          iconBgClass: 'bg-red-50',
          accentClass: 'border-l-red-500',
          valueColorClass: 'text-red-700',
          activeRing: 'ring-2 ring-red-400',
        },
        {
          icon: <DollarSign size={22} />,
          label: 'Valor total',
          value: formatMoney(data.total_value),
          filterValue: null,
          noClick: true,
          iconColorClass: 'text-[hsl(var(--primary))]',
          iconBgClass: 'bg-emerald-50',
          accentClass: 'border-l-emerald-700',
          valueColorClass: 'text-[hsl(var(--primary))]',
          activeRing: '',
        },
      ]
    : []

  return (
    <>
      <AnimatePresence>
        {guideOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setGuideOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }} transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
                <div className="flex items-center gap-2">
                  <HelpCircle size={16} className="text-[hsl(var(--primary))]" />
                  <h3 className="text-sm font-bold text-[hsl(var(--foreground))]">Guía — Stock de Productos</h3>
                </div>
                <button onClick={() => setGuideOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { icon: Package, color: 'text-[hsl(var(--primary))]', title: 'Lista de productos', desc: 'Tabla con todos los ingredientes y productos del inventario. Muestra nombre, cantidad actual, costo unitario y estado de stock.' },
                  { icon: AlertTriangle, color: 'text-red-600', title: 'Alertas de stock', desc: 'Los indicadores superiores muestran cuántos productos están en stock crítico, bajo, o sin stock. Haz clic en cada indicador para filtrar la lista.' },
                  { icon: Search, color: 'text-indigo-600', title: 'Búsqueda y filtros', desc: 'Busca productos por nombre o filtra por categoría y estado de stock para encontrar rápidamente lo que necesitas reponer.' },
                  { icon: DollarSign, color: 'text-emerald-600', title: 'Valor total', desc: 'Suma del valor monetario de todo el inventario actual, calculado con el costo unitario de cada producto.' },
                  { icon: CheckCircle, color: 'text-emerald-600', title: 'Agregar producto', highlight: true, desc: 'Registra un nuevo ingrediente o producto en el inventario con su nombre, categoría, cantidad inicial y costo.' },
                ].map(({ icon: Icon, color, title, desc, highlight }) => (
                  <div key={title} className={`flex gap-3 rounded-xl p-3 ${highlight ? 'bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.2)]' : 'bg-[hsl(var(--muted)/0.4)]'}`}>
                    <div className={`mt-0.5 shrink-0 ${color}`}><Icon size={15} /></div>
                    <div>
                      <p className="text-xs font-semibold text-[hsl(var(--foreground))] mb-0.5">{title}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))] leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <InventoryShell>
      <PageTransition className="flex flex-col gap-6 px-6 py-6 pb-10">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <header className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]" aria-hidden="true">
              <Package size={22} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-[hsl(var(--foreground))]">Control de stock</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Gestiona existencias y costos para decisiones de reposición</p>
            </div>
          </header>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors"
            >
              <HelpCircle size={13} />
              <span>¿Cómo funciona esta pantalla?</span>
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        ) : null}
        {!error && loading && !data ? <LoadingSpinner message="Cargando indicadores..." /> : null}

        {data ? (
          <motion.section
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
            aria-label="KPIs de inventario"
            variants={kpiContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {KPI_CARDS.map((kpi) => {
              const isActive = kpi.filterValue && statusFilters.includes(kpi.filterValue)
              const isClickable = !kpi.noClick
              return (
                <motion.div
                  key={kpi.label}
                  variants={kpiItemVariants}
                  whileHover={isClickable ? { scale: 1.04, y: -4, transition: { type: 'spring', stiffness: 380, damping: 22 } } : undefined}
                  whileTap={isClickable ? { scale: 0.98 } : undefined}
                  onClick={isClickable ? () => handleKpiClick(kpi.filterValue) : undefined}
                  className={isClickable ? 'cursor-pointer' : undefined}
                  title={isClickable ? (isActive ? 'Quitar filtro' : kpi.filterValue ? `Filtrar por ${kpi.label.toLowerCase()}` : 'Ver todos los productos') : undefined}
                >
                  <Card className={`border-l-4 ${kpi.accentClass} overflow-hidden h-full transition-shadow ${isActive ? kpi.activeRing : ''}`}>
                    <CardContent className="flex items-center gap-2.5 p-3">
                      <span
                        className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${kpi.iconBgClass} ${kpi.iconColorClass}`}
                        aria-hidden="true"
                      >
                        {kpi.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-[hsl(var(--muted-foreground))] leading-tight">{kpi.label}</p>
                        <p className={`text-xl font-bold leading-tight mt-0.5 ${kpi.valueColorClass}`}>{kpi.value}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.section>
        ) : null}

        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-base">Categorías de carta</CardTitle>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">Crea y renombra las familias que ordenan tus productos.</p>
              </div>
              <form onSubmit={handleCreateCategory} className="flex gap-2 w-full sm:w-auto">
                <input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nueva categoría"
                  className="h-9 min-w-0 flex-1 sm:w-52 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
                <Button type="submit" size="sm" disabled={categorySaving || !newCategoryName.trim()}>
                  <Plus size={14} className="mr-1" /> Crear
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {categoryActionError ? <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{categoryActionError}</div> : null}
            <div className="flex flex-wrap gap-2">
              {categoriesCatalog.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Aún no hay categorías.</p>
              ) : categoriesCatalog.map((category) => (
                editingCategoryId === category.id ? (
                  <form key={category.id} onSubmit={handleRenameCategory} className="flex items-center gap-2 rounded-full border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/10 px-2 py-1">
                    <input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="h-8 w-40 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm focus:outline-none"
                      autoFocus
                    />
                    <button type="submit" disabled={categorySaving} className="text-xs font-bold text-[hsl(var(--primary))]">Guardar</button>
                    <button type="button" onClick={() => setEditingCategoryId('')} className="text-xs text-[hsl(var(--muted-foreground))]">Cancelar</button>
                  </form>
                ) : (
                  (() => {
                    const tone = getCategoryTone(category)
                    return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => startEditCategory(category)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                    style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone.rail }} />
                    {category.name}
                    <Pencil size={12} className="opacity-65" />
                  </button>
                    )
                  })()
                )
              ))}
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={sectionVariants} initial="hidden" animate="visible">
        <Card aria-labelledby="scd-inventory-heading">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle id="scd-inventory-heading" className="text-base">Inventario de productos</CardTitle>
              <Button type="button" onClick={() => setModalOpen(true)}>
                Nuevo producto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            {actionError ? (
              <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2" role="alert">
                {actionError}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 items-center" role="search" aria-label="Filtrar inventario">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" aria-hidden="true">
                  <Search size={16} />
                </span>
                <input
                  type="search"
                  placeholder="Buscar por nombre de producto…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Buscar productos por nombre"
                  autoComplete="off"
                  className="h-9 w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
                />
              </div>
              <CategoryFilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categoriesCatalog} />
            </div>

            <ProductsTable
              items={items}
              loading={itemsLoading}
              error={itemsError}
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onEmptyAction={() => setModalOpen(true)}
              onPatchStock={handlePatchStock}
              onPatchUnitCost={handlePatchUnitCost}
              onPatchProductName={handlePatchProductName}
              onDeleteItem={handleDeleteItem}
              statusFilters={statusFilters}
            />
          </CardContent>
        </Card>
        </motion.div>

        <NuevoProductoModal
          open={modalOpen}
          localId={localId}
          onClose={() => setModalOpen(false)}
          onSuccess={() => {
            setCurrentPage(1)
            load()
            loadCategoriesCatalog()
            loadItems(currentFilters, 1).catch(() => {})
          }}
        />
      </PageTransition>
    </InventoryShell>
    </>
  )
}

export default StockControlDashboard
