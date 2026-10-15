import { apiRequest } from './apiClient'

/**
 * Lectores de tarjeta del local.
 *
 * El inventario real está en `/pos-machines` — es lo que lee la app móvil — y
 * ahí vive el modo de operación de cada lector. La web pedía
 * `GET /payments/point/devices`, que no existe en Backend V2.
 *
 * El cambio de modo sí tiene ruta propia: `PATCH /payments/point/devices/
 * {mp_pos_id}/mode` es una capa de compatibilidad que habla con MercadoPago y
 * después escribe el modo en la máquina. Necesita la terminal registrada y una
 * cuenta de MercadoPago conectada; por eso se ofrece solo sobre las terminales
 * registradas.
 */

/** Modos tal como los guarda el backend (OperatingMode). */
export const MODOS_LECTOR = {
  remote_pdv: { etiqueta: 'Cobro automático', ayuda: 'La app le envía el monto al lector.' },
  inter_app: { etiqueta: 'Cobro desde la app', ayuda: 'El cobro se abre en la app de MercadoPago.' },
  idle: { etiqueta: 'En espera', ayuda: 'El lector no está tomando cobros.' },
}

export function modoLegible(modo) {
  return MODOS_LECTOR[String(modo || '').toLowerCase()]?.etiqueta || 'Sin modo definido'
}

export function ayudaDelModo(modo) {
  return MODOS_LECTOR[String(modo || '').toLowerCase()]?.ayuda || null
}

/** Los lectores que el sistema tiene registrados para este local. */
export async function listarLectores(localId) {
  if (!localId) return []
  const filas = await apiRequest(`/pos-machines?local_id=${encodeURIComponent(String(localId))}`)
  return (Array.isArray(filas) ? filas : []).map((maquina) => ({
    ...maquina,
    name: maquina.display_name || null,
    modo: modoLegible(maquina.operating_mode),
    activo: maquina.is_active !== false,
  }))
}

/**
 * Cambia el modo de cobro de una terminal registrada.
 * `PDV` = la app manda el monto; `STANDALONE` = se escribe en el lector.
 */
export async function cambiarModoLector(mpPosId, modo) {
  try {
    return await apiRequest(`/payments/point/devices/${encodeURIComponent(String(mpPosId))}/mode`, {
      method: 'PATCH',
      body: { operating_mode: modo },
    })
  } catch (error) {
    const mensaje = String(error?.message || '')
    // El backend responde con su propio detalle; se traduce a algo accionable.
    if (/no está registrada/i.test(mensaje)) {
      throw new Error('Esta terminal ya no está registrada. Búscala de nuevo antes de cambiarle el modo.')
    }
    if (/cuenta MercadoPago/i.test(mensaje)) {
      throw new Error('Este local no tiene una cuenta de MercadoPago conectada.')
    }
    throw error
  }
}
