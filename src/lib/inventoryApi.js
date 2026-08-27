import { apiRequest } from './apiClient'
import {
  getCachedCategories,
  mergeCategoryIntoCache,
  setCachedCategories,
} from './categoryCatalogCache'
import {
  createProductWithInventory,
  fetchCategoriesForBusiness,
  fetchEnrichedInventoryForLocal,
  fetchLocal,
  paginate,
  stockStatus,
} from './v2CatalogApi'

function computeKpis(rows) {
  let optimal = 0
  let low = 0
  let critical = 0
  let totalValue = 0
  for (const row of rows) {
    const status = row.stock_status || stockStatus(row.stock_current, row.stock_min)
    if (status === 'CRITICO') critical += 1
    else if (status === 'BAJO') low += 1
    else optimal += 1
    totalValue += Number(row.total_value) || 0
  }
  return {
    total_products: rows.length,
    optimal_stock_count: optimal,
    low_stock_count: low,
    critical_stock_count: critical,
    total_inventory_value: totalValue,
  }
}

export async function getInventoryKpisByLocal(localId) {
  const { rows } = await fetchEnrichedInventoryForLocal(localId)
  return computeKpis(rows)
}

/**
 * @param {object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.search]
 * @param {string[]} [filters.status]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 */
export function buildInventoryStockListPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  if (Array.isArray(filters.status) && filters.status.length) {
    for (const s of filters.status) {
      if (s) params.append('status', String(s).toUpperCase())
    }
  }
  if (filters.limit != null && Number.isFinite(Number(filters.limit))) {
    params.set('limit', String(Math.max(1, Math.min(500, Math.floor(Number(filters.limit))))))
  }
  if (filters.offset != null && Number.isFinite(Number(filters.offset)) && Number(filters.offset) > 0) {
    params.set('offset', String(Math.max(0, Math.floor(Number(filters.offset)))))
  }
  const qs = params.toString()
  return `/inventory?local_id=${encodeURIComponent(String(localId))}${qs ? `&${qs}` : ''}`
}

export async function getInventoryStockList(localId, filters = {}) {
  const { rows } = await fetchEnrichedInventoryForLocal(localId, filters)
  if (filters.limit == null && filters.offset == null) return rows
  return paginate(rows, filters).items
}

/**
 * Listado paginado: body { items, total, limit, offset }.
 */
export function buildInventoryProductsPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.category) params.set('category', String(filters.category))
  if (filters.search && String(filters.search).trim()) params.set('search', String(filters.search).trim())
  if (Array.isArray(filters.status) && filters.status.length) {
    for (const s of filters.status) {
      if (s) params.append('status', String(s).toUpperCase())
    }
  }
  const limit = filters.limit != null ? Math.max(1, Math.min(500, Math.floor(Number(filters.limit)))) : 50
  const offset = filters.offset != null ? Math.max(0, Math.floor(Number(filters.offset))) : 0
  params.set('limit', String(limit))
  params.set('offset', String(offset))
  return `/inventory?local_id=${encodeURIComponent(String(localId))}&${params.toString()}`
}

export async function getInventoryProductsPage(localId, filters = {}) {
  const { rows } = await fetchEnrichedInventoryForLocal(localId, filters)
  return paginate(rows, {
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  })
}

/** Proveedores: aún no en Backend V2 — stubs seguros. */
export function buildInventorySuppliersForLocalPath(localId, filters = {}) {
  const params = new URLSearchParams()
  if (filters.search && String(filters.search).trim()) {
    params.set('search', String(filters.search).trim())
  }
  if (filters.category && String(filters.category).trim()) {
    params.set('category', String(filters.category).trim())
  }
  const qs = params.toString()
  return `/inventory/locals/${localId}/suppliers${qs ? `?${qs}` : ''}`
}

export async function getInventorySuppliersForLocal() {
  return []
}

/** Local por id (incluye business_id). */
export function getLocalById(localId) {
  return fetchLocal(localId)
}

