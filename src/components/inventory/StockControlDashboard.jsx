import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getAuthContext } from '../../lib/apiClient'
import {
  getInventoryKpisByLocal,
  getInventoryProductsPage,
  getInventoryStockList,
  patchInventoryProductUnitCost,
  patchInventoryStock,
} from '../../lib/inventoryApi'
import InventoryShell from './InventoryShell'
import LoadingSpinner from '../LoadingSpinner'
import NuevoProductoModal from './NuevoProductoModal'
import ProductsTable from './ProductsTable'
import StatusFilterCheckboxes from './StatusFilterCheckboxes'
import CategoryFilterSelect from './CategoryFilterSelect'
import '../../styles/inventory/StockControlDashboard.css'

function formatMoney(value) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const n = new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(Number(value)))
  return `$${n}`
}

function StockControlDashboard({ user, userRole, onLogout }) {
  const { localId } = useParams()

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
  const [statusFilters, setStatusFilters] = useState([])
  const pageSize = 10

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 320)
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
      const { token } = await getAuthContext()
      const payload = await getInventoryKpisByLocal(localId, token)
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
      const { token } = await getAuthContext()
      const rows = await getInventoryStockList(localId, token, {})
      const arr = Array.isArray(rows) ? rows : []
      const m = new Map()
      for (const row of arr) {
        const id = row.category_id != null ? String(row.category_id) : ''
        const name = row.category_name != null ? String(row.category_name).trim() : ''
        if (id && name) m.set(id, name)
      }
      setCategoriesCatalog(
        [...m.entries()]
          .map(([id, name]) => ({ id, name }))
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
        const { token } = await getAuthContext()
        const offset = (page - 1) * pageSize
        const { items: pageItems, total } = await getInventoryProductsPage(localId, token, {
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
        const { token } = await getAuthContext()
        await patchInventoryStock(localId, row.inventory_id, token, body)
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
        const { token } = await getAuthContext()
        await patchInventoryProductUnitCost(localId, row.product_id, token, { unitCost: unitCostClp })
        await load()
        await loadItems(currentFilters, currentPage)
      } catch (e) {
        setActionError(e?.message || 'No se pudo actualizar el costo.')
        throw e
      }
    },
    [localId, load, loadItems, currentFilters, currentPage],
  )

  return (
    <InventoryShell user={user} userRole={userRole} onLogout={onLogout} active="stock">
      <div className="inv-stock-page">
        <header className="scd-header scd-header--compact">
          <span className="scd-header-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </span>
          <div>
            <h1 className="scd-title">Control de stock</h1>
            <p className="scd-subtitle">Inventario de productos · KPIs y movimientos</p>
          </div>
        </header>

        {error ? <div className="scd-status scd-status--error">{error}</div> : null}
        {!error && loading && !data ? <LoadingSpinner message="Cargando indicadores..." /> : null}

        {data ? (
          <section className="scd-kpis" aria-label="KPIs de inventario">
            <article className="scd-kpi">
              <span className="scd-kpi-icon scd-kpi-icon--box" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3l8 4v10l-8 4-8-4V7l8-4z" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              <div>
                <p className="scd-kpi-label">Total productos</p>
                <p className="scd-kpi-value">{data.total_products ?? 0}</p>
              </div>
            </article>
            <article className="scd-kpi scd-kpi--optimal">
              <span className="scd-kpi-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <p className="scd-kpi-label">Stock óptimo</p>
                <p className="scd-kpi-value">{data.optimal_stock_count ?? 0}</p>
              </div>
            </article>
            <article className="scd-kpi scd-kpi--low">
              <span className="scd-kpi-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="scd-kpi-label">Stock bajo</p>
                <p className="scd-kpi-value">{data.low_stock_count ?? 0}</p>
              </div>
            </article>
            <article className="scd-kpi scd-kpi--critical">
              <span className="scd-kpi-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 9v4M12 17h.01M10.3 3.6L2.2 18.4A1 1 0 003.1 20h17.8a1 1 0 00.9-1.6L13.7 3.6a1 1 0 00-1.8 0z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <div>
                <p className="scd-kpi-label">Stock crítico</p>
                <p className="scd-kpi-value">{data.critical_stock_count ?? 0}</p>
              </div>
            </article>
            <article className="scd-kpi scd-kpi--value">
              <span className="scd-kpi-icon scd-kpi-icon--green" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 18V6M8 18V10M12 18V14M16 18V8M20 18V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="scd-kpi-label">Valor total</p>
                <p className="scd-kpi-value scd-kpi-value--money">{formatMoney(data.total_value)}</p>
              </div>
            </article>
          </section>
        ) : null}

        <section className="scd-panel" aria-labelledby="scd-inventory-heading">
          <div className="scd-panel-head">
            <h2 id="scd-inventory-heading">Inventario de productos</h2>
            <button type="button" className="scd-btn-new" onClick={() => setModalOpen(true)}>
              + Nuevo producto
            </button>
          </div>

          {actionError ? (
            <div className="scd-status scd-status--error scd-status--compact" role="alert">
              {actionError}
            </div>
          ) : null}

          <div className="scd-filters" role="search" aria-label="Filtrar inventario">
            <div className="scd-search">
              <span className="scd-search-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M16 16l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                placeholder="Buscar por nombre de producto…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Buscar productos por nombre"
                autoComplete="off"
              />
            </div>
            <CategoryFilterSelect value={categoryFilter} onChange={setCategoryFilter} options={categoriesCatalog} />
            <StatusFilterCheckboxes value={statusFilters} onChange={setStatusFilters} />
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
          />
        </section>

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
      </div>
    </InventoryShell>
  )
}

export default StockControlDashboard
