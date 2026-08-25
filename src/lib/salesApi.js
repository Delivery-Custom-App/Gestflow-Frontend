/**
 * Adaptadores Frontend → Backend V2 (ventas / POS).
 * Normaliza enums, shapes y flujos legacy (items nested, caja activa, mesa detail).
 */
import { apiRequest, getOptionalAuthContext } from './apiClient'

const STATUS_TO_UI = {
  open: 'PENDING',
  preparing: 'PREPARING',
  ready: 'READY',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
}

const STATUS_TO_V2 = {
  PENDING: 'open',
  PREPARING: 'preparing',
  READY: 'ready',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  open: 'open',
  preparing: 'preparing',
  ready: 'ready',
  completed: 'completed',
  cancelled: 'cancelled',
}

const SOURCE_TO_V2 = {
  'dine-in': 'dine_in',
  dine_in: 'dine_in',
  DINE_IN: 'dine_in',
  mostrador: 'mostrador',
  MOSTRADOR: 'mostrador',
  takeout: 'takeout',
  delivery: 'delivery',
}

const ACTIVE_ORDER_STATUSES = new Set(['open', 'preparing', 'ready', 'PENDING', 'PREPARING', 'READY'])

export function toUiOrderStatus(status) {
  const key = String(status || '')
  return STATUS_TO_UI[key] || STATUS_TO_UI[key.toLowerCase()] || String(status || '').toUpperCase()
}

export function toV2OrderStatus(status) {
  const key = String(status || '')
  return STATUS_TO_V2[key] || STATUS_TO_V2[key.toUpperCase()] || key.toLowerCase()
}

export function toV2Source(source) {
  const key = String(source || 'mostrador')
  return SOURCE_TO_V2[key] || SOURCE_TO_V2[key.toLowerCase()] || 'mostrador'
}

function orderResourcePath(orderId, createdAt, suffix = '') {
  const base = `/orders/${encodeURIComponent(String(orderId))}${suffix}`
  if (!createdAt) return base
  const qs = new URLSearchParams({ created_at: String(createdAt) })
  return `${base}?${qs.toString()}`
}

export function mapOrderOut(order) {
  if (!order || typeof order !== 'object') return order
  return {
    ...order,
    status: toUiOrderStatus(order.status),
    status_v2: order.status,
    payment_method: order.payment_method || null,
  }
}

export function mapMesaOut(mesa) {
  if (!mesa || typeof mesa !== 'object') return mesa
  const status = String(mesa.status || 'available')
  const state = status === 'occupied' ? 'ocupada' : 'libre'
  return {
    ...mesa,
    name: mesa.nombre || mesa.name || 'Mesa',
    nombre: mesa.nombre || mesa.name,
    state,
    is_active: true,
    capacidad: mesa.capacidad ?? null,
    zona: mesa.zona ?? null,
  }
}

export function mapCajaOut(caja) {
  if (!caja || typeof caja !== 'object') return caja
  return {
    ...caja,
    name: caja.name || `Caja ${String(caja.id || '').slice(0, 8)}`,
    is_active: String(caja.status) === 'open',
    caja_id: caja.id,
  }
}

/** Caja abierta del local (preferencia: del usuario actual). */
export async function getActiveCaja(localId) {
  const rows = await apiRequest(`/cajas?local_id=${encodeURIComponent(String(localId))}`)
  const open = (Array.isArray(rows) ? rows : []).filter((c) => String(c.status) === 'open')
  if (!open.length) return null
  const { user } = await getOptionalAuthContext()
  const uid = user?.id ? String(user.id) : null
  const mine = uid ? open.find((c) => String(c.cashier_user_id) === uid) : null
  return mapCajaOut(mine || open[0])
}

export async function listCajas(localId) {
  const rows = await apiRequest(`/cajas?local_id=${encodeURIComponent(String(localId))}`)
  return (Array.isArray(rows) ? rows : []).map(mapCajaOut)
}

export async function createCajaV2({ local_id, cashier_user_id, monto_apertura = 0, name: _name }) {
  let cashierId = cashier_user_id
  if (!cashierId) {
    const { user } = await getOptionalAuthContext()
    cashierId = user?.id
  }
  if (!cashierId) throw new Error('cashier_user_id requerido para abrir caja')
  const row = await apiRequest('/cajas', {
    method: 'POST',
    body: {
      local_id,
      cashier_user_id: cashierId,
      monto_apertura: Number(monto_apertura) || 0,
    },
  })
  return mapCajaOut(row)
}

export async function listMesas(localId) {
  const rows = await apiRequest(`/mesas?local_id=${encodeURIComponent(String(localId))}`)
  return (Array.isArray(rows) ? rows : []).map(mapMesaOut)
}

