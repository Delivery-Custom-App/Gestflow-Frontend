/**
 * Adaptadores Frontend → GestFlow Backend V2.
 * Compone endpoints planos V2 a las formas que esperan las pantallas legacy.
 */
import { apiRequest } from './apiClient'

export function stockStatus(stockActual, stockMin) {
  const actual = Number(stockActual) || 0
  const min = Number(stockMin) || 0
  if (actual <= 0) return 'CRITICO'
  if (min > 0 && actual <= min) return 'BAJO'
  return 'OPTIMO'
}

export async function fetchLocal(localId) {
  return apiRequest(`/locals/${localId}`)
}

export async function listLocals(businessId) {
  const url = businessId
    ? `/locals?business_id=${encodeURIComponent(String(businessId))}`
    : '/locals'
  const rows = await apiRequest(url)
  return Array.isArray(rows) ? rows : []
}

export async function updateLocal(localId, body) {
  return apiRequest(`/locals/${encodeURIComponent(String(localId))}`, {
    method: 'PATCH',
    body,
  })
}

export async function fetchProductsMap() {
  const products = await apiRequest('/products')
  const map = new Map()
  for (const p of Array.isArray(products) ? products : []) {
    map.set(String(p.id), p)
  }
  return map
}

export async function fetchCategoriesForBusiness(businessId) {
  const rows = await apiRequest('/categories')
  const list = Array.isArray(rows) ? rows : []
  if (!businessId) return list
  return list.filter((c) => String(c.business_id) === String(businessId))
}

/**
 * Filas de inventario enriquecidas para un local (compat UI inventario).
 */
export async function fetchEnrichedInventoryForLocal(localId, filters = {}) {
  const [inventory, productsMap, local, categories] = await Promise.all([
    apiRequest('/inventory'),
    fetchProductsMap(),
    fetchLocal(localId),
    apiRequest('/categories').catch(() => []),
  ])
  const categoryMap = new Map()
  for (const c of Array.isArray(categories) ? categories : []) {
    categoryMap.set(String(c.id), c.name)
  }
  const rows = (Array.isArray(inventory) ? inventory : [])
    .filter((row) => String(row.local_id) === String(localId))
    .map((row) => {
      const product = productsMap.get(String(row.product_id)) || {}
      const stockActual = Number(row.stock_actual) || 0
      const stockMin = Number(row.stock_min) || 0
      const unitCost = Number(product.cost) || 0
      const price = Number(product.price) || 0
      const status = stockStatus(stockActual, stockMin)
      const categoryId = product.category_id || null
      return {
        id: row.id,
        inventory_id: row.id,
        local_id: row.local_id,
        product_id: row.product_id,
        product_name: product.name || 'Producto',
        name: product.name || 'Producto',
        category_id: categoryId,
        category: categoryId,
        category_name: categoryId ? categoryMap.get(String(categoryId)) || null : null,
        stock_actual: stockActual,
        stock_current: stockActual,
        stock: stockActual,
        stock_min: stockMin,
        stock_max: row.stock_max != null ? Number(row.stock_max) : null,
        unit_cost: unitCost,
        unit_cost_clp: Math.round(unitCost),
        cost: unitCost,
        price,
        total_value: stockActual * unitCost,
        status,
        stock_status: status,
        is_active: product.is_active !== false,
        updated_at: row.updated_at,
        business_id: local?.business_id || product.business_id || null,
      }
    })

  let filtered = rows
  if (filters.category) {
    filtered = filtered.filter((r) => String(r.category_id) === String(filters.category))
  }
  if (filters.search && String(filters.search).trim()) {
    const q = String(filters.search).trim().toLowerCase()
    filtered = filtered.filter((r) => String(r.product_name).toLowerCase().includes(q))
  }
  if (Array.isArray(filters.status) && filters.status.length) {
    const wanted = new Set(filters.status.map((s) => String(s).toUpperCase()))
    filtered = filtered.filter((r) => wanted.has(r.status))
  }
  return { rows: filtered, local }
}

export function paginate(items, { limit = 50, offset = 0 } = {}) {
  const lim = Math.max(1, Math.min(500, Math.floor(Number(limit)) || 50))
  const off = Math.max(0, Math.floor(Number(offset)) || 0)
  return {
    items: items.slice(off, off + lim),
    total: items.length,
    limit: lim,
    offset: off,
  }
}

export async function createProductWithInventory(localId, body) {
  const local = await fetchLocal(localId)
  const businessId = local.business_id
  if (!businessId) throw new Error('El local no tiene business_id')

  const name = String(body.name || body.product_name || '').trim()
  if (!name) throw new Error('Nombre de producto requerido')

  const price = Number(body.price ?? body.unit_price ?? 0)
  const cost = Number(body.cost ?? body.unit_cost ?? 0)
  const stockActual = Number(body.stock_actual ?? body.stock ?? 0)
  const stockMin = Number(body.stock_min ?? 0)

  const product = await apiRequest('/products', {
    method: 'POST',
    body: {
      name,
      business_id: businessId,
      category_id: body.category_id || null,
      price,
      cost,
      stock_deduction_mode: body.stock_deduction_mode || 'DIRECT_STOCK',
      is_active: body.is_active !== false,
    },
  })

  await apiRequest('/local-products', {
    method: 'POST',
    body: {
      local_id: localId,
      product_id: product.id,
      is_active: true,
    },
  })

  const inventory = await apiRequest('/inventory', {
    method: 'POST',
    body: {
      local_id: localId,
      product_id: product.id,
      stock_actual: stockActual,
      stock_min: stockMin,
      stock_max: body.stock_max ?? null,
    },
  })

  return { product, inventory, local }
}
