import { useState } from 'react'
import { apiRequest, getAuthContext } from '../lib/apiClient'
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

      const { token, businessId } = await getAuthContext()
      if (!businessId) {
        throw new Error('No se encontro business_id en el token')
      }

      await apiRequest('/locals', {
        method: 'POST',
        token,
        body: {
          business_id: businessId,
          name: formData.name.trim(),
          address: formData.address.trim(),
          phone: formData.phone.trim(),
        },
      })

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
