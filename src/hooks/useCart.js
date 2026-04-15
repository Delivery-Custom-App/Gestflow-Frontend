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

      if (response.ok) {
        const data = await response.json()
        const serverItems = data.items || []
        setItems(serverItems)
        saveToLocalStorage(serverItems)
        setIsSynced(true)
        localStorage.setItem(SYNC_STATUS_KEY, 'true')
        console.log('Carrito sincronizado desde servidor')
      } else {
        console.warn(`Error ${response.status}: usando carrito local`)
        setIsSynced(false)
        localStorage.setItem(SYNC_STATUS_KEY, 'false')
        // Mantener los items locales
      }
    } catch (err) {
      console.warn('Error fetching cart - usando modo offline:', err)
      setIsSynced(false)
      localStorage.setItem(SYNC_STATUS_KEY, 'false')
      // Si falla la conexión, cargar desde localStorage
      const localItems = loadFromLocalStorage()
      if (localItems.length > 0) {
        setItems(localItems)
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
        const businessId = import.meta.env.VITE_BUSINESS_ID || 'default-business'
        
        // Primero agregar localmente
        const newItem = {
          id: `${productId}-${localId}-${Date.now()}`,
          product_id: productId,
          product_name: productId.replace('prod-', '').replace(/-/g, ' '),
          local_id: localId,
          quantity: parseInt(quantity),
          unit_price: 0,
          total_price: 0,
          notes: notes || null,
          created_at: new Date().toISOString(),
        }

        setItems((prev) => [...prev, newItem])

        // Intentar sincronizar con servidor (sin fallar si no funciona)
        try {
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
              business_id: businessId,
              quantity,
              notes: notes || null,
            }),
          })

          if (response.ok) {
            console.log('Item agregado al servidor')
            // Si funciona, recargar desde servidor
            await fetchCart()
          } else {
            console.warn('No se pudo sincronizar con servidor, guardando localmente')
            setIsSynced(false)
            localStorage.setItem(SYNC_STATUS_KEY, 'false')
          }
        } catch (syncErr) {
          console.warn('Error de conexión al servidor:', syncErr)
          setIsSynced(false)
          localStorage.setItem(SYNC_STATUS_KEY, 'false')
        }

        return newItem
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
        
        // Primero eliminar localmente
        setItems((prev) => prev.filter((item) => item.id !== itemId))

        // Intentar sincronizar con servidor (sin fallar si no funciona)
        try {
          const token = await getToken()
          const apiUrl = getApiUrl()

          const response = await fetch(`${apiUrl}/api/cart/items/${itemId}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            console.log('Item eliminado del servidor')
            setIsSynced(true)
          } else {
            console.warn('No se pudo sincronizar eliminación con servidor')
            setIsSynced(false)
            localStorage.setItem(SYNC_STATUS_KEY, 'false')
          }
        } catch (syncErr) {
          console.warn('Error de conexión al eliminar del servidor:', syncErr)
          setIsSynced(false)
          localStorage.setItem(SYNC_STATUS_KEY, 'false')
        }
      } catch (err) {
        console.error('Error removing item from cart:', err)
        setError(err.message)
      }
    },
    [getToken],
  )

  /**
   * Vacía el carrito completo
   */
  const clearCart = useCallback(async () => {
    try {
      setError(null)
      
      // Primero limpiar localmente
      setItems([])
      localStorage.removeItem(STORAGE_KEY)

      // Intentar sincronizar con servidor (sin fallar si no funciona)
      try {
        const token = await getToken()
        const apiUrl = getApiUrl()

        const response = await fetch(`${apiUrl}/api/cart`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          console.log('Carrito vaciado en servidor')
          localStorage.setItem(SYNC_STATUS_KEY, 'true')
          setIsSynced(true)
        } else {
          console.warn('No se pudo vaciar carrito en servidor')
          setIsSynced(false)
          localStorage.setItem(SYNC_STATUS_KEY, 'false')
        }
      } catch (syncErr) {
        console.warn('Error de conexión al vaciar carrito:', syncErr)
        setIsSynced(false)
        localStorage.setItem(SYNC_STATUS_KEY, 'false')
      }
    } catch (err) {
      console.error('Error clearing cart:', err)
      setError(err.message)
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

        // Paso 2: Intentar sincronizar con servidor (sin fallar si no funciona)
        try {
          // Pequeño delay para no sobrecargar
          await new Promise(resolve => setTimeout(resolve, 500))
          const token = await getToken()
          console.log('Intentando sincronizar con servidor...')
          
          const apiUrl = getApiUrl()
          const response = await fetch(`${apiUrl}/api/cart/items`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const data = await response.json()
            setItems(data.items || [])
            saveToLocalStorage(data.items || [])
            setIsSynced(true)
            localStorage.setItem(SYNC_STATUS_KEY, 'true')
            console.log('✓ Sincronización exitosa')
          } else {
            console.warn(`⚠ Servidor retornó ${response.status} - usando carrito local`)
            setIsSynced(false)
            localStorage.setItem(SYNC_STATUS_KEY, 'false')
          }
        } catch (syncErr) {
          console.warn('⚠ No se pudo conectar al servidor - usando carrito local')
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
  }, [getToken, saveToLocalStorage, loadFromLocalStorage])

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
