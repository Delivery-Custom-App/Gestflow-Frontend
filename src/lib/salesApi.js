/**
 * Adaptadores Frontend → Backend V2 (ventas / POS).
 * Normaliza enums, shapes y flujos legacy (items nested, caja activa, mesa detail).
 */
import { apiRequest, getOptionalAuthContext } from './apiClient'
import { fetchProductsMap, productoDeFila } from './v2CatalogApi'
import { traducirErrorCobro } from './supervision'

/**
 * Ítems del pedido con el shape que esperan las pantallas
 * (item_name/product_name/total_price). Desde B-20 cada ítem trae
 * `product_name` (el nombre con que se agregó: no cambia si después se
 * renombra el producto) y `notes`; el catálogo queda solo como respaldo para
 * ítems antiguos sin nombre (A-06).
 */
function enrichItemsWithProducts(items, productsMap = new Map()) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const product = productsMap.get(String(item.product_id))
    const name = item.product_name || product?.name || null
    return {
      ...item,
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price) || 0,
      ...(item.subtotal != null && { subtotal: Number(item.subtotal) }),
      product_name: name,
      item_name: name,
      notes: item.notes || null,
      total_price: Number(item.subtotal ?? Number(item.quantity) * Number(item.unit_price)) || 0,
    }
  })
}

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
const ACTIVE_ORDER_STATUS_FILTERS = ['open', 'preparing', 'ready']

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
    // A-05 (B-19): baja lógica y zona («Terraza», «Salón»); `null` sin zona.
    is_active: mesa.is_active !== false,
    // V2 entrega `capacity`; la UI la lee como `capacidad`. Leer solo el nombre
    // en español hacía que siempre cayera al valor por defecto de la tarjeta.
    capacidad: mesa.capacity ?? mesa.capacidad ?? null,
    zona: mesa.zona ? String(mesa.zona) : null,
  }
}

export function mapCajaOut(caja) {
  if (!caja || typeof caja !== 'object') return caja
  return {
    ...caja,
    name: caja.name || `Turno ${String(caja.id || '').slice(0, 8)}`,
    is_active: String(caja.status) === 'open',
    caja_id: caja.id,
  }
}

/** Fecha de hoy en formato YYYY-MM-DD, según el reloj local del dispositivo. */
export function todayIso() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Caja abierta del local (preferencia: del usuario actual) — SOLO si es la
 * caja de hoy. Una caja "open" de un día anterior que nadie cerró (no hay
 * cron que la fuerce) no cuenta como activa: el backend igual rechazaría
 * ventas contra ella (business_date != hoy), así que filtrar acá evita
 * mandar al POS a intentar vender contra una caja muerta.
 */
export async function getActiveCaja(localId) {
  const rows = await apiRequest(`/cajas?local_id=${encodeURIComponent(String(localId))}`)
  const today = todayIso()
  const open = (Array.isArray(rows) ? rows : []).filter(
    (c) => String(c.status) === 'open' && c.business_date === today,
  )
  if (!open.length) return null
  const { user } = await getOptionalAuthContext()
  const uid = user?.id ? String(user.id) : null
  const mine = uid ? open.find((c) => String(c.cashier_user_id) === uid) : null
  // El vendedor vende solo en su propio turno, nunca en el de otra persona: sin
  // el suyo, no hay caja activa (el backend además solo le muestra los suyos).
  if (String(user?.role || '').toUpperCase() === 'EMPLEADO') return mine ? mapCajaOut(mine) : null
  return mapCajaOut(mine || open[0])
}

/** Turno abierto hoy del usuario actual en el local, o null si no tiene. */
export async function getMiTurnoDeHoy(localId) {
  const rows = await apiRequest(`/cajas?local_id=${encodeURIComponent(String(localId))}`)
  const { user } = await getOptionalAuthContext()
  const uid = user?.id ? String(user.id) : null
  if (!uid) return null
  const today = todayIso()
  const mio = (Array.isArray(rows) ? rows : []).find(
    (c) => String(c.status) === 'open' && c.business_date === today && String(c.cashier_user_id) === uid,
  )
  return mio ? mapCajaOut(mio) : null
}

