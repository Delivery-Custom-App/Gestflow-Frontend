/**
 * Quién atiende cada mesa y el traspaso de mesas entre vendedores.
 *
 * El backend guarda en cada orden el mesero actual (`waiter_user_id`), solo en
 * locales con mesas. "Quién la atendía antes" se deduce del turno donde se
 * abrió la orden (`caja_id` → `cashier_user_id`).
 *
 * Traspasar es reasignar (T-42, B-06): `POST /orders/{id}/reasignar` con el
 * empleado y el motivo; la orden pasa al turno del nuevo empleado y lo que se
 * cobre suma a ese turno. Solo se le puede pasar a alguien con turno hoy.
 */
import { useEffect, useState } from 'react'
import { listUsers } from './apiClient'
import { listCajas } from './salesApi'
import { nombreVisible } from './altaUsuario'
import { reasignarOrden } from './supervision'

/**
 * Quién atiende una mesa a partir de sus órdenes en curso (`ordenes_en_curso`
 * de listMesasConTotales). `duenoDeTurno` es un Map caja_id → cashier_user_id
 * (vacío si no se conoce). Sin órdenes en curso, null.
 */
export function atencionDeMesa(mesa, duenoDeTurno = new Map()) {
  const ordenes = Array.isArray(mesa?.ordenes_en_curso) ? mesa.ordenes_en_curso : []
  if (!ordenes.length) return null
  const info = { mesa, ordenes, atiendeId: null, abrioId: null }
  for (const orden of ordenes) {
    const abrio = duenoDeTurno.get(String(orden.caja_id)) || null
    // Una orden sin mesero (anterior a este cambio) la atiende quien abrió el turno.
    info.atiendeId ||= orden.waiter_user_id ? String(orden.waiter_user_id) : abrio
    info.abrioId ||= abrio
  }
  return info
}

/** Si la mesa la atiende hoy alguien distinto de quien la abrió. */
export function fueTraspasada(info) {
  return Boolean(info?.atiendeId && info?.abrioId && info.atiendeId !== info.abrioId)
}

/**
 * Nombre para mostrar. El vendedor solo puede leer sus propios datos: a sus
 * compañeros los ve como "Otro vendedor".
 */
export function nombreDePersona(userId, { yoId, usuariosPorId } = {}) {
  if (!userId) return null
  if (yoId && String(userId) === String(yoId)) return 'Tú'
  const usuario = usuariosPorId?.get(String(userId))
  return usuario ? nombreVisible(usuario) : 'Otro vendedor'
}

/** Quienes pueden recibir mesas: los vendedores del local. */
export function vendedoresDelLocal(usuarios, localId) {
  return (Array.isArray(usuarios) ? usuarios : [])
    .filter((u) => String(u.role || '').toUpperCase() === 'EMPLEADO' && String(u.local_id) === String(localId) && u.is_active !== false)
    .map((u) => ({ id: String(u.id), nombre: nombreVisible(u) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Reasigna las órdenes en curso de las mesas a otro empleado, con el motivo
 * (T-42). Sigue con las demás si una falla, y devuelve cuáles no se pudieron
 * pasar (por ejemplo, 409 si ya estaba cobrada o el destino no tiene turno).
 */
export async function traspasarMesas(mesas, nuevoId, motivo) {
  const fallidas = []
  for (const mesa of mesas) {
    try {
      for (const orden of mesa.ordenes) {
        // Secuencial a propósito: pocas órdenes por mesa y un error se atribuye a su mesa.
        // oxlint-disable-next-line react-doctor/async-await-in-loop
        await reasignarOrden(orden.id, orden.created_at, { toUserId: nuevoId, motivo })
      }
    } catch (e) {
      fallidas.push({ mesa, error: String(e?.detail || e?.message || 'No se pudo traspasar').replace(/^\d{3}:\s*/, '') })
    }
  }
  return fallidas
}

/**
 * Datos para mostrar quién atiende: nombres (solo encargado y dueño pueden
 * leer a los demás) y de quién es cada turno del local.
 */
export function useDatosDeAtencion(localId, { esVendedor }) {
  const [datos, setDatos] = useState({ usuarios: [], usuariosPorId: new Map(), duenoDeTurno: new Map(), cajas: [] })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!localId) return undefined
    let ignore = false
    Promise.all([
      esVendedor ? Promise.resolve([]) : listUsers().catch(() => []),
      listCajas(localId).catch(() => []),
    ]).then(([usuarios, cajas]) => {
      if (ignore) return
      setDatos({
        usuarios,
        usuariosPorId: new Map(usuarios.map((u) => [String(u.id), u])),
        duenoDeTurno: new Map(cajas.map((c) => [String(c.id), String(c.cashier_user_id)])),
        cajas,
      })
    })
    return () => { ignore = true }
  }, [localId, esVendedor, version])

  return { ...datos, recargar: () => setVersion((n) => n + 1) }
}