export function buildSuppliersWithMetricsPath(businessId, filters = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (filters.localId && String(filters.localId).trim()) {
    params.set('local_id', String(filters.localId).trim())
  }
  if (filters.search && String(filters.search).trim()) {
    params.set('search', String(filters.search).trim())
  }
  if (filters.category && String(filters.category).trim()) {
    params.set('category', String(filters.category).trim())
  }
  return `/suppliers?${params.toString()}`
}

export async function getSuppliersWithMetricsForBusiness() {
  return []
}

export function buildSupplierDetailPath(supplierId, businessId) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  return `/suppliers/${encodeURIComponent(String(supplierId))}?${params.toString()}`
}

export async function getSupplierDetailForBusiness() {
  throw new Error('Proveedores aún no están disponibles en Backend V2')
}

export function buildSupplierPurchaseHistoryPath(supplierId, businessId, opts = {}) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  if (opts.weekFrom && String(opts.weekFrom).trim()) {
    params.set('week_from', String(opts.weekFrom).trim())
  }
  if (opts.weekTo && String(opts.weekTo).trim()) {
    params.set('week_to', String(opts.weekTo).trim())
  }
  return `/suppliers/${encodeURIComponent(String(supplierId))}/purchase-history?${params.toString()}`
}

export async function getSupplierPurchaseHistoryForBusiness() {
  return []
}

export async function postSupplier() {
  throw new Error('Proveedores aún no están disponibles en Backend V2')
}

export async function patchSupplier() {
  throw new Error('Proveedores aún no están disponibles en Backend V2')
}

export function buildSupplierKpisPath(localId, opts = {}) {
  const params = new URLSearchParams()
  params.set('local_id', String(localId))
  if (opts.year != null && Number.isFinite(Number(opts.year))) params.set('year', String(Math.floor(Number(opts.year))))
  if (opts.month != null && Number.isFinite(Number(opts.month))) {
    const m = Math.min(12, Math.max(1, Math.floor(Number(opts.month))))
    params.set('month', String(m))
  }
  return `/suppliers/kpis?${params.toString()}`
}

export async function getSupplierKpisByLocal() {
  return {
    suppliers_count: 0,
    purchases_count: 0,
    purchases_total_clp: 0,
  }
}

/** Categorías del negocio del local (V2: business_id). */
export function buildCategoriesListPath(localId) {
  return `/categories?local_id=${encodeURIComponent(String(localId))}`
}

export async function getCategoriesForLocal(localId) {
  const local = await fetchLocal(localId)
  const rows = await fetchCategoriesForBusiness(local.business_id)
  const normalized = rows.map((c) => ({
    ...c,
    is_active: true,
    local_id: localId,
  }))
  setCachedCategories(localId, normalized)
  return normalized
}

export async function loadCategoriesForLocalCached(localId) {
  const cached = getCachedCategories(localId)
  if (cached) return cached
  return getCategoriesForLocal(localId)
}

/** POST /categories — body V2 { name, business_id }; acepta local_id legacy. */
export async function postCategory(body) {
  let businessId = body.business_id || null
  if (!businessId && body.local_id) {
    const local = await fetchLocal(body.local_id)
    businessId = local.business_id
  }
  if (!businessId) throw new Error('business_id o local_id requerido para crear categoría')
  return apiRequest('/categories', {
    method: 'POST',
    body: {
      name: String(body.name || '').trim(),
      business_id: businessId,
    },
  })
}

export function patchCategory(categoryId, body) {
  return apiRequest(`/categories/${encodeURIComponent(String(categoryId))}`, {
    method: 'PATCH',
    body: { name: body.name },
  })
}

export function deleteCategory(categoryId) {
  return apiRequest(`/categories/${encodeURIComponent(String(categoryId))}`, {
    method: 'DELETE',
  })
}

