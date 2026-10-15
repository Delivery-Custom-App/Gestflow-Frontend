import { apiRequest } from './apiClient'

/**
 * Máquinas de cobro con tarjeta (POS) del turno del vendedor (sección 5b del
 * backend, B-01 a B-03).
 *
 * - Restaurante: el empleado elige una máquina del local al iniciar su turno
 *   (`POST /cajas` con `pos_machine_id` y `compartir`) o durante el turno
 *   (`PUT /cajas/{id}/maquina`). Una máquina la pueden usar hasta 2 personas a
 *   la vez: con una ya adentro se elige "compartiendo". El turno guarda con qué
 *   máquina cobra (`pos_machine_id`) y cuándo se la soltaron
 *   (`pos_machine_released_at`: al terminar el turno o porque la liberó el
 *   administrador).
 * - Comida al paso: la máquina está anclada a la caja física y el turno cobra
 *   con ella; el empleado no elige nada.
 *
 * Cada máquina trae del backend `ocupacion` (0, 1 o 2), `usuarios` (los nombres
 * de quienes la usan hoy), `disponible` (admite a alguien más) y `provider`.
 */

export const PROVEEDOR_LABEL = { mercadopago: 'Mercado Pago', haulmer: 'Haulmer' }

/** Cuántas personas pueden usar una misma máquina a la vez. */
export const MAX_POR_MAQUINA = 2

/** La web cobra con tarjeta solo por MercadoPago Point (`/payments/point/…`). */
export function webCobraCon(proveedor) {
  return proveedor !== 'haulmer'
}

/**
 * Estado de una máquina para quien elige: 'libre', 'compartible' (la usa una
 * persona), 'llena' (ya son dos) o 'desactivada'.
 */
export function estadoDeMaquina(maquina) {
  if (!maquina.activa) return 'desactivada'
  if (maquina.ocupacion >= MAX_POR_MAQUINA) return 'llena'
  if (maquina.ocupacion > 0) return 'compartible'
  return 'libre'
}

/** Une nombres como se dicen: "Ana", "Ana y Luis". */
function enumerar(nombres) {
  if (nombres.length <= 1) return nombres[0] || ''
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

/** Texto de la ocupación: "Libre", "Compartida con Ana", "Llena (Ana y Luis)". */
export function textoDeOcupacion(maquina) {
  const quienes = maquina.usuarios || []
  switch (maquina.estado) {
    case 'desactivada': return 'Desactivada'
    case 'llena': return quienes.length ? `Llena (${enumerar(quienes)})` : 'Llena'
    case 'compartible': return quienes.length ? `Compartida con ${enumerar(quienes)}` : 'La usa otra persona'
    default: return 'Libre'
  }
}

/** Pasa una máquina del backend a lo que muestra la pantalla. */
export function mapMaquina(m) {
  const proveedor = m.provider ? String(m.provider).toLowerCase() : null
  // `ocupacion` llega como número; sin el dato (backend anterior) se estima con la asignación fija.
  const ocupacion = Number.isFinite(Number(m.ocupacion)) && m.ocupacion !== null
    ? Number(m.ocupacion)
    : (m.assigned_user_id ? 1 : 0)
  const maquina = {
    id: m.id,
    nombre: m.display_name || 'Máquina sin nombre',
    proveedor,
    // null si no se sabe: mejor no mostrar nada que un "desconocido".
    proveedorLabel: PROVEEDOR_LABEL[proveedor] || null,
    activa: m.is_active !== false,
    ocupacion,
    usuarios: Array.isArray(m.usuarios) ? m.usuarios.filter(Boolean).map(String) : [],
    cajaFisicaId: m.caja_fisica_id || null,
  }
  return { ...maquina, estado: estadoDeMaquina(maquina) }
}

/**
 * Todas las máquinas del local, con su ocupación de hoy y su proveedor.
 *
 * El backend agrega `ocupacion`, `usuarios` y `disponible` solo cuando se le
 * pasa el filtro `disponible`, y entonces devuelve una de las dos mitades. Se
 * piden ambas (`true`: libres o con una persona; `false`: llenas o
 * desactivadas) para poder mostrar también las que no se pueden elegir.
 */
export async function listarMaquinasDelLocal(localId) {
  if (!localId) return []
  const base = `/pos-machines?local_id=${encodeURIComponent(String(localId))}`
  const [disponibles, noDisponibles] = await Promise.all([
    apiRequest(`${base}&disponible=true`),
    apiRequest(`${base}&disponible=false`),
  ])
  const porId = new Map()
  for (const fila of [...(Array.isArray(disponibles) ? disponibles : []), ...(Array.isArray(noDisponibles) ? noDisponibles : [])]) {
    porId.set(String(fila.id), fila)
  }
  return [...porId.values()]
    .map(mapMaquina)
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
}

/** Las que se pueden elegir: activas y con cupo. */
export function maquinasElegibles(maquinas) {
  return (maquinas || []).filter((m) => m.estado === 'libre' || m.estado === 'compartible')
}

/** Si al elegirla hay que pedir compartir (ya la usa otra persona). */
export function requiereCompartir(maquina) {
  return maquina?.estado === 'compartible'
}

/** El turno tiene máquina para cobrar con tarjeta: la eligió y nadie se la soltó. */
export function turnoTieneMaquina(turno) {
  return Boolean(turno?.pos_machine_id) && !turno?.pos_machine_released_at
}

/**
 * Con qué máquina cobra el turno:
 * - al paso: la anclada a su caja física;
 * - restaurante: la que eligió, si sigue con ella.
 * `null` si no tiene.
 */
export function maquinaDelTurno(turno, maquinas, { alPaso = false } = {}) {
  if (!turno) return null
  const lista = maquinas || []
  if (alPaso) {
    return lista.find((m) => m.cajaFisicaId && String(m.cajaFisicaId) === String(turno.caja_fisica_id)) || null
  }
  if (!turnoTieneMaquina(turno)) return null
  return lista.find((m) => String(m.id) === String(turno.pos_machine_id)) || null
}

/** Quita el "409: " del mensaje del backend para mostrarlo tal cual. */
function detalleDe(error) {
  const mensaje = String(error?.detail || error?.message || '')
  return mensaje.replace(/^\d{3}:\s*/, '')
}

/**
 * Traduce el error al tomar una máquina. Un 409 (la tomó otra persona, se
 * llenó o la desactivaron) marca `conflicto` para que la pantalla recargue la
 * lista; el texto es el del backend ("La máquina «Point barra» la está usando
 * Ana…").
 */
export function errorAlTomarMaquina(error) {
  const status = Number(error?.status) || Number(String(error?.message || '').slice(0, 3))
  const texto = detalleDe(error)
  const salida = new Error(texto || 'No se pudo tomar la máquina')
  if (status === 409) salida.conflicto = true
  return salida
}

/**
 * Elige o cambia la máquina del turno ya abierto (`PUT /cajas/{id}/maquina`).
 * Devuelve el turno actualizado.
 */
export async function elegirMaquinaDelTurno(cajaId, maquinaId, { compartir = false } = {}) {
  if (!cajaId) throw new Error('No se pudo identificar tu turno')
  if (!maquinaId) throw new Error('Elige una máquina')
  try {
    return await apiRequest(`/cajas/${encodeURIComponent(String(cajaId))}/maquina`, {
      method: 'PUT',
      body: { pos_machine_id: String(maquinaId), compartir: Boolean(compartir) },
    })
  } catch (error) {
    throw errorAlTomarMaquina(error)
  }
}
