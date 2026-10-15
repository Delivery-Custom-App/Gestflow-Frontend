/**
 * Orden y color de las categorías (A-08, B-23 sección 3.10).
 *
 * - `sort_order`: entero de 0 a 1.000.000 (por defecto 0). `GET /categories`
 *   ya viene ordenado por `sort_order` y, a igual orden, por nombre.
 * - `color`: hexadecimal de 6 dígitos con `#` (`#FF8800`); otras formas dan
 *   422. En `PATCH`, `null` o vacío lo quitan.
 */
import { apiRequest } from './apiClient'

export const PASO_ORDEN = 10

/** Por `sort_order` y, a igual orden, por nombre (como el backend). */
export function ordenarCategorias(categorias = []) {
  return [...categorias].sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0)
    || String(a.name || '').localeCompare(String(b.name || ''), 'es'))
}

/** ¿Es un color válido para el backend? (#RRGGBB) */
export function esColorValido(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || ''))
}

/**
 * Sube o baja una categoría un lugar. Devuelve los cambios a guardar
 * [{ id, sort_order }] renumerando de a 10 (solo las que cambian).
 */
export function moverCategoria(categorias, id, direccion) {
  const lista = ordenarCategorias(categorias)
  const i = lista.findIndex((c) => String(c.id) === String(id))
  const j = direccion === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return []
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  return lista
    .map((c, k) => ({ id: c.id, sort_order: (k + 1) * PASO_ORDEN, antes: Number(c.sort_order) || 0 }))
    .filter((c) => c.sort_order !== c.antes)
    .map(({ id: cid, sort_order }) => ({ id: cid, sort_order }))
}

/** Guarda el nuevo orden (un PATCH por categoría que cambió). */
export async function guardarOrden(cambios) {
  for (const c of cambios) {
    // Secuencial: pocas categorías y así un error se atribuye a la suya.
    // oxlint-disable-next-line react-doctor/async-await-in-loop
    await apiRequest(`/categories/${encodeURIComponent(String(c.id))}`, { method: 'PATCH', body: { sort_order: c.sort_order } })
  }
}

/** Cambia o quita (`null`) el color de una categoría. */
export function cambiarColorCategoria(id, color) {
  return apiRequest(`/categories/${encodeURIComponent(String(id))}`, {
    method: 'PATCH',
    body: { color: color ? String(color).toUpperCase() : null },
  })
}
