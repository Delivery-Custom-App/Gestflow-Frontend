import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getBusinessIdFromToken } from '../utils/jwt'
import '../styles/CreateLocalModal.css'

function CreateLocalModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validaciones básicas
      if (!formData.name.trim()) {
        throw new Error('El nombre del local es requerido')
      }
      if (!formData.address.trim()) {
        throw new Error('La dirección es requerida')
      }
      if (!formData.phone.trim()) {
        throw new Error('El teléfono es requerido')
      }

      // Obtener sesión y token
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        throw new Error('No hay sesión activa')
      }

      const token = data.session.access_token

      // Extraer business_id del token
      const businessId = getBusinessIdFromToken(token)
      if (!businessId) {
        throw new Error('No se encontró business_id en el token')
      }

      // Crear local en el backend
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/locals`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          business_id: businessId,
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `Error ${response.status}`)
      }

      // Éxito
      setFormData({ name: '', address: '', phone: '' })
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error creando local:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear Nuevo Local</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="name">Nombre del Local *</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Local Centro"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Dirección *</label>
            <input
              id="address"
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Ej: Calle Principal 123, Ciudad"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Teléfono *</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Ej: +1234567890"
              disabled={loading}
              required
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading ? 'Creando...' : 'Crear Local'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateLocalModal
