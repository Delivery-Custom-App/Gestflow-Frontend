import { useEffect, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { postSupplier } from '../../lib/providersApi'
import ModernDateField from './ModernDateField'
import {
  formatRutForDisplay,
  normalizeRutInput,
  validateChileRutMessage,
} from '../../utils/chileRut'

const INITIAL = {
  name: '',
  rut: '',
  address: '',
  category: '',
  contact_name: '',
  phone: '',
  email: '',
  start_date: '',
}

const CL_PHONE_PREFIX = '+56 9'
const CL_PHONE_DIGITS = 8

function normalizeChileMobileDigits(value) {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  let digits = rawDigits
  if (digits.startsWith('56')) digits = digits.slice(2)
  if (digits.startsWith('9')) digits = digits.slice(1)
  return digits.slice(0, CL_PHONE_DIGITS)
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
      const normalizedPhone = normalizeChileMobileDigits(form.phone)
      if (normalizedPhone.length !== CL_PHONE_DIGITS) {
        next.phone = 'Ingresa 8 dígitos después de +56 9.'
      }
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
        phone: `${CL_PHONE_PREFIX}${normalizeChileMobileDigits(form.phone)}`,
        email: form.email.trim(),
      }
      if (form.start_date) body.start_date = form.start_date
      if (bid) body.business_id = bid
      body.rut = normalizeRutInput(body.rut)
      try {
        await postSupplier(token, body)
      } catch (apiErr) {
        // Compatibilidad: si backend aún no soporta start_date, reintenta sin ese campo.
        if (body.start_date) {
          const fallbackBody = { ...body }
          delete fallbackBody.start_date
          await postSupplier(token, fallbackBody)
        } else {
          throw apiErr
        }
      }
      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.warn('[Registrar proveedor] Error API', {
        status: err?.status,
        detail: err?.detail,
        message: err?.message,
        err,
      })
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
          <p className="scd-register-supplier-hint">Ingrese Datos de Nuevo proveedor</p>
          {error ? (
            <p className="npmodal-error npmodal-error--multiline" role="alert">
              {error}
            </p>
          ) : null}

          <label className="npmodal-field">
            <span>Nombre comercial</span>
            <input
              value={form.name}
              onChange={(ev) => setField('name', ev.target.value)}
              placeholder="Ingrese datos"
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
              aria-label="RUT"
              value={formatRutForDisplay(form.rut)}
              onChange={(ev) => setField('rut', normalizeRutInput(ev.target.value))}
              placeholder="Ingrese datos"
              autoComplete="off"
              inputMode="text"
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
              placeholder="Ingrese datos"
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
              placeholder="Ingrese datos"
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
                placeholder="Ingrese datos"
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
              <div className="npmodal-phone-input-wrap">
                <span className="npmodal-phone-prefix">{CL_PHONE_PREFIX}</span>
                <input
                  type="tel"
                  aria-label="Teléfono"
                  value={normalizeChileMobileDigits(form.phone)}
                  onChange={(ev) => setField('phone', normalizeChileMobileDigits(ev.target.value))}
                  placeholder="Ingrese datos"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={CL_PHONE_DIGITS}
                  aria-invalid={!!fe('phone')}
                />
              </div>
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
              placeholder="Ingrese datos"
              autoComplete="email"
              aria-invalid={!!fe('email')}
            />
            {fe('email') ? (
              <span className="npmodal-field-error" role="alert">
                {fe('email')}
              </span>
            ) : null}
          </label>

          <ModernDateField
            label="Fecha desde (histórico proveedor)"
            value={form.start_date}
            onChange={(iso) => setField('start_date', iso)}
            disabled={submitting}
          />

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