/**
 * Turnos del local. Los filtros los resuelve el servidor (A-01, B-17):
 * `business_date`, `status` (open | closed) y `cashier_user_id`. Cada turno
 * trae `total_ingresos` y `total_esperado`, sin pedir un resumen por turno.
 */
export async function listCajas(localId, { businessDate, status, cashierUserId } = {}) {
  const qs = new URLSearchParams({ local_id: String(localId) })
  if (businessDate) qs.set('business_date', businessDate)
  if (status) qs.set('status', status)
  if (cashierUserId) qs.set('cashier_user_id', String(cashierUserId))
  const rows = await apiRequest(`/cajas?${qs.toString()}`)
  return (Array.isArray(rows) ? rows : []).map(mapCajaOut)
}

/**
 * Abre un turno de caja. El turno pertenece a una caja física (el mueble), no
 * al local: el backend deriva el local de ella. Mandar `local_id` en vez de
 * `caja_fisica_id` era el contrato anterior y hoy responde 422.
 */
export async function createCajaV2({
  caja_fisica_id, cashier_user_id, monto_apertura = 0, apertura_desglose, pos_machine_id, compartir = false,
}) {
  if (!caja_fisica_id) throw new Error('Elige la caja física donde se abre el turno')
  let cashierId = cashier_user_id
  if (!cashierId) {
    const { user } = await getOptionalAuthContext()
    cashierId = user?.id
  }
  if (!cashierId) throw new Error('No se pudo identificar a quién abre el turno')
  const row = await apiRequest('/cajas', {
    method: 'POST',
    body: {
      caja_fisica_id: String(caja_fisica_id),
      cashier_user_id: cashierId,
      monto_apertura: Number(monto_apertura) || 0,
      // Billetes y monedas contados (T-40), solo si vienen: lo guarda el B-28.
      ...(Array.isArray(apertura_desglose) && apertura_desglose.length > 0 ? { apertura_desglose } : {}),
      // Restaurante: la máquina POS con que cobrará (5b). En un local al paso no se manda (400).
      ...(pos_machine_id ? { pos_machine_id: String(pos_machine_id), compartir: Boolean(compartir) } : {}),
    },
  })
  return mapCajaOut(row)
}

/**
 * El vendedor termina su turno (T-41, sección 5b): suelta la máquina y deja la
 * caja abierta para que el administrador la cuente y la cierre. 409 si tiene
 * mesas o pedidos abiertos o si ya terminó; 403 si no es su turno.
 */
export async function terminarTurno(cajaId) {
  return mapCajaOut(await apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/terminar-turno`, { method: 'POST' }))
}

/** Un turno por id (`GET /cajas/{id}`), con su máquina y si se la soltaron. */
export async function getCaja(cajaId) {
  return mapCajaOut(await apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}`))
}

/** Resumen de una caja: monto de apertura, total de ingresos y desglose por método de pago. */
export async function getCajaResumen(cajaId) {
  return apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/resumen`)
}

/**
 * Cierra un turno (arqueo del día). No se puede reabrir después. Con el
 * efectivo contado (T-55) manda `monto_cierre_declarado` y, si viene,
 * `nota_cierre`: el backend calcula la diferencia contra lo esperado y, si no
 * coincide y falta la nota, responde 400 sin cerrar.
 */
export async function closeCaja(cajaId, { montoCierreDeclarado, notaCierre } = {}) {
  const body = { status: 'closed' }
  if (montoCierreDeclarado !== undefined && montoCierreDeclarado !== null) {
    body.monto_cierre_declarado = Number(montoCierreDeclarado).toFixed(2)
  }
  const nota = String(notaCierre || '').trim()
  if (nota) body.nota_cierre = nota
  const row = await apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}`, {
    method: 'PATCH',
    body,
  })
  return mapCajaOut(row)
}

