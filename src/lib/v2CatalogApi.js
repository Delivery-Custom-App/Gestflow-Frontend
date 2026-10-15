/**
 * Adaptadores Frontend → GestFlow Backend V2.
 * Compone endpoints planos V2 a las formas que esperan las pantallas legacy.
 */
import { apiRequest } from './apiClient'
import { invalidarLocales, obtenerLocal } from './cacheLocales'

/**
 * Estado del stock por unidades: crítico sin unidades o en su nivel crítico
 * (si lo tiene), bajo en su mínimo, y si no óptimo.
 */
export function stockStatus(stockActual, stockMin, stockCritical = null) {
  const actual = Number(stockActual) || 0
  const min = Number(stockMin) || 0
  if (actual <= 0) return 'CRITICO'
  if (stockCritical != null && stockCritical !== '' && actual <= Number(stockCritical)) return 'CRITICO'
  if (min > 0 && actual <= min) return 'BAJO'
  return 'OPTIMO'
}

/** Un local, guardado en memoria (T-35). */
export async function fetchLocal(localId) {
  return obtenerLocal(localId)
}

export async function listLocals(businessId) {
  const url = businessId
    ? `/locals?business_id=${encodeURIComponent(String(businessId))}`
    : '/locals'
  const rows = await apiRequest(url)
  return Array.isArray(rows) ? rows : []
}

export async function updateLocal(localId, body) {
  const r = await apiRequest(`/locals/${encodeURIComponent(String(localId))}`, {
    method: 'PATCH',
    body,
  })
  invalidarLocales()
  return r
}

/**
 * Datos del producto que vienen dentro de una fila de inventario o de menú
 * con `include=product` (B-12): nombre, categoría, precio, costo y modo de
 * descuento. Solo trae los productos vinculados al local, que siguen vigentes.
 */
export function productoDeFila(fila) {
  return {
    id: fila.product_id,
    name: fila.product_name,
    category_id: fila.category_id || null,
    price: fila.price,
    cost: fila.cost ?? null,
    stock_deduction_mode: fila.stock_deduction_mode,
    is_active: true,
  }
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
 *
 * Con `filters.incluirSinRegistro`, agrega los productos por unidades del
 * local que todavía no tienen stock registrado (sin fila de inventario), con
 * `sin_registro: true`: Control de stock les ofrece "Empezar a controlar
 * stock". Los indicadores de Estado Inventario no los cuentan.
 */
export async function fetchEnrichedInventoryForLocal(localId, filters = {}) {
  const lid = encodeURIComponent(String(localId))
  // A-07 (B-12): inventario y menú del local con los datos del producto dentro
  // de cada fila (`include=product`): ya no se baja el catálogo completo ni el
  // inventario de todos los locales. El empleado recibe `cost: null`.
  const [inventory, local, categories, localProducts] = await Promise.all([
    apiRequest(`/inventory?local_id=${lid}&include=product`),
    fetchLocal(localId),
    apiRequest('/categories').catch(() => []),
    filters.incluirSinRegistro ? apiRequest(`/local-products?local_id=${lid}&include=product`).catch(() => []) : Promise.resolve([]),
  ])
  const productsMap = new Map()
  for (const fila of [...(Array.isArray(inventory) ? inventory : []), ...(Array.isArray(localProducts) ? localProducts : [])]) {
    if (fila?.product_name) productsMap.set(String(fila.product_id), productoDeFila(fila))
  }
  const categoryMap = new Map()
  for (const c of Array.isArray(categories) ? categories : []) {
    categoryMap.set(String(c.id), c.name)
  }
  const rows = (Array.isArray(inventory) ? inventory : [])
    .filter((row) => String(row.local_id) === String(localId))
    // Un producto que pasó a "se prepara" conserva su fila (V2 no borra
    // inventario), pero ya no lleva stock por unidades: no se lista.
    .filter((row) => productsMap.get(String(row.product_id))?.stock_deduction_mode !== 'RECIPE_BASED')
    .map((row) => {
      const product = productsMap.get(String(row.product_id)) || {}
      const stockActual = Number(row.stock_actual) || 0
      const stockMin = Number(row.stock_min) || 0
      // Sin costo (empleado: el backend lo manda null) no se inventa un 0.
      const unitCost = product.cost == null ? null : Number(product.cost) || 0
      const price = Number(product.price) || 0
      const stockCritical = row.stock_critical != null ? Number(row.stock_critical) : null
      const status = stockStatus(stockActual, stockMin, stockCritical)
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
        stock_critical: stockCritical,
        unit_cost: unitCost,
        unit_cost_clp: unitCost == null ? null : Math.round(unitCost),
        cost: unitCost,
        price,
        total_value: unitCost == null ? null : stockActual * unitCost,
        status,
        stock_status: status,
        is_active: product.is_active !== false,
        updated_at: row.updated_at,
        business_id: local?.business_id || product.business_id || null,
      }
    })

  // Productos por unidades del local que todavía no tienen stock registrado.
  const conFila = new Set(rows.map((r) => String(r.product_id)))
  const sinRegistro = (Array.isArray(localProducts) ? localProducts : [])
    .filter((lp) => String(lp.local_id) === String(localId) && lp.is_active !== false)
    .map((lp) => productsMap.get(String(lp.product_id)))
    .filter((p) => p && !p.deleted_at && p.is_active !== false
      && p.stock_deduction_mode !== 'RECIPE_BASED' && !conFila.has(String(p.id)))
    .map((product) => {
      const categoryId = product.category_id || null
      const unitCost = product.cost == null ? null : Number(product.cost) || 0
      return {
        id: `sin-registro-${product.id}`,
        inventory_id: null,
        sin_registro: true,
        local_id: localId,
        product_id: product.id,
        product_name: product.name || 'Producto',
        name: product.name || 'Producto',
        category_id: categoryId,
        category: categoryId,
        category_name: categoryId ? categoryMap.get(String(categoryId)) || null : null,
        stock_actual: null,
        stock_current: null,
        stock: null,
        stock_min: null,
        stock_max: null,
        stock_critical: null,
        unit_cost: unitCost,
        unit_cost_clp: unitCost == null ? null : Math.round(unitCost),
        cost: unitCost,
        price: Number(product.price) || 0,
        total_value: null,
        status: null,
        stock_status: null,
        is_active: true,
        business_id: local?.business_id || product.business_id || null,
      }
    })
    .sort((a, b) => a.product_name.localeCompare(b.product_name, 'es'))

  let filtered = [...rows, ...sinRegistro]
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

  const stockDeductionMode = body.stock_deduction_mode || 'DIRECT_STOCK'
  const product = await apiRequest('/products', {
    method: 'POST',
    body: {
      name,
      business_id: businessId,
      category_id: body.category_id || null,
      price,
      cost,
      stock_deduction_mode: stockDeductionMode,
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

  // Un producto que se prepara no lleva stock: el backend rechaza su fila de inventario.
  if (stockDeductionMode === 'RECIPE_BASED') return { product, inventory: null, local }

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
