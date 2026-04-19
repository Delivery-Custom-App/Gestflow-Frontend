import { useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { postSupplier } from '../../lib/inventoryApi'
import { validateChilePhoneMessage, validateChileRutMessage } from '../../utils/chileRut'

const INITIAL = {
  name: '',
  rut: '',
  address: '',
  category: '',
  contact_name: '',
  phone: '',
  email: '',
}

function RegisterSupplierModal({ open, onClose, onSuccess, businessId }) {
  const [form, setForm] = useState(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!open) return
    setForm(INITIAL)
    setError('')
    setFieldErrors({})
    setSubmitting(false)
  }, [open])

  if (!open) return null

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const validate = () => {
    const next = {}
    const req = [
      ['name', 'Nombre comercial'],
      ['rut', 'RUT'],
      ['address', 'Dirección'],
      ['category', 'Categoría'],
      ['contact_name', 'Nombre de contacto'],
      ['phone', 'Teléfono'],
      ['email', 'Email'],
    ]
    for (const [key, label] of req) {
      if (!String(form[key] ?? '').trim()) {
        next[key] = `${label} es obligatorio.`
      }
    }
    if (!next.rut) {
      const rutErr = validateChileRutMessage(form.rut)
      if (rutErr) next.rut = rutErr
    }
    if (!next.phone) {
      const ph = validateChilePhoneMessage(form.phone)
      if (ph) next.phone = ph
    }
    if (!next.email && String(form.email).trim()) {
      const em = String(form.email).trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
        next.email = 'Ingresa un email válido.'
      }
    }
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const { token, businessId: bidFromUser } = await getAuthContext()
      const bid = businessId || bidFromUser
      const body = {
        name: form.name.trim(),
        rut: form.rut.trim(),
        address: form.address.trim(),
        category: form.category.trim(),
        contact_name: form.contact_name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
      }
      if (bid) body.business_id = bid
      await postSupplier(token, body)
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo registrar el proveedor.')
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (key) => fieldErrors[key]

  return (
    <div className="npmodal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="npmodal npmodal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-supplier-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="npmodal-head">
          <h2 id="reg-supplier-title">Registrar proveedor</h2>
          <button type="button" className="npmodal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        <form className="npmodal-form" onSubmit={handleSubmit}>
          <p className="scd-register-supplier-hint">
            Completa todos los campos. El RUT se validará con dígito verificador chileno.
          </p>
          {error ? <p className="npmodal-error">{error}</p> : null}

          <label className="npmodal-field">
            <span>Nombre comercial</span>
            <input
              value={form.name}
              onChange={(ev) => setField('name', ev.target.value)}
              autoComplete="organization"
              aria-invalid={!!fe('name')}
              aria-describedby={fe('name') ? 'err-name' : undefined}
            />
            {fe('name') ? (
              <span id="err-name" className="npmodal-field-error" role="alert">
                {fe('name')}
              </span>
            ) : null}
          </label>

          <label className="npmodal-field">
            <span>RUT</span>
            <input
              value={form.rut}
              onChange={(ev) => setField('rut', ev.target.value)}
              placeholder="12.345.678-5"
              autoComplete="off"
              aria-invalid={!!fe('rut')}
            />
            {fe('rut') ? (
              <span className="npmodal-field-error" role="alert">
                {fe('rut')}
              </span>
            ) : null}
          </label>

          <label className="npmodal-field">
            <span>Dirección</span>
            <input
              value={form.address}
              onChange={(ev) => setField('address', ev.target.value)}
              autoComplete="street-address"
              aria-invalid={!!fe('address')}
            />
            {fe('address') ? (
              <span className="npmodal-field-error" role="alert">
                {fe('address')}
              </span>
            ) : null}
          </label>

          <label className="npmodal-field">
            <span>Categoría</span>
            <input
              value={form.category}
              onChange={(ev) => setField('category', ev.target.value)}
              placeholder="Ej. Insumos, bebidas…"
              aria-invalid={!!fe('category')}
            />
            {fe('category') ? (
              <span className="npmodal-field-error" role="alert">
                {fe('category')}
              </span>
            ) : null}
          </label>

          <div className="npmodal-row npmodal-row--2">
            <label className="npmodal-field">
              <span>Contacto</span>
              <input
                value={form.contact_name}
                onChange={(ev) => setField('contact_name', ev.target.value)}
                autoComplete="name"
                aria-invalid={!!fe('contact_name')}
              />
              {fe('contact_name') ? (
                <span className="npmodal-field-error" role="alert">
                  {fe('contact_name')}
                </span>
              ) : null}
            </label>
            <label className="npmodal-field">
              <span>Teléfono</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(ev) => setField('phone', ev.target.value)}
                placeholder="+56 9 1234 5678"
                autoComplete="tel"
                aria-invalid={!!fe('phone')}
              />
              {fe('phone') ? (
                <span className="npmodal-field-error" role="alert">
                  {fe('phone')}
                </span>
              ) : null}
            </label>
          </div>

          <label className="npmodal-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(ev) => setField('email', ev.target.value)}
              autoComplete="email"
              aria-invalid={!!fe('email')}
            />
            {fe('email') ? (
              <span className="npmodal-field-error" role="alert">
                {fe('email')}
              </span>
            ) : null}
          </label>

          <div className="npmodal-actions">
            <button type="button" className="npmodal-btn npmodal-btn--ghost" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="npmodal-btn npmodal-btn--primary" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default RegisterSupplierModal