/** Resumen diario consolidado del local (todas las cajas/cajeros de un día). */
export async function getResumenDiario(localId, businessDate = todayIso()) {
  const qs = new URLSearchParams({ local_id: localId, business_date: businessDate })
  return apiRequest(`/cajas/resumen-diario?${qs.toString()}`)
}

/** Movimientos (ingresos) registrados en una caja, más recientes primero. */
export async function getMovimientosCaja(cajaId, { limit = 100, offset = 0 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const rows = await apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/movimientos?${qs.toString()}`)
  return Array.isArray(rows) ? rows : []
}

const ORDER_PAGE_SIZE = 500

function appendOrderFilters(query, filters = {}) {
  const values = {
    local_id: filters.localId,
    mesa_id: filters.mesaId,
    caja_id: filters.cajaId,
    waiter_user_id: filters.waiterUserId,
    date_from: filters.dateFrom instanceof Date ? filters.dateFrom.toISOString() : filters.dateFrom,
    date_to: filters.dateTo instanceof Date ? filters.dateTo.toISOString() : filters.dateTo,
    business_date: filters.businessDate,
  }
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  })
  const statuses = Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : []
  statuses.forEach((status) => query.append('status', String(status)))
}

async function fetchOrdersPage(filters = {}) {
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), ORDER_PAGE_SIZE)
  const offset = Math.max(Number(filters.offset) || 0, 0)
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  appendOrderFilters(query, filters)
  const response = await apiRequest(`/orders?${query.toString()}`, { withTotal: true })
  const data = Array.isArray(response) ? response : response?.data
  const total = Array.isArray(response) ? null : response?.total ?? null
  return { rows: Array.isArray(data) ? data : [], total, limit, offset }
}

/** Una página de órdenes y el total del filtro, sin descargar el historial completo. */
export async function listOrdersPage(localId, filters = {}) {
  const page = await fetchOrdersPage({ ...filters, localId })
  return { orders: page.rows.map(mapOrderOut), total: page.total, limit: page.limit, offset: page.offset }
}

async function fetchAllMatchingOrders(filters = {}) {
  const rows = []
  let offset = 0
  let total = null
  while (total === null || offset < total) {
    // Cada consulta trae solo hasta 500 órdenes que ya cumplen los filtros del servidor.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    const page = await fetchOrdersPage({ ...filters, limit: ORDER_PAGE_SIZE, offset })
    rows.push(...page.rows)
    total = page.total
    offset += page.rows.length
    if (page.rows.length < ORDER_PAGE_SIZE) break
  }
  return rows
}

/** Órdenes activas de cocina; los estados se filtran y paginan en el servidor. */
export async function listOrders(localId, { status = ACTIVE_ORDER_STATUS_FILTERS, ...filters } = {}) {
  const statuses = Array.isArray(status) ? status.map(toV2OrderStatus) : status ? toV2OrderStatus(status) : status
  const rows = await fetchAllMatchingOrders({ ...filters, localId, status: statuses })
  return rows.map(mapOrderOut)
}

/** Órdenes de un turno, obtenidas por páginas para no traer el historial del local. */
export async function listOrdenesDelTurno(cajaId) {
  const rows = await fetchAllMatchingOrders({ cajaId })
  return rows.map(mapOrderOut)
}

export const ZONA_MAX = 50

/** Mesas del local; con `incluirInactivas` también las dadas de baja (A-05). */
export async function listMesas(localId, { incluirInactivas = false } = {}) {
  const qs = incluirInactivas ? '&include_inactive=true' : ''
  const rows = await apiRequest(`/mesas?local_id=${encodeURIComponent(String(localId))}${qs}`)
  return (Array.isArray(rows) ? rows : []).map(mapMesaOut)
}

/** Reactiva una mesa dada de baja (`PATCH /mesas/{id}` con `is_active: true`). */
export async function reactivarMesa(mesaId) {
  return mapMesaOut(await apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}`, {
    method: 'PATCH',
    body: { is_active: true },
  }))
}