export async function createMesa({ local_id, name, nombre, capacidad: _c, zona: _z }) {
  const row = await apiRequest('/mesas', {
    method: 'POST',
    body: {
      local_id,
      nombre: String(nombre || name || '').trim(),
      status: 'available',
    },
  })
  return mapMesaOut(row)
}

export async function updateMesa(mesaId, body = {}) {
  const patch = {}
  if (body.name != null || body.nombre != null) {
    patch.nombre = String(body.nombre || body.name).trim()
  }
  if (body.status != null) patch.status = body.status
  if (body.state === 'libre') patch.status = 'available'
  if (body.state === 'ocupada' || body.state === 'en_cobro') patch.status = 'occupied'
  const row = await apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}`, {
    method: 'PATCH',
    body: patch,
  })
  return mapMesaOut(row)
}

export async function setMesaLibre(mesaId) {
  return updateMesa(mesaId, { status: 'available' })
}

export async function deleteMesa() {
  throw new Error('Eliminar mesas aún no está disponible en Backend V2')
}

/**
 * Compone detalle de mesa + órdenes activas (V2 no tiene /mesas/:id/detail).
 */
export async function getMesaDetail(mesaId) {
  const mesa = mapMesaOut(await apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}`))
  const orders = await apiRequest(`/orders?local_id=${encodeURIComponent(String(mesa.local_id))}`)
  const active = (Array.isArray(orders) ? orders : []).filter(
    (o) => String(o.mesa_id) === String(mesaId) && ACTIVE_ORDER_STATUSES.has(String(o.status)),
  )

  const withItems = await Promise.all(
    active.map(async (order) => {
      try {
        const items = await apiRequest(orderResourcePath(order.id, order.created_at, '/items'))
        return mapOrderOut({ ...order, items: Array.isArray(items) ? items : [] })
      } catch {
        return mapOrderOut({ ...order, items: [] })
      }
    }),
  )

  let totalProducts = 0
  let totalValue = 0
  for (const order of withItems) {
    for (const item of order.items || []) {
      totalProducts += Number(item.quantity) || 0
      totalValue += Number(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)) || 0
    }
  }

  return {
    mesa,
    active_orders: withItems,
    total_products: totalProducts,
    total_value: totalValue,
  }
}

export async function listOrders(localId, { status } = {}) {
  const rows = await apiRequest(`/orders?local_id=${encodeURIComponent(String(localId))}`)
  let list = (Array.isArray(rows) ? rows : []).map(mapOrderOut)
  if (status) {
    const wanted = toUiOrderStatus(status)
    list = list.filter((o) => o.status === wanted || String(o.status_v2) === String(status).toLowerCase())
  }
  return list
}

export async function listOrderItems(orderId, createdAt) {
  return apiRequest(orderResourcePath(orderId, createdAt, '/items'))
}

export async function addOrderItem(orderId, body, createdAt) {
  return apiRequest(orderResourcePath(orderId, createdAt, '/items'), {
    method: 'POST',
    body: {
      product_id: body.product_id,
      quantity: Number(body.quantity) || 1,
      unit_price: Number(body.unit_price) || 0,
    },
  })
}

/**
 * Crea orden V2 (+ items en loop). Acepta body legacy con items/payment_method/source dine-in.
 */
export async function createOrder(orderData = {}) {
  let cajaId = orderData.caja_id
  if (!cajaId) {
    const caja = await getActiveCaja(orderData.local_id)
    cajaId = caja?.id || null
  }
  if (!cajaId) {
    throw new Error('No hay caja abierta en este local. Abre una caja antes de vender.')
  }

  const payload = {
    local_id: orderData.local_id,
    caja_id: cajaId,
    source: toV2Source(orderData.source || 'mostrador'),
    mesa_id: orderData.mesa_id || null,
  }

  const order = await apiRequest('/orders', { method: 'POST', body: payload })
  const items = Array.isArray(orderData.items) ? orderData.items : []
  const createdItems = []

  for (const raw of items) {
    const productId = raw.product_id || raw.recipe_id
    if (!productId) continue
    const item = await addOrderItem(
      order.id,
      {
        product_id: productId,
        quantity: raw.quantity,
        unit_price: raw.unit_price,
      },
      order.created_at,
    )
    createdItems.push(item)
  }

  // Si hay mesa, marcar ocupada (best-effort).
  if (payload.mesa_id) {
    try {
      await updateMesa(payload.mesa_id, { status: 'occupied' })
    } catch {
      /* ignore */
    }
  }

  return mapOrderOut({ ...order, items: createdItems })
}

