/**
 * Inventario · Resumen (#175): últimos movimientos del día, mermas de la
 * semana y más vendidos con su margen.
 *
 * El backend no tiene (todavía) los movimientos de todo el local: se piden por
 * producto (`GET /inventory/{id}/movimientos`), hasta MAX_PRODUCTOS_MOVIMIENTOS
 * productos y de a pocos a la vez. Si el local tiene más, se avisa en pantalla.
 */
import { listarMovimientosStock } from './movimientosStock'
import { hoyEnChile } from './fondoEmergencia'
import { margenDe } from './inventarioUnificado'

export const MAX_PRODUCTOS_MOVIMIENTOS = 60
const A_LA_VEZ = 6

/** El día en Chile ("YYYY-MM-DD") de un instante del backend. */
export function diaEnChile(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : hoyEnChile(d)
}

/** "2026-10-25" menos n días, sin pasar por la zona horaria del navegador. */
export function restarDias(isoDate, n) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d - n))
  return fecha.toISOString().slice(0, 10)
}

/**
 * Los movimientos recientes de los productos con stock del local, del más
 * nuevo al más antiguo, cada uno con el nombre de su producto.
 * Devuelve { movimientos, recortado, incompleto }: `recortado` si el local tiene más
 * productos de los que se consultaron; `incompleto` si algún producto devolvió el
 * tope de movimientos pedidos (puede tener más) o su consulta falló.
 */
export async function movimientosDelLocal(filas = [], { porProducto = 20, maxProductos = MAX_PRODUCTOS_MOVIMIENTOS } = {}) {
  const conStock = filas.filter((f) => f.inventory_id && !f.sin_registro)
  const consultados = conStock.slice(0, maxProductos)
  const movimientos = []
  let incompleto = false
  for (let i = 0; i < consultados.length; i += A_LA_VEZ) {
    const tanda = consultados.slice(i, i + A_LA_VEZ)
    // De a pocos para no saturar el backend; cada tanda en paralelo.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    const resultados = await Promise.all(tanda.map((f) => listarMovimientosStock(f.inventory_id, { limit: porProducto }).catch(() => null)))
    resultados.forEach((r, k) => {
      if (r === null || (r.movimientos || []).length >= porProducto) incompleto = true
      for (const m of r?.movimientos || []) movimientos.push({ ...m, product_name: tanda[k].product_name, inventory_id: tanda[k].inventory_id })
    })
  }
  movimientos.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  return { movimientos, recortado: conStock.length > consultados.length, incompleto }
}

/** Los movimientos de un día (en Chile). */
export function movimientosDelDia(movimientos = [], hoy = hoyEnChile()) {
  return movimientos.filter((m) => diaEnChile(m.created_at) === hoy)
}

/** Unidades perdidas por merma en los últimos 7 días (hoy incluido). */
export function mermasDeLaSemana(movimientos = [], hoy = hoyEnChile()) {
  const desde = restarDias(hoy, 6)
  return movimientos
    .filter((m) => m.tipo === 'merma' && (diaEnChile(m.created_at) || '') >= desde)
    .reduce((s, m) => s + Math.abs(Number(m.cantidad) || 0), 0)
}

/**
 * Los más vendidos del ranking del período, con el margen por unidad (precio
 * menos costo) de los productos que se conocen.
 */
export function masVendidosConMargen(ranking = [], productos = [], top = 5) {
  const porId = new Map(productos.map((p) => [String(p.product_id || p.id), p]))
  return ranking
    .map((r) => {
      const p = porId.get(String(r.product_id))
      return {
        product_id: r.product_id,
        nombre: r.product_name || p?.product_name || p?.name || 'Producto',
        unidades: Number(r.quantity_sold ?? r.units_sold) || 0,
        margen: p ? margenDe({ price: p.price, cost: p.cost ?? p.unit_cost }) : null,
      }
    })
    .filter((r) => r.unidades > 0)
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, top)
}
