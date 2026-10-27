import { useCallback, useEffect, useState } from 'react'
import { getCategoriesForLocal, getInventoryStockList } from '../lib/inventoryApi'

/**
 * Las filas de inventario del local (con los productos sin stock registrado)
 * y sus categorías, para Resumen y Productos de Inventario (#174). Se cargan
 * una vez: las dos partes cuentan sobre la misma lista.
 */
export function useInventarioDelLocal(localId) {
  const [filas, setFilas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const recargar = useCallback(async () => {
    if (!localId) {
      setError('No se indicó un local.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const [rows, cats] = await Promise.all([
        getInventoryStockList(localId, { incluirSinRegistro: true }),
        getCategoriesForLocal(localId).catch(() => null),
      ])
      setFilas(Array.isArray(rows) ? rows : [])
      // Si las categorías fallan se conservan las anteriores.
      if (Array.isArray(cats)) setCategorias(cats.filter((c) => c?.id && c?.name).map((c) => ({ ...c, id: String(c.id) })))
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el inventario.')
      setFilas([])
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => { recargar() }, [recargar])

  return { filas, setFilas, categorias, loading, error, recargar }
}