/**
 * Mesas con el total de su pedido en curso.
 *
 * MesaOut no trae importes, así que el total sale de las órdenes abiertas del
 * local: una sola consulta filtrada por estado, no el histórico completo.
 */
export async function listMesasConTotales(localId) {
  // En curso = abierta, en preparación o lista: todavía no se cobra ni se cancela.
  const [mesas, ordenesEnCurso] = await Promise.all([
    listMesas(localId),
    fetchAllMatchingOrders({ localId, status: ACTIVE_ORDER_STATUS_FILTERS }).catch(() => []),
  ])
  const enCursoPorMesa = new Map()
  for (const orden of ordenesEnCurso) {
    if (!orden?.mesa_id) continue
    const clave = String(orden.mesa_id)
    if (!enCursoPorMesa.has(clave)) enCursoPorMesa.set(clave, [])
    enCursoPorMesa.get(clave).push(orden)
  }
  return mesas.map((m) => {
    const ordenes = enCursoPorMesa.get(String(m.id)) || []
    return {
      ...m,
      total: ordenes.length ? ordenes.reduce((s, o) => s + (Number(o.total) || 0), 0) : null,
      // Con su mesero y su turno: para mostrar quién atiende y traspasarla.
      ordenes_en_curso: ordenes,
    }
  })
}

export async function createMesa({ local_id, name, nombre, capacidad, zona }) {
  const capacity = Number(capacidad)
  const zonaLimpia = String(zona || '').trim()
  const row = await apiRequest('/mesas', {
    method: 'POST',
    body: {
      local_id,
      nombre: String(nombre || name || '').trim(),
      status: 'available',
      ...(zonaLimpia ? { zona: zonaLimpia } : {}),
      // V2 acepta capacidad desde la migración 0025.
      ...(Number.isFinite(capacity) && capacity > 0 ? { capacity } : {}),
    },
  })
  return mapMesaOut(row)
}

export async function updateMesa(mesaId, body = {}) {
  const patch = {}
  if (body.name != null || body.nombre != null) {
    patch.nombre = String(body.nombre || body.name).trim()
  }
  if (body.capacidad != null || body.capacity != null) {
    const capacity = Number(body.capacity ?? body.capacidad)
    if (Number.isFinite(capacity) && capacity > 0) patch.capacity = capacity
  }
  // A-05: zona (vacía la quita) y reactivar o dar de baja.
  if (body.zona !== undefined) patch.zona = String(body.zona || '').trim() || null
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active)
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

/** Libera una mesa dejando registro y cancelando sus pedidos abiertos sin cobrar. */
export async function liberarMesa(mesaId, motivo) {
  if (!mesaId) throw new Error('Falta indicar qué mesa liberar')
  return apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}/liberar`, {
    method: 'POST',
    body: { motivo: String(motivo || '').trim() },
  })
}

/**
 * Da de baja una mesa (`DELETE /mesas/{id}`, B-19). Es una baja lógica: deja
 * de salir en el listado, pero los pedidos viejos la conservan y se puede
 * reactivar. El backend responde 409 si está en uso o dentro de un grupo.
 */
export async function deleteMesa(mesaId) {
  if (!mesaId) throw new Error('Falta indicar qué mesa dar de baja')
  await apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}`, { method: 'DELETE' })
}

/**
 * Compone detalle de mesa + órdenes activas (V2 no tiene /mesas/:id/detail).
 */
