import { apiRequest } from './apiClient'

/**
 * Máquinas de cobro con tarjeta del vendedor.
 *
 * Al cobrar con tarjeta, el backend busca LA máquina asignada a quien cobra
 * (`pos_machines.assigned_user_id`), sin mirar si está activa: sin una
 * asignada el cobro falla ("No hay un lector de tarjeta vinculado"), y con
 * dos también (el cobro genérico da error, el de MercadoPago Point toma una
 * cualquiera). Por eso aquí cuentan como "suyas" todas las asignadas a él,
 * también las desactivadas.
 *
 * Lo que el vendedor ve depende del tipo de local (reglas de la base):
 * - Comida al paso: las máquinas pertenecen a una caja física y el vendedor ve
 *   todas las de su local.
 * - Con mesas: cada máquina está asignada fija a un mesero (el backend no la
 *   deja sin asignar) y el vendedor solo ve las suyas.
 * El vendedor tampoco puede leer a otros usuarios: de una máquina ajena solo
 * se sabe que está en uso por otra persona, no por quién.
 *
 * El proveedor sale de `GET /payment-connections`, que el backend le niega al
 * vendedor (403, aunque la base se lo permitiría): para él la máquina se lista
 * sin proveedor (ticket B-08). El encargado y el dueño sí lo ven.
 */

export const PROVEEDOR_LABEL = { mercadopago: 'Mercado Pago', haulmer: 'Haulmer' }

/** La web cobra con tarjeta solo por MercadoPago Point (`/payments/point/…`). */
export function webCobraCon(proveedor) {
  return proveedor !== 'haulmer'
}

/** Estado de una máquina para quien mira: la tiene él, la tiene otra persona o está libre. */
export function estadoDeMaquina(maquina, userId) {
  if (!maquina.assigned_user_id) return 'libre'
  return String(maquina.assigned_user_id) === String(userId) ? 'mia' : 'en_uso'
}

/**
 * Las máquinas que el vendedor puede ver en su local, con su proveedor (si se
 * conoce), si están activas y su estado para él. Incluye las inactivas: una
 * inactiva asignada a él sigue siendo con la que el backend le cobra.
 */
export async function listarMaquinasDelVendedor(localId, userId) {
  if (!localId) return []
  const [maquinas, conexiones] = await Promise.all([
    apiRequest(`/pos-machines?local_id=${encodeURIComponent(String(localId))}`),
    // Sin las conexiones igual se listan las máquinas, solo que sin el proveedor.
    apiRequest('/payment-connections').catch(() => []),
  ])
  const proveedorDe = Object.fromEntries((Array.isArray(conexiones) ? conexiones : [])
    .map((c) => [String(c.id), String(c.provider || '').toLowerCase()]))
  return (Array.isArray(maquinas) ? maquinas : [])
    .map((m) => {
      const proveedor = proveedorDe[String(m.connection_id)] || null
      return {
        id: m.id,
        nombre: m.display_name || 'Máquina sin nombre',
        proveedor,
        // null si no se sabe: mejor no mostrar nada que un "desconocido".
        proveedorLabel: PROVEEDOR_LABEL[proveedor] || null,
        activa: m.is_active !== false,
        estado: estadoDeMaquina(m, userId),
        assigned_user_id: m.assigned_user_id || null,
      }
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Todas las máquinas a su nombre, activas o no. */
export function maquinasDelVendedor(maquinas) {
  return (maquinas || []).filter((m) => m.estado === 'mia')
}

/**
 * Con qué cobra: 'ninguna', 'una' (con cuál) o 'varias' (el cobro con tarjeta
 * falla o elige una cualquiera: hay que dejar solo una).
 */
export function resumenDeMaquinas(maquinas) {
  const mias = maquinasDelVendedor(maquinas)
  if (mias.length === 0) return { tipo: 'ninguna', maquina: null, mias }
  if (mias.length === 1) return { tipo: 'una', maquina: mias[0], mias }
  return { tipo: 'varias', maquina: null, mias }
}

/** Las que tiene sentido mostrarle para elegir: las activas y las que ya son suyas. */
export function maquinasParaElegir(maquinas) {
  return (maquinas || []).filter((m) => m.activa || m.estado === 'mia')
}

/**
 * El vendedor toma una máquina libre para su turno: queda asignada a él.
 *
 * Depende del backend (B-01): hoy `PATCH /pos-machines/{id}` es solo del
 * encargado y del dueño, y al vendedor le responde 403. La pantalla que la usa
 * está detrás de la bandera `eleccionMaquinaVendedor`.
 */
export async function tomarMaquina(maquinaId, userId) {
  if (!userId) throw new Error('No se pudo identificar a quién se asigna la máquina')
  try {
    return await apiRequest(`/pos-machines/${encodeURIComponent(String(maquinaId))}`, {
      method: 'PATCH',
      body: { assigned_user_id: userId },
    })
  } catch (error) {
    const mensaje = String(error?.message || '')
    if (/403|no autorizado/i.test(mensaje)) {
      throw new Error('Todavía no puedes elegir tu máquina desde aquí. Pídele al encargado que te la asigne.')
    }
    if (/409/i.test(mensaje)) {
      const conflicto = new Error('Otra persona acaba de tomar esa máquina. Elige otra.')
      conflicto.conflicto = true
      throw conflicto
    }
    throw error
  }
}
