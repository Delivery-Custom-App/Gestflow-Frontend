import { useState } from 'react'

const INITIAL_FORM = { name: '', capacidad: '', zona: '' }

export default function CreateMesaModal({ mesas, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const next = {}

    if (!form.name.trim()) {
      next.name = 'El número de mesa es obligatorio'
    } else if (mesas.some((m) => m.name.trim().toLowerCase() === form.name.trim().toLowerCase())) {
      next.name = `Ya existe una mesa con el nombre "${form.name}"`
    }

    if (!form.capacidad) {
      next.capacidad = 'La capacidad es obligatoria'
    } else if (Number(form.capacidad) <= 0 || !Number.isInteger(Number(form.capacidad))) {
      next.capacidad = 'Ingresa un número entero mayor a 0'
    }

    if (!form.zona.trim()) {
      next.zona = 'La zona es obligatoria'
    }

    return next
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setSubmitting(true)
    setServerError('')
    try {
      await onSubmit({ name: form.name.trim(), capacidad: form.capacidad, zona: form.zona.trim() })
      onClose()
    } catch (err) {
      setServerError(err.message || 'Error al crear la mesa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-box">
        <div className="modal-header">
          <h2 id="modal-title">Crear Mesa</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {/* Número de mesa */}
          <div className="form-field">
            <label htmlFor="mesa-name">Número / Nombre de Mesa <span className="required">*</span></label>
            <input
              id="mesa-name"
              name="name"
              type="text"
              placeholder="Ej: Mesa 1, VIP-A, Terraza 3"
              value={form.name}
              onChange={handleChange}
              disabled={submitting}
              className={errors.name ? 'input-error' : ''}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          {/* Capacidad */}
          <div className="form-field">
            <label htmlFor="mesa-capacidad">Capacidad (personas) <span className="required">*</span></label>
            <input
              id="mesa-capacidad"
              name="capacidad"
              type="number"
              min="1"
              placeholder="Ej: 4"
              value={form.capacidad}
              onChange={handleChange}
              disabled={submitting}
              className={errors.capacidad ? 'input-error' : ''}
            />
            {errors.capacidad && <p className="field-error">{errors.capacidad}</p>}
          </div>

          {/* Zona */}
          <div className="form-field">
            <label htmlFor="mesa-zona">Zona <span className="required">*</span></label>
            <input
              id="mesa-zona"
              name="zona"
              type="text"
              placeholder="Ej: Salón, Terraza, Bar, VIP"
              value={form.zona}
              onChange={handleChange}
              disabled={submitting}
              className={errors.zona ? 'input-error' : ''}
            />
            {errors.zona && <p className="field-error">{errors.zona}</p>}
          </div>

          {serverError && <p className="server-error">{serverError}</p>}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear Mesa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
