import { apiRequest } from './apiClient'

export function getInventoryKpisByLocal(localId, token) {
  return apiRequest(`/inventory/kpis/${localId}`, { token })
}

/**
 * @param {object} [filters]
 * @param {string} [filters.category] - UUID categoría
 * @param {string} [filters.search] - texto parcial nombre
 * @param {string[]} [filters.status] - uno o más: CRITICO, BAJO, OPTIMO
 * @param {number} [filters.limit] - paginación servidor (opcional)
 * @param {number} [filters.offset] - paginación servidor (opcional)
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
  return `/inventory/locals/${localId}/stock${qs ? `?${qs}` : ''}`
}

export function getInventoryStockList(localId, token, filters = {}) {
  return apiRequest(buildInventoryStockListPath(localId, filters), { token })
}

/**
 * Listado paginado (HU-42 /products): body { items, total, limit, offset }.
 * @param {object} [filters]
 * @param {number} [filters.limit] default 50
 * @param {number} [filters.offset] default 0
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
  return `/inventory/locals/${localId}/products?${params.toString()}`
}

export async function getInventoryProductsPage(localId, token, filters = {}) {
  const path = buildInventoryProductsPath(localId, filters)
  const data = await apiRequest(path, { token })
  if (!data || typeof data !== 'object') {
    return { items: [], total: 0, limit: filters.limit ?? 50, offset: filters.offset ?? 0 }
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: Number(data.total) || 0,
    limit: Number(data.limit) || 50,
    offset: Number(data.offset) || 0,
  }
}

/** Proveedores activos del negocio asociado al local. */
export function getInventorySuppliersForLocal(localId, token) {
  return apiRequest(`/inventory/locals/${localId}/suppliers`, { token })
}

/** Local por id (incluye business_id). */
export function getLocalById(localId, token) {
  return apiRequest(`/locals/${localId}`, { token })
}

/**
 * Listado de proveedores con métricas agregadas (HU-68): unidades en inventario y valor estimado (CLP).
 * GET /suppliers?business_id=
 */
export function buildSuppliersWithMetricsPath(businessId) {
  const params = new URLSearchParams()
  params.set('business_id', String(businessId))
  return `/suppliers?${params.toString()}`
}

export function getSuppliersWithMetricsForBusiness(token, businessId) {
  return apiRequest(buildSuppliersWithMetricsPath(businessId), { token })
}

/**
 * Crea un proveedor en el negocio. `business_id` opcional: el backend usa el del usuario si es admin.
 * @param {object} body - { name: string, business_id?: string }
 */
export function postSupplier(token, body) {
  return apiRequest('/suppliers', { method: 'POST', token, body })
}

/**
 * KPIs de proveedores y compras (insumos aprobados) por mes. Requiere Admin/Superadmin.
 * @param {string} localId - UUID del local (el backend resuelve el negocio).
 * @param {string} token
 * @param {{ year?: number, month?: number }} [opts] - mes calendario; por defecto mes actual en servidor.
 */
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

export function getSupplierKpisByLocal(localId, token, opts = {}) {
  return apiRequest(buildSupplierKpisPath(localId, opts), { token })
}

export function postInventoryNewProduct(localId, token, body) {
  return apiRequest(`/inventory/locals/${localId}/new-product`, {
    method: 'POST',
    token,
    body,
  })
}

/** Actualiza stock o mínimo; la API devuelve la fila con total_value recalculado (stock × costo). */
export function patchInventoryStock(localId, inventoryId, token, body) {
  return apiRequest(`/inventory/locals/${localId}/stock/${inventoryId}`, {
    method: 'PATCH',
    token,
    body,
  })
}

/** Actualiza costo unitario (products.price); respuesta con total_value recalculado. */
export function patchInventoryProductUnitCost(localId, productId, token, body) {
  return apiRequest(`/inventory/locals/${localId}/products/${productId}/unit-cost`, {
    method: 'PATCH',
    token,
    body,
  })
}