export async function updateOrderStatus(orderId, status, createdAt) {
  const body = { status: toV2OrderStatus(status) }
  const path = orderResourcePath(orderId, createdAt)
  const updated = await apiRequest(path, { method: 'PATCH', body })
  return mapOrderOut(updated)
}

/** Completa orden (cobro efectivo). En RESTAURANT camina open→preparing→ready→completed. */
export async function completeOrderCash(orderId, _cashReceived, createdAt) {
  try {
    return await updateOrderStatus(orderId, 'completed', createdAt)
  } catch (err) {
    const msg = String(err?.message || err?.detail || '')
    if (!/transici[oó]n inv[aá]lida|400/i.test(msg)) throw err
    await updateOrderStatus(orderId, 'preparing', createdAt)
    await updateOrderStatus(orderId, 'ready', createdAt)
    return updateOrderStatus(orderId, 'completed', createdAt)
  }
}

export async function computeMesasKpis(localId) {
  const mesas = await listMesas(localId)
  const libres = mesas.filter((m) => m.state === 'libre').length
  const ocupadas = mesas.filter((m) => m.state === 'ocupada').length
  const enCobro = mesas.filter((m) => m.state === 'en_cobro').length
  return {
    total: mesas.length,
    libres,
    ocupadas,
    en_cobro: enCobro,
    total_mesas: mesas.length,
    mesas_libres: libres,
    mesas_ocupadas: ocupadas,
    mesas_en_cobro: enCobro,
    occupancy_rate: mesas.length ? Math.round((ocupadas / mesas.length) * 100) : 0,
  }
}

/**
 * Catálogo de carta del local (misma fuente para Menú y Mesas/POS).
 * - includeInactive=false → solo ítems vendibles (local-product + product activos)
 * - includeInactive=true  → todos los vinculados al local (para el creador de menú)
 *
 * Shape: { categories: [{ id, name, products: [...] }], local_id }
 */
export async function fetchLocalMenuCatalog(localId, { search, includeInactive = false } = {}) {
  const [localProducts, products, categories] = await Promise.all([
    apiRequest('/local-products'),
    apiRequest('/products'),
    apiRequest('/categories'),
  ])

  const productMap = new Map(
    (Array.isArray(products) ? products : []).map((p) => [String(p.id), p]),
  )
  const categoryMap = new Map(
    (Array.isArray(categories) ? categories : []).map((c) => [String(c.id), c]),
  )

  const q = search ? String(search).trim().toLowerCase() : ''
  const localRows = (Array.isArray(localProducts) ? localProducts : []).filter(
    (lp) => String(lp.local_id) === String(localId),
  )

  const byCategory = new Map()
  const uncategorized = []

  for (const lp of localRows) {
    const product = productMap.get(String(lp.product_id))
    if (!product || product.deleted_at) continue

    const productActive = product.is_active !== false
    const localActive = lp.is_active !== false
    const onSale = productActive && localActive
    if (!includeInactive && !onSale) continue
    if (q && !String(product.name || '').toLowerCase().includes(q)) continue

    const row = {
      id: product.id,
      product_id: product.id,
      name: product.name,
      product_name: product.name,
      price: Number(product.price) || 0,
      cost: Number(product.cost) || 0,
      category_id: product.category_id ? String(product.category_id) : null,
      stock_deduction_mode: product.stock_deduction_mode,
      is_active: onSale,
      product_is_active: productActive,
      local_product_is_active: localActive,
      local_product_id: lp.id,
    }

    if (row.category_id) {
      if (!byCategory.has(row.category_id)) byCategory.set(row.category_id, [])
      byCategory.get(row.category_id).push(row)
    } else {
      uncategorized.push(row)
    }
  }

  const categoryList = []
  for (const [catId, prods] of byCategory.entries()) {
    const cat = categoryMap.get(catId)
    categoryList.push({
      id: catId,
      name: cat?.name || 'Sin nombre',
      products: prods.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  }
  categoryList.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  if (uncategorized.length) {
    categoryList.push({
      id: '__none__',
      name: 'Sin categoría',
      products: uncategorized.sort((a, b) => a.name.localeCompare(b.name, 'es')),
    })
  }

  return { categories: categoryList, local_id: localId }
}

/**
 * Menú POS compuesto: local-products activos + products + categories.
 * Shape: { categories: [{ id, name, products: [...] }] }
 */
export async function fetchPosMenu(localId, { search } = {}) {
  return fetchLocalMenuCatalog(localId, { search, includeInactive: false })
}

/** Compat `/products/catalog`: grupos con products. */
export async function fetchProductsCatalog(localId) {
  const menu = await fetchPosMenu(localId)
  return (menu.categories || []).map((c) => ({
    category: c.name,
    category_id: c.id,
    products: c.products,
  }))
}
