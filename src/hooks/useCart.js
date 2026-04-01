import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * Hook para gestionar el carrito de compras con persistencia local
 * @returns {object} { items, total, loading, error, addItem, removeItem, clearCart, refetch, isSynced }
 */
export function useCart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSynced, setIsSynced] = useState(false)

  const STORAGE_KEY = 'cart_items'
  const SYNC_STATUS_KEY = 'cart_synced'

  /**
   * Guarda los items en localStorage
   */
  const saveToLocalStorage = useCallback((itemsToSave) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(itemsToSave))
      console.log('Carrito guardado en localStorage')
    } catch (err) {
      console.warn('Error guardando carrito en localStorage:', err)
    }
  }, [])

  /**
   * Carga los items desde localStorage
   */
  const loadFromLocalStorage = useCallback(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsedItems = JSON.parse(saved)
        console.log('Carrito restaurado desde localStorage:', parsedItems)
        return parsedItems
      }
      return []
    } catch (err) {
      console.warn('Error cargando carrito desde localStorage:', err)
      return []
    }
  }, [])

  /**
   * Obtiene el token JWT de la sesión actual
   */
  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw new Error('No hay sesión activa')
    }
    return data.session.access_token
  }, [])

  /**
   * Obtiene la URL base de la API
   */
  const getApiUrl = () => {
    return import.meta.env.VITE_API_URL || 'http://localhost:8000'
  }

  /**
   * Sincroniza el carrito local con el servidor
   */
  const syncWithServer = useCallback(async () => {
    try {
      const token = await getToken()
      const apiUrl = getApiUrl()

      const response = await fetch(`${apiUrl}/api/cart/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error del servidor (422):', errorData)
        throw new Error(
          errorData.detail || 
          `Error ${response.status}: ${response.statusText}`
        )
      }

      const data = await response.json()
      const serverItems = data.items || []
      
      // Actualizar items con los del servidor
      setItems(serverItems)
      saveToLocalStorage(serverItems)
      setIsSynced(true)
      localStorage.setItem(SYNC_STATUS_KEY, 'true')
      
      console.log('Carrito sincronizado con servidor')
      return serverItems
    } catch (err) {
      console.warn('Error sincronizando con servidor:', err)
      setIsSynced(false)
      localStorage.setItem(SYNC_STATUS_KEY, 'false')
      // Mantener los items locales si no se puede sincronizar
      return null
    }
  }, [getToken, saveToLocalStorage])

  /**
   * Obtiene los items del carrito desde el servidor
   */
  const fetchCart = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const token = await getToken()
      const apiUrl = getApiUrl()

      const response = await fetch(`${apiUrl}/api/cart/items`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setItems(data.items || [])
      saveToLocalStorage(data.items || [])
      setIsSynced(true)
      localStorage.setItem(SYNC_STATUS_KEY, 'true')
    } catch (err) {
      console.error('Error fetching cart:', err)
      setError(err.message)
      // Si falla la conexión, cargar desde localStorage
      const localItems = loadFromLocalStorage()
      if (localItems.length > 0) {
        setItems(localItems)
        setIsSynced(false)
        localStorage.setItem(SYNC_STATUS_KEY, 'false')
      }
    } finally {
      setLoading(false)
    }
  }, [getToken, saveToLocalStorage, loadFromLocalStorage])

  /**
   * Agrega un producto al carrito
   */
  const addItem = useCallback(
    async (productId, localId, quantity = 1, notes = '') => {
      try {
        setError(null)
        const token = await getToken()
        const apiUrl = getApiUrl()

        const response = await fetch(`${apiUrl}/api/cart/items`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            product_id: productId,
            local_id: localId,
            quantity,
            notes: notes || null,
          }),
        })

        const responseData = await response.json()

        if (!response.ok) {
          throw new Error(
            responseData.message ||
              `Error ${response.status}: ${response.statusText}`,
          )
        }

        // Recargar carrito después de agregar
        await fetchCart()
        return responseData
      } catch (err) {
        console.error('Error adding item to cart:', err)
        setError(err.message)
        throw err
      }
    },
    [getToken, fetchCart],
  )

  /**
   * Elimina un item del carrito
   */
  const removeItem = useCallback(
    async (itemId) => {
      try {
        setError(null)
        const token = await getToken()
        const apiUrl = getApiUrl()

        const response = await fetch(`${apiUrl}/api/cart/items/${itemId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`)
        }

        // Recargar carrito después de eliminar
        await fetchCart()
      } catch (err) {
        console.error('Error removing item from cart:', err)
        setError(err.message)
        throw err
      }
    },
    [getToken, fetchCart],
  )

  /**
   * Vacía el carrito completo
   */
  const clearCart = useCallback(async () => {
    try {
      setError(null)
      const token = await getToken()
      const apiUrl = getApiUrl()

      const response = await fetch(`${apiUrl}/api/cart`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      setItems([])
      localStorage.removeItem(STORAGE_KEY)
      localStorage.setItem(SYNC_STATUS_KEY, 'true')
      setIsSynced(true)
    } catch (err) {
      console.error('Error clearing cart:', err)
      setError(err.message)
      throw err
    }
  }, [getToken])

  /**
   * Calcula el total del carrito
   */
  const calculateTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.total_price || 0), 0)
  }, [items])

  /**
   * Inicializa el carrito al montar el componente
   * Primero carga desde localStorage, luego sincroniza con servidor
   */
  useEffect(() => {
    const initializeCart = async () => {
      try {
        setLoading(true)
        
        // Paso 1: Cargar desde localStorage inmediatamente
        const localItems = loadFromLocalStorage()
        if (localItems.length > 0) {
          setItems(localItems)
          console.log('Carrito local cargado:', localItems.length, 'items')
        }

        // Paso 2: Intentar sincronizar con servidor
        try {
          const token = await getToken()
          const synced = await syncWithServer()
          if (synced) {
            console.log('Sincronización exitosa')
          }
        } catch (syncErr) {
          console.warn('No se pudo sincronizar con servidor, usando carrito local')
          setIsSynced(false)
          localStorage.setItem(SYNC_STATUS_KEY, 'false')
        }
      } catch (err) {
        console.warn('Error inicializando carrito:', err)
      } finally {
        setLoading(false)
      }
    }

    initializeCart()
  }, [getToken, syncWithServer, loadFromLocalStorage])

  // Guardar en localStorage cada vez que cambian los items
  useEffect(() => {
    if (items.length > 0) {
      saveToLocalStorage(items)
    }
  }, [items, saveToLocalStorage])

  return {
    items,
    total: calculateTotal(),
    loading,
    error,
    addItem,
    removeItem,
    clearCart,
    refetch: fetchCart,
    itemCount: items.length,
    isSynced,
  }
}
