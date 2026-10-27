import { useState, useEffect, useCallback, useRef } from 'react'
import {
  createMesa as createMesaV2,
  deleteMesa as deleteMesaV2,
  listMesasConTotales,
  updateMesa as updateMesaV2,
} from '../lib/salesApi'

/** Cada cuánto se refrescan solas la grilla de mesas y sus números (#157). */
export const MESAS_REFRESCO_MS = 30_000

/**
 * Mesas con estado (libre/ocupada) y el total de su pedido en curso.
 * V2: status available|occupied mapeado a state; el importe sale de las órdenes
 * abiertas del local, porque MesaOut no trae totales.
 *
 * #157: con `poll`, se refresca sola cada MESAS_REFRESCO_MS y al volver a la
 * pestaña, sin spinner: así se ven las mesas que abrió otro compañero.
 */
export function useMesasConEstado(localId, { poll = false } = {}) {
  const [mesas, setMesas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Solo se aplica la última consulta: un refresco lento no pisa uno más nuevo.
  const ultimaConsulta = useRef(0)

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    if (!localId) return
    const consulta = ++ultimaConsulta.current
    try {
      if (!silencioso) {
        setLoading(true)
        setError(null)
      }
      const filas = await listMesasConTotales(localId)
      if (consulta === ultimaConsulta.current) {
        setMesas(filas)
        // Un refresco de fondo que acierta también saca el error de una carga anterior.
        setError(null)
      }
    } catch (err) {
      // Un refresco de fondo que falla deja la grilla como estaba.
      if (silencioso || consulta !== ultimaConsulta.current) return
      console.error('Error al cargar mesas:', err)
      // Sin el código HTTP delante; antes se cortaba en el primer «:» aunque fuera parte del texto.
      setError(String(err?.message || 'Error al cargar mesas').replace(/^\d{3}:\s*/, ''))
    } finally {
      if (consulta === ultimaConsulta.current) setLoading(false)
    }
  }, [localId])

  // `refresh` también se usa como onClick: no recibe opciones.
  const fetchMesas = useCallback(() => cargar(), [cargar])

  useEffect(() => {
    fetchMesas()
  }, [fetchMesas])

  useEffect(() => {
    if (!poll || !localId) return undefined
    return refrescarDeFondo(() => cargar({ silencioso: true }))
  }, [poll, localId, cargar])

  const createMesa = useCallback(async ({ name, capacidad, zona }) => {
    const data = await createMesaV2({ local_id: localId, name, capacidad, zona })
    await fetchMesas()
    return data
  }, [localId, fetchMesas])

  const updateMesa = useCallback(async ({ id, name, capacidad, zona, is_active }) => {
    // A-05: la zona y el estado activo ahora se guardan.
    const data = await updateMesaV2(id, { name, capacidad, zona, is_active })
    await fetchMesas()
    return data
  }, [fetchMesas])

  const deleteMesa = useCallback(async (id) => {
    await deleteMesaV2(id)
    await fetchMesas()
  }, [fetchMesas])

  return { mesas, loading, error, refresh: fetchMesas, createMesa, updateMesa, deleteMesa }
}

/**
 * Llama a `refrescar` cada MESAS_REFRESCO_MS mientras la pestaña está a la vista,
 * y apenas se vuelve a ella. Devuelve la función que lo detiene.
 */
export function refrescarDeFondo(refrescar, cadaMs = MESAS_REFRESCO_MS) {
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  const intervalo = setInterval(() => { if (visible()) refrescar() }, cadaMs)
  const alVolver = () => { if (visible()) refrescar() }
  document.addEventListener('visibilitychange', alVolver)
  return () => {
    clearInterval(intervalo)
    document.removeEventListener('visibilitychange', alVolver)
  }
}