export async function resolveCategoryNameForLocal(localId, rawName) {
  const trimmed = String(rawName || '').trim()
  if (!trimmed) {
    throw new Error('Indica una categoría.')
  }

  let rows = getCachedCategories(localId)
  if (!rows) {
    rows = await getCategoriesForLocal(localId)
  }

  const hit = rows.find((r) => String(r.name || '').toLowerCase() === trimmed.toLowerCase())
  if (hit) {
    return String(hit.name).trim()
  }

  const created = await postCategory({
    local_id: localId,
    name: trimmed,
  })
  const row = created && typeof created === 'object' ? created : null
  if (row?.id != null && row?.name != null) {
    mergeCategoryIntoCache(localId, { ...row, is_active: true, local_id: localId })
    return String(row.name).trim()
  }
  mergeCategoryIntoCache(localId, { id: row?.id, name: trimmed, is_active: true, local_id: localId })
  return trimmed
}

export function patchProduct(productId, body) {
  const mapped = { ...body }
  if (mapped.unitCost != null && mapped.cost == null) {
    mapped.cost = mapped.unitCost
    delete mapped.unitCost
  }
  if (mapped.unit_cost != null && mapped.cost == null) {
    mapped.cost = mapped.unit_cost
    delete mapped.unit_cost
  }
  return apiRequest(`/products/${encodeURIComponent(String(productId))}`, {
    method: 'PATCH',
    body: mapped,
  })
}

export async function postInventoryNewProduct(localId, body) {
  const categoryName = body.category || body.category_name || null
  let categoryId = body.category_id || null
  if (!categoryId && categoryName) {
    const name = await resolveCategoryNameForLocal(localId, categoryName)
    const cats = await getCategoriesForLocal(localId)
    const hit = cats.find((c) => String(c.name).toLowerCase() === String(name).toLowerCase())
    categoryId = hit?.id || null
  }

  const result = await createProductWithInventory(localId, {
    name: body.productName || body.name || body.product_name,
    category_id: categoryId,
    price: body.price ?? body.unitCost ?? body.unit_cost ?? 0,
    cost: body.unitCost ?? body.unit_cost ?? body.cost ?? 0,
    stock_actual: body.currentStock ?? body.stock_actual ?? body.stock ?? 0,
    stock_min: body.minStock ?? body.stock_min ?? 0,
    stock_max: body.maxStock ?? body.stock_max ?? null,
    stock_deduction_mode: body.stock_deduction_mode || 'DIRECT_STOCK',
  })
  return result.inventory
}

/** Actualiza stock/mín/máx vía PATCH /inventory/{id}. */
export async function patchInventoryStock(_localId, inventoryId, body) {
  const patch = {}
  if (body.stock != null) patch.stock_actual = body.stock
  if (body.stock_actual != null) patch.stock_actual = body.stock_actual
  if (body.stock_current != null) patch.stock_actual = body.stock_current
  if (body.min_stock != null) patch.stock_min = body.min_stock
  if (body.stock_min != null) patch.stock_min = body.stock_min
  if (body.max_stock != null) patch.stock_max = body.max_stock
  if (body.stock_max != null) patch.stock_max = body.stock_max
  return apiRequest(`/inventory/${encodeURIComponent(String(inventoryId))}`, {
    method: 'PATCH',
    body: patch,
  })
}

/** Actualiza costo unitario en products.cost. */
export async function patchInventoryProductUnitCost(_localId, productId, body) {
  const cost = body.unitCost ?? body.unit_cost ?? body.cost
  return apiRequest(`/products/${encodeURIComponent(String(productId))}`, {
    method: 'PATCH',
    body: { cost },
  })
}

/** Soft: desactiva el producto (V2 no tiene DELETE de inventario). */
export async function deleteInventoryItem(_localId, inventoryId) {
  const inv = await apiRequest(`/inventory/${encodeURIComponent(String(inventoryId))}`)
  if (inv?.product_id) {
    await apiRequest(`/products/${encodeURIComponent(String(inv.product_id))}`, {
      method: 'DELETE',
    })
  }
  return null
}

export async function deleteSupplier() {
  throw new Error('Proveedores aún no están disponibles en Backend V2')
}