export async function getMesaDetail(mesaId) {
  const mesa = mapMesaOut(await apiRequest(`/mesas/${encodeURIComponent(String(mesaId))}`))
  const [ordersByStatus, productsMap] = await Promise.all([
    Promise.all(ACTIVE_ORDER_STATUS_FILTERS.map((status) => fetchAllMatchingOrders({ mesaId, status }))),
    fetchProductsMap().catch(() => new Map()),
  ])
  const active = ordersByStatus.flatMap((orders) => Array.isArray(orders) ? orders : []).filter(
    (o) => String(o.mesa_id) === String(mesaId) && ACTIVE_ORDER_STATUSES.has(String(o.status)),
  )

  const withItems = await Promise.all(
    active.map(async (order) => {
      try {
        const items = await apiRequest(orderResourcePath(order.id, order.created_at, '/items'))
        return mapOrderOut({ ...order, items: enrichItemsWithProducts(items, productsMap) })
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

export async function listOrderItems(orderId, createdAt) {
  const items = await apiRequest(orderResourcePath(orderId, createdAt, '/items'))
  // A-06: el nombre viene en cada ítem; el catálogo solo para ítems antiguos sin él.
  const faltaNombre = (Array.isArray(items) ? items : []).some((it) => !it.product_name)
  const productsMap = faltaNombre ? await fetchProductsMap().catch(() => new Map()) : new Map()
  return enrichItemsWithProducts(items, productsMap)
}

/**
 * Un 400 por orden cerrada («No se pueden … ítems de una orden cerrada») se
 * muestra como «El pedido ya está cerrado»; el resto pasa tal cual.
 */
function errorDeItem(err) {
  if (Number(err?.status) === 400 && /cerrad/i.test(String(err?.detail || err?.message || ''))) {
    const e = new Error('El pedido ya está cerrado')
    e.status = 400
    e.detail = err.detail
    throw e
  }
  throw err
}

/**
 * Agrega un ítem. El precio lo pone el backend (el del menú del local): no se
 * manda `unit_price` (T-30).
 */
export const NOTA_ITEM_MAX = 200

export async function addOrderItem(orderId, body, createdAt, key) {
  const nota = String(body.notes || '').trim()
  const options = {
    method: 'POST',
    body: {
      product_id: body.product_id,
      quantity: Number(body.quantity) || 1,
      // A-06: nota del ítem (por ejemplo «sin cebolla»), hasta 200 caracteres.
      ...(nota ? { notes: nota.slice(0, NOTA_ITEM_MAX) } : {}),
    },
  }
  if (key) options.headers = { 'Idempotency-Key': key }
  return apiRequest(orderResourcePath(orderId, createdAt, '/items'), options).catch(errorDeItem)
}

/**
 * Cambia la cantidad (y la nota, si viene) de un ítem:
 * `PATCH /orders/{id}/items/{item_id}`. Nunca manda el precio (T-30).
 */
export async function updateOrderItem(orderId, itemId, { quantity, notes } = {}, createdAt) {
  const body = {}
  if (quantity != null) body.quantity = Number(quantity)
  if (notes !== undefined) body.notes = notes
  return apiRequest(orderResourcePath(orderId, createdAt, `/items/${encodeURIComponent(String(itemId))}`), {
    method: 'PATCH',
    body,
  }).catch(errorDeItem)
}

/** Quita un ítem del pedido: `DELETE /orders/{id}/items/{item_id}` (204). */
export async function removeOrderItem(orderId, itemId, createdAt) {
  const result = await apiRequest(orderResourcePath(orderId, createdAt, `/items/${encodeURIComponent(String(itemId))}`), {
    method: 'DELETE',
    withOrderTotal: true,
  }).catch(errorDeItem)
  return { orderTotal: result?.orderTotal ?? null }
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
  if (orderData.guests != null) {
    const guests = Number(orderData.guests)
    if (!Number.isInteger(guests) || guests < 1) throw new Error('La cantidad de comensales debe ser un entero mayor que cero.')
    payload.guests = guests
  }
  // Al abrir una mesa queda registrado quién la atiende: quien la abre. El
  // backend solo acepta mesero en locales con mesas, y las mesas solo existen ahí.
  if (payload.mesa_id) {
    const meseroId = orderData.waiter_user_id || (await getOptionalAuthContext()).user?.id
    if (meseroId) payload.waiter_user_id = meseroId
  }

  const idempotencyKey = orderData.idempotency_key
  const createOptions = { method: 'POST', body: payload }
  if (idempotencyKey) createOptions.headers = { 'Idempotency-Key': `${idempotencyKey}:crear` }
  const order = await apiRequest('/orders', createOptions).catch((err) => {
    // T-41: con el turno ya terminado el backend responde 400; se explica.
    if (/turno de esta caja ya terminó/i.test(String(err?.detail || err?.message || ''))) {
      const e = new Error('Tu turno ya terminó: no puedes crear pedidos. Si sigues trabajando, pide al administrador que te abra uno nuevo.')
      e.status = 400
      throw e
    }
    throw err
  })
  const items = Array.isArray(orderData.items) ? orderData.items : []
  const createdItems = []

  for (const [index, raw] of items.entries()) {
    const productId = raw.product_id || raw.recipe_id
    if (!productId) continue
    // Secuencial a propósito: conserva el orden de los ítems/comanda y evita escrituras concurrentes sobre la misma orden/mesa.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    const item = await addOrderItem(
      order.id,
      {
        product_id: productId,
        quantity: raw.quantity,
        notes: raw.notes,
      },
      order.created_at,
      idempotencyKey ? `${idempotencyKey}:item:${index}` : undefined,
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

  // `order` es la orden vacía devuelta por POST /orders (total=0). Cada ítem
  // trae `order_total` (B-20): el del último es el total del pedido (A-06).
  // Sin él (backend anterior), se suma con los subtotales.
  const ultimoTotal = createdItems.length ? createdItems[createdItems.length - 1]?.order_total : null
  const computedTotal = ultimoTotal != null ? Number(ultimoTotal) : createdItems.reduce(
    (s, it) => s + (Number(it.subtotal) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 0)),
    0,
  )

  return mapOrderOut({ ...order, total: computedTotal, items: createdItems })
}

export async function updateOrderStatus(orderId, status, createdAt, extra = {}) {
  const body = { status: toV2OrderStatus(status), ...extra }
  const path = orderResourcePath(orderId, createdAt)
  // T-42: el 403 «Solo quien abrió la mesa puede cobrarla» con la sugerencia de pedir la reasignación.
  const updated = await apiRequest(path, { method: 'PATCH', body }).catch((err) => { throw traducirErrorCobro(err) })
  return mapOrderOut(updated)
}

/** Actualiza datos del pedido sin alterar su estado. */
export async function updateOrderFields(orderId, fields = {}, createdAt) {
  const updated = await apiRequest(orderResourcePath(orderId, createdAt), {
    method: 'PATCH',
    body: fields,
  }).catch((err) => { throw traducirErrorCobro(err) })
  return mapOrderOut(updated)
}

/**
 * Completa una orden con su método de pago. En RESTAURANT el backend exige
 * caminar open→preparing→ready→completed, así que ante un 400 por transición
 * inválida se recorren los estados intermedios y se reintenta.
 */
export async function completeOrder(orderId, paymentMethod, createdAt, extra = {}) {
  const fields = { payment_method: paymentMethod, ...extra }
  try {
    return await updateOrderStatus(orderId, 'completed', createdAt, fields)
  } catch (err) {
    const msg = String(err?.message || err?.detail || '')
    if (!/transici[oó]n inv[aá]lida|400/i.test(msg)) throw err
    await updateOrderStatus(orderId, 'preparing', createdAt)
    await updateOrderStatus(orderId, 'ready', createdAt)
    return updateOrderStatus(orderId, 'completed', createdAt, fields)
  }
}

/** Completa orden (cobro efectivo). */
export async function completeOrderCash(orderId, _cashReceived, createdAt, tipAmount = 0) {
  return completeOrder(orderId, 'cash', createdAt, { tip_amount: tipAmount })
}

/**
 * Completa orden cobrada por el checkout de MercadoPago.
 * V2 no tiene `/orders/checkout/complete`: se cierra con el PATCH de la orden,
 * que es lo que registra el ingreso en la caja y en el arqueo del día.
 */
export async function completeOrderMercadoPago(orderId, createdAt) {
  return completeOrder(orderId, 'mercadopago', createdAt)
}

/** Boleta de la orden (ítems con precios y total) para imprimir el comprobante. */
export async function getBoleta(orderId, createdAt) {
  return apiRequest(orderResourcePath(orderId, createdAt, '/boleta'))
}

/**
 * Comanda de cocina de la orden: sin precios, solo lo que hay que preparar.
 * En RESTAURANT el backend deja fuera los ítems sin receta.
 */
export async function getComanda(orderId, createdAt) {
  return apiRequest(orderResourcePath(orderId, createdAt, '/comanda'))
}

export async function cancelOrder(orderId, createdAt) {
  return updateOrderStatus(orderId, 'cancelled', createdAt)
}

export async function computeMesasKpis(localId) {
  const mesas = await listMesas(localId)
  const libres = mesas.filter((m) => m.state === 'libre').length
  const ocupadas = mesas.filter((m) => m.state === 'ocupada').length
  // V2 solo tiene available/occupied: no existe un estado "en cobro".
  const enCobro = 0
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
  const lid = encodeURIComponent(String(localId))
  // A-07 (B-12): la carta para vender (venta directa y mesas) sale del menú del
  // local con los datos del producto (`include=product`), sin bajar el catálogo
  // completo. El Creador de menú (includeInactive) sigue leyendo el producto
  // entero porque necesita saber si está activo en el negocio.
  const [localProducts, products, categories, inventory] = await Promise.all([
    apiRequest(`/local-products?local_id=${lid}${includeInactive ? '' : '&include=product'}`),
    includeInactive ? apiRequest('/products') : Promise.resolve(null),
    apiRequest('/categories'),
    apiRequest(`/inventory?local_id=${lid}`),
  ])

  const productMap = new Map(
    Array.isArray(products)
      ? products.map((p) => [String(p.id), p])
      : (Array.isArray(localProducts) ? localProducts : []).filter((lp) => lp.product_name).map((lp) => [String(lp.product_id), productoDeFila(lp)]),
  )
  const categoryMap = new Map(
    (Array.isArray(categories) ? categories : []).map((c) => [String(c.id), c]),
  )
  const stockMap = new Map(
    (Array.isArray(inventory) ? inventory : [])
      .filter((row) => String(row.local_id) === String(localId))
      .map((row) => [String(row.product_id), Number(row.stock_actual) || 0]),
  )

  const q = search ? String(search).trim().toLowerCase() : ''
  const localRows = (Array.isArray(localProducts) ? localProducts : []).filter(
    (lp) => String(lp.local_id) === String(localId),
  )

  const byCategory = new Map()

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
      // El empleado recibe el costo en null: no se muestra.
      cost: product.cost == null ? null : Number(product.cost) || 0,
      stock: stockMap.get(String(product.id)) || 0,
      category_id: product.category_id ? String(product.category_id) : null,
      stock_deduction_mode: product.stock_deduction_mode,
      is_active: onSale,
      product_is_active: productActive,
      local_product_is_active: localActive,
      local_product_id: lp.id,
    }

    // Un producto sin categoría no puede seleccionarse en el menú (evita huérfanos).
    if (!row.category_id) continue
    if (!byCategory.has(row.category_id)) byCategory.set(row.category_id, [])
    byCategory.get(row.category_id).push(row)
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
