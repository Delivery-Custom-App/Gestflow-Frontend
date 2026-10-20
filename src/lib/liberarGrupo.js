/**
 * Mesas juntadas: soltar el grupo completo (#221).
 *
 * Al juntar mesas todas quedan ocupadas, pero el pedido vive en una sola. Al
 * cobrarla solo se libera esa: las demás siguen ocupadas sin pedido y
 * «Separar» responde 409 (el backend exige que todas estén libres). Con las
 * rutas que ya existen hay dos caminos:
 *
 * - «Liberar grupo» (encargado y dueño): `POST /mesas/{id}/liberar` con motivo
 *   en cada mesa ocupada (lo que tenga abierto queda sin cobrar) y después
 *   `DELETE /mesa-groups/{id}`.
 * - Al cobrar (también el mesero): las otras mesas del grupo que quedaron
 *   ocupadas sin pedido se sueltan con `PATCH /mesas/{id}` —que cualquier rol
 *   puede, siempre que la mesa no tenga un pedido en curso— y se separa el
 *   grupo. Una mesa con un pedido abierto no se toca: se avisa cuál es.
 */
import { liberarMesa, listMesasConTotales, setMesaLibre } from './salesApi'
import { deshacerGrupoDeMesas, obtenerGrupoDeMesas } from './mesaGroupsApi'

export const MOTIVO_MIN = 3
export const MOTIVO_MAX = 300

/** El motivo de «Liberar grupo» va de 3 a 300 caracteres; null si está bien. */
export function errorDeMotivo(motivo) {
  const largo = String(motivo || '').trim().length
  return largo < MOTIVO_MIN || largo > MOTIVO_MAX ? 'El motivo debe tener entre 3 y 300 caracteres.' : null
}

/** «Mesa 2», «Mesa 2 y Mesa 4», «Mesa 2, Mesa 3 y Mesa 4». */
export function nombresEnLista(mesas) {
  const nombres = (Array.isArray(mesas) ? mesas : []).map((m) => m.nombre)
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
}

/** El texto del backend sin el código HTTP delante. */
function mensajeDe(err, porDefecto) {
  const texto = String(err?.detail || err?.message || '').replace(/^\d{3}:\s*/, '').trim()
  return texto || porDefecto
}

/** Liberar una mesa que ya estaba libre es lo que se quería: no cuenta como falla. */
const yaEstabaLibre = (err) => Number(err?.status) === 409 && /ya está libre/i.test(String(err?.detail || err?.message || ''))

/**
 * Cómo está cada mesa de un grupo: si sigue ocupada y si tiene un pedido
 * abierto, con su total. `mesas` es lo de `listMesasConTotales`.
 */
export function estadoDelGrupo(mesaIds, mesas) {
  const porId = new Map((Array.isArray(mesas) ? mesas : []).map((m) => [String(m.id), m]))
  return (Array.isArray(mesaIds) ? mesaIds : []).map((id) => {
    const mesa = porId.get(String(id))
    const ordenes = Array.isArray(mesa?.ordenes_en_curso) ? mesa.ordenes_en_curso : []
    const total = ordenes.length
      ? ordenes.reduce((suma, o) => suma + (Number(o.total) || 0), 0)
      : 0
    return {
      id: String(id),
      nombre: mesa?.name || mesa?.nombre || 'Mesa',
      ocupada: Boolean(mesa) && mesa.state !== 'libre',
      conPedido: ordenes.length > 0,
      total,
    }
  })
}

/**
 * «Liberar grupo»: libera cada mesa ocupada del grupo con su motivo y después
 * separa el grupo. Si una liberación falla se sigue con las demás y no se
 * separa (el backend lo rechazaría): el resultado dice cuáles no se pudieron
 * soltar. `mesas` es lo de `estadoDelGrupo`.
 */
export async function liberarGrupo({ grupoId, mesas, motivo }) {
  const liberadas = []
  const fallidas = []
  let sinCobrar = 0
  for (const mesa of (mesas || []).filter((m) => m.ocupada)) {
    try {
      // Secuencial a propósito: cada liberación deja su registro y su aviso, en orden.
      // oxlint-disable-next-line react-doctor/async-await-in-loop
      const respuesta = await liberarMesa(mesa.id, String(motivo || '').trim())
      sinCobrar += Number(respuesta?.total_sin_cobrar) || 0
      liberadas.push(mesa)
    } catch (err) {
      if (yaEstabaLibre(err)) liberadas.push(mesa)
      else fallidas.push({ ...mesa, mensaje: mensajeDe(err, 'No se pudo liberar la mesa.') })
    }
  }

  let separado = false
  let errorAlSeparar = null
  if (fallidas.length === 0) {
    try {
      await deshacerGrupoDeMesas(grupoId)
      separado = true
    } catch (err) {
      errorAlSeparar = mensajeDe(err, 'No se pudo separar el grupo.')
    }
  }
  return { liberadas, fallidas, separado, errorAlSeparar, sinCobrar }
}

/**
 * Al cobrar una mesa de un grupo: suelta las demás que quedaron ocupadas sin
 * pedido y separa el grupo. Sirve para cualquier rol. Nunca lanza: el cobro ya
 * quedó hecho, así que un problema aquí se informa en `error`.
 *
 * Devuelve null si la mesa no está en un grupo; si no,
 * `{ liberadas, conPedido, fallidas, separado, errorAlSeparar, error }`:
 * `conPedido` son las mesas del grupo con un pedido abierto (no se tocan, se
 * avisa cuál es para ir a cobrarla) y `fallidas` las que no se pudieron soltar.
 */
export async function liberarGrupoAlCobrar({ localId, mesaCobrada }) {
  const grupoId = mesaCobrada?.mesa_group_id
  if (!grupoId) return null
  const resultado = { liberadas: [], conPedido: [], fallidas: [], separado: false, errorAlSeparar: null, error: null }
  try {
    const [grupo, mesas] = await Promise.all([obtenerGrupoDeMesas(grupoId), listMesasConTotales(localId)])
    const otras = estadoDelGrupo(grupo?.mesa_ids, mesas).filter((m) => m.id !== String(mesaCobrada.id))

    for (const mesa of otras.filter((m) => m.ocupada)) {
      if (mesa.conPedido) {
        resultado.conPedido.push(mesa)
        continue
      }
      try {
        // Secuencial a propósito: se suelta de a una y se informa cuál falló.
        // oxlint-disable-next-line react-doctor/async-await-in-loop
        await setMesaLibre(mesa.id)
        resultado.liberadas.push(mesa)
      } catch (err) {
        resultado.fallidas.push({ ...mesa, mensaje: mensajeDe(err, 'No se pudo liberar la mesa.') })
      }
    }

    if (resultado.conPedido.length === 0 && resultado.fallidas.length === 0) {
      try {
        await deshacerGrupoDeMesas(grupoId)
        resultado.separado = true
      } catch (err) {
        resultado.errorAlSeparar = mensajeDe(err, 'No se pudo separar el grupo.')
      }
    }
  } catch (err) {
    // Un grupo que ya no existe (404) no es un problema: alguien lo separó antes.
    if (Number(err?.status) === 404) return null
    resultado.error = mensajeDe(err, 'No se pudo revisar el grupo.')
  }
  return resultado
}
