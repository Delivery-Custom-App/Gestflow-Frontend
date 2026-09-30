import { apiRequest } from './apiClient'

/**
 * Catálogo maestro: productos ya descritos (nombre, categoría, proveedor) que
 * un negocio puede traerse en vez de cargarlos a mano. El backend lo tenía y
 * solo lo usaba la app móvil.
 *
 * Importar un ítem crea el producto en el negocio con precio 0 e inactivo —así
 * lo define el backend, para que el negocio le ponga su precio— y después hay
 * que sumarlo al menú del local (`/local-products`), que es lo que la carta
 * lee. Las dos cosas se hacen aquí para que no queden pasos manuales sueltos.
 */

export async function listarCatalogoMaestro({ salesModel } = {}) {
  const qs = salesModel ? `?sales_model=${encodeURIComponent(salesModel)}` : ''
  const filas = await apiRequest(`/master-catalog-products${qs}`)
  return (Array.isArray(filas) ? filas : []).filter((item) => item.is_active !== false)
}

/**
 * Trae un ítem al menú del local. Devuelve el producto creado.
 * `localId` es opcional: sin él, el producto queda en el negocio pero fuera de
 * la carta de ese local.
 */
export async function importarItemAlLocal(itemId, { businessId, localId } = {}) {
  const qs = businessId ? `?business_id=${encodeURIComponent(String(businessId))}` : ''
  let producto
  try {
    producto = await apiRequest(`/master-catalog-products/${encodeURIComponent(String(itemId))}/import${qs}`, {
      method: 'POST',
    })
  } catch (error) {
    throw new Error(limpiar(error, 'No se pudo importar el producto'))
  }

  if (localId && producto?.id) {
    try {
      await apiRequest('/local-products', {
        method: 'POST',
        body: { local_id: localId, product_id: producto.id, is_active: true },
      })
    } catch (error) {
      // El producto ya existe en el negocio; lo que falló es sumarlo a la
      // carta, y eso es lo que el usuario vino a hacer: se dice tal cual.
      throw new Error(`${producto.name}: se creó el producto pero no se pudo sumar al menú (${limpiar(error, 'error desconocido')})`)
    }
  }
  return producto
}

function limpiar(error, porDefecto) {
  const mensaje = String(error?.message || '').replace(/^\d{3}:\s*/, '').trim()
  return mensaje || porDefecto
}

/** Filtro de texto sobre nombre, categoría y proveedor. */
export function filtrarCatalogo(items, texto) {
  const q = String(texto || '').trim().toLowerCase()
  if (!q) return items
  return items.filter((item) => (
    `${item.name} ${item.category_name} ${item.provider}`.toLowerCase().includes(q)
  ))
}
