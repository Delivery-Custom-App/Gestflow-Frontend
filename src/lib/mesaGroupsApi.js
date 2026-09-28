import { apiRequest } from './apiClient'

/**
 * Grupos de mesas: juntar dos o más mesas para atender a un grupo grande.
 *
 * El backend (`/mesa-groups`) ya lo tenía y lo usa la app móvil; la web no lo
 * ofrecía. Sus reglas, que la interfaz respeta antes de pedir nada:
 *  - hacen falta al menos dos mesas distintas del mismo local,
 *  - todas tienen que estar libres, y ninguna puede estar ya en otro grupo,
 *  - al juntarlas quedan ocupadas, porque pasan a atenderse como una sola,
 *  - solo se pueden separar cuando vuelven a estar libres.
 */

export async function listarGruposDeMesas(localId) {
  if (!localId) return []
  const filas = await apiRequest(`/mesa-groups?local_id=${encodeURIComponent(String(localId))}`)
  return Array.isArray(filas) ? filas : []
}

export async function crearGrupoDeMesas(localId, mesaIds) {
  const ids = [...new Set((mesaIds || []).map(String))]
  if (ids.length < 2) throw new Error('Elige al menos dos mesas para juntarlas')
  try {
    return await apiRequest('/mesa-groups', {
      method: 'POST',
      body: { local_id: localId, mesa_ids: ids },
    })
  } catch (error) {
    throw new Error(mensajeDeGrupo(error, 'No se pudieron juntar las mesas'))
  }
}

export async function deshacerGrupoDeMesas(grupoId) {
  try {
    return await apiRequest(`/mesa-groups/${encodeURIComponent(String(grupoId))}`, { method: 'DELETE' })
  } catch (error) {
    throw new Error(mensajeDeGrupo(error, 'No se pudo separar el grupo'))
  }
}

/** Deja el motivo del backend legible, sin el código HTTP delante. */
function mensajeDeGrupo(error, porDefecto) {
  const mensaje = String(error?.message || '')
  const limpio = mensaje.replace(/^\d{3}:\s*/, '').trim()
  if (/ya está en otro grupo/i.test(limpio)) return limpio
  // El rechazo al separar también dice "no está disponible": va primero.
  if (/no se puede separar|todavía no está/i.test(limpio)) return `${limpio}. Libéralas antes de separarlas.`
  if (/no está disponible/i.test(limpio)) return `${limpio}. Solo se pueden juntar mesas libres.`
  if (/solo aplican a locales RESTAURANT/i.test(limpio)) return 'Este local no trabaja con mesas.'
  return limpio || porDefecto
}

/**
 * Índice mesa → grupo, con una etiqueta estable por orden de creación para
 * poder nombrarlos en pantalla: el backend solo devuelve ids.
 */
export function indexarGruposPorMesa(grupos) {
  const ordenados = [...(grupos || [])].sort(
    (a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')),
  )
  const porMesa = new Map()
  ordenados.forEach((grupo, i) => {
    const etiqueta = `Grupo ${i + 1}`
    for (const mesaId of grupo.mesa_ids || []) {
      porMesa.set(String(mesaId), {
        id: grupo.id,
        etiqueta,
        mesaIds: (grupo.mesa_ids || []).map(String),
        capacidad: grupo.combined_capacity ?? null,
      })
    }
  })
  return porMesa
}
