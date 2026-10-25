/**
 * Inventario unificado (#174 a #176): las cuentas de Resumen y Productos salen
 * de la misma lista de filas, así las dos partes cuentan lo mismo (antes
 * Estado Inventario y Control de stock contaban distinto).
 */
import { stockStatus } from './v2CatalogApi'

export const ESTADOS_STOCK = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'OPTIMO', label: 'Óptimo' },
  { id: 'BAJO', label: 'Bajo' },
  { id: 'CRITICO', label: 'Crítico' },
]

/** El estado de una fila con stock registrado; null si todavía no lo tiene. */
export function estadoDe(fila) {
  if (!fila || fila.sin_registro) return null
  return fila.stock_status || fila.status || stockStatus(fila.stock_current, fila.stock_min, fila.stock_critical)
}

/** Cuántos hay en cada estado: { TODOS, OPTIMO, BAJO, CRITICO }. «Todos» incluye los sin registro. */
export function contarPorEstado(filas = []) {
  const cuenta = { TODOS: filas.length, OPTIMO: 0, BAJO: 0, CRITICO: 0 }
  for (const f of filas) {
    const e = estadoDe(f)
    if (e) cuenta[e] += 1
  }
  return cuenta
}

/** Los KPI de siempre, sobre los productos con stock registrado. */
export function kpisDeInventario(filas = []) {
  const conStock = filas.filter((f) => !f.sin_registro)
  const cuenta = contarPorEstado(conStock)
  const valor = conStock.reduce((s, f) => s + (Number(f.total_value) || 0), 0)
  return {
    total: conStock.length,
    optimo: cuenta.OPTIMO,
    bajo: cuenta.BAJO,
    critico: cuenta.CRITICO,
    porReponer: cuenta.BAJO + cuenta.CRITICO,
    valorTotal: valor,
  }
}

/** «Hay que reponer»: bajo el mínimo o en su nivel crítico, los críticos y con menos stock primero. */
export function hayQueReponer(filas = []) {
  const orden = { CRITICO: 0, BAJO: 1 }
  return filas
    .filter((f) => ['CRITICO', 'BAJO'].includes(estadoDe(f)))
    .sort((a, b) => orden[estadoDe(a)] - orden[estadoDe(b)] || (Number(a.stock_current) || 0) - (Number(b.stock_current) || 0))
}

/** Filtra por estado, nombre y categoría (lo que pide la barra de Productos). */
export function filtrarFilas(filas = [], { estado = 'TODOS', busqueda = '', categoria = '' } = {}) {
  const q = String(busqueda || '').trim().toLowerCase()
  return filas.filter((f) => (estado === 'TODOS' || estadoDe(f) === estado)
    && (!q || String(f.product_name || f.name || '').toLowerCase().includes(q))
    && (!categoria || String(f.category_id || '') === String(categoria)))
}

/** Precio menos costo; null si falta alguno (el empleado no ve el costo). */
export function margenDe({ price, cost } = {}) {
  if (price == null || cost == null) return null
  return (Number(price) || 0) - (Number(cost) || 0)
}
