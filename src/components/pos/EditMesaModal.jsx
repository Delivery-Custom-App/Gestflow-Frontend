import { useState } from 'react'
import '../../styles/EditMesaModal.css'

/**
 * Modal para editar una mesa existente
 * Permite cambiar: nombre, capacidad, zona, estado activo/inactivo
 */
export default function EditMesaModal({ mesa, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: mesa.name || '',
    capacidad: mesa.capacidad || 4,
    zona: mesa.zona || '',
    is_active: mesa.is_active !== false,
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const next = {}

    if (!form.name.trim()) {
      next.name = 'El nombre es obligatorio'
    }

    if (form.capacidad < 1 || form.capacidad > 100) {
      next.capacidad = 'La capacidad debe estar entre 1 y 100'
    }

    if (!form.zona.trim()) {
      next.zona = 'La zona es obligatoria'
    }

    return Object.keys(next).length === 0 ? {} : next
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
    // Limpiar error al escribir
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        id: mesa.id,
        name: form.name.trim(),
        capacidad: form.capacidad,
        zona: form.zona.trim(),
        is_active: form.is_active,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="edit-mesa-modal-overlay">
      <div className="edit-mesa-modal">
        <div className="edit-mesa-modal-header">
          <h2>Editar Mesa</h2>
          <button
            className="edit-mesa-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-mesa-form">
          {/* Nombre */}
          <div className="form-group">
            <label htmlFor="edit-mesa-name">
              Nombre <span className="required">*</span>
            </label>
            <input
              id="edit-mesa-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: mesa 1, mesa A, etc."
              className={errors.name ? 'input-error' : ''}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          {/* Capacidad */}
          <div className="form-group">
            <label htmlFor="edit-mesa-capacidad">
              Capacidad (personas) <span className="required">*</span>
            </label>
            <input
              id="edit-mesa-capacidad"
              type="number"
              name="capacidad"
              value={form.capacidad}
              onChange={handleChange}
              min="1"
              max="100"
              className={errors.capacidad ? 'input-error' : ''}
            />
            {errors.capacidad && <span className="error-message">{errors.capacidad}</span>}
          </div>

          {/* Zona */}
          <div className="form-group">
            <label htmlFor="edit-mesa-zona">
              Zona <span className="required">*</span>
            </label>
            <input
              id="edit-mesa-zona"
              type="text"
              name="zona"
              value={form.zona}
              onChange={handleChange}
              placeholder="Ej: Salón, Patio, Terraza"
              className={errors.zona ? 'input-error' : ''}
            />
            {errors.zona && <span className="error-message">{errors.zona}</span>}
          </div>

          {/* Estado activo/inactivo */}
          <div className="form-group checkbox-group">
            <label htmlFor="edit-mesa-active">
              <input
                id="edit-mesa-active"
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
              />
              <span>Mesa activa</span>
            </label>
            <p className="help-text">
              {form.is_active
                ? 'La mesa está disponible para usar'
                : 'La mesa está inactiva y no aparecerá en el listado'}
            </p>
          </div>

          {/* Botones */}
          <div className="edit-mesa-modal-actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
