import { useEffect, useState } from 'react'
import { apiRequest, getAuthContext } from '../../lib/apiClient'
import { postCategory } from '../../lib/inventoryApi'
import { postSupplier } from '../../lib/providersApi'
import CategoryTypeaheadField from './CategoryTypeaheadField'
import ModernDateField from './ModernDateField'
import {
  formatRutForDisplay,
  normalizeRutInput,
  validateChileRutMessage,
  validateRutTypeConsistency,
} from '../../utils/chileRut'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

const INITIAL = {
  name: '', rut: '', address: '', category: '',
  contact_name: '', phone: '', email: '', start_date: '',
}

const CL_PHONE_PREFIX = '+56 9'
const CL_PHONE_DIGITS = 8

function normalizeChileMobileDigits(value) {
  const rawDigits = String(value ?? '').replace(/\D/g, '')
  let digits = rawDigits
  if (digits.startsWith('56')) digits = digits.slice(2)
  if (digits.startsWith('9'))  digits = digits.slice(1)
  return digits.slice(0, CL_PHONE_DIGITS)
}

function RegisterSupplierModal({ open, onClose, onSuccess, businessId, localId }) {
  const [form,        setFormState] = useState(INITIAL)
  const [rutType,     setRutType]   = useState('comercial')
  const [submitting,  setSubmitting] = useState(false)
  const [error,       setError]      = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [categories,  setCategories]  = useState([])
  const [catsLoading, setCatsLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setFormState(INITIAL)
    setRutType('comercial')
    setError('')
    setFieldErrors({})
    setSubmitting(false)

    if (!localId) return
    setCatsLoading(true)
    apiRequest(`/categories?local_id=${localId}`)
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]))
      .finally(() => setCatsLoading(false))
  }, [open, localId])

  const setField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }))
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
      ['name',         'Nombre comercial'],
      ['rut',          'RUT'],
      ['address',      'Dirección'],
      ['category',     'Categoría'],
      ['contact_name', 'Contacto'],
      ['phone',        'Teléfono'],
      ['email',        'Correo electrónico'],
    ]
    for (const [key, label] of req) {
      if (!String(form[key] ?? '').trim()) next[key] = `${label} es obligatorio.`
    }
    if (!next.rut) {
      const rutErr = validateChileRutMessage(form.rut)
      if (rutErr) next.rut = rutErr
      else {
        const rangeErr = validateRutTypeConsistency(form.rut, rutType)
        if (rangeErr) next.rut = rangeErr
      }
    }
    if (!next.phone) {
      const digits = normalizeChileMobileDigits(form.phone)
      if (digits.length !== CL_PHONE_DIGITS) next.phone = 'Ingresa 8 dígitos después de +56 9.'
    }
    if (!next.email && String(form.email).trim()) {
      const emailVal = String(form.email).trim()
      const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(emailVal)) {
        next.email = 'Ingresa un correo válido (ej: proveedor@empresa.cl).'
      } else {
        const tld = emailVal.split('.').pop().toLowerCase()
        const reservedTlds = ['test', 'local', 'localhost', 'example', 'invalid', 'internal']
        if (reservedTlds.includes(tld)) {
          next.email = `El dominio ".${tld}" no es válido. Usa un correo real (ej: proveedor@gmail.com).`
        }
      }
    }
    setFieldErrors(next)
    if (Object.keys(next).length > 0) {
      setError(`Corrige los campos requeridos: ${Object.values(next).join(' • ')}`)
    }
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setSubmitting(true)
    try {
      const { businessId: bidFromUser } = await getAuthContext()
      const bid = businessId || bidFromUser
      const body = {
        name:         form.name.trim(),
        rut:          normalizeRutInput(form.rut.trim()),
        address:      form.address.trim(),
        category:     form.category.trim(),
        contact_name: form.contact_name.trim(),
        phone:        `${CL_PHONE_PREFIX}${normalizeChileMobileDigits(form.phone)}`,
        email:        form.email.trim(),
      }
      if (form.start_date) body.start_date = form.start_date
      if (bid)             body.business_id = bid
      if (localId)         body.local_id = localId

      try {
        await postSupplier(body)
      } catch (apiErr) {
        if (body.start_date) {
          const fallback = { ...body }
          delete fallback.start_date
          await postSupplier(fallback)
        } else {
          throw apiErr
        }
      }
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'No se pudo registrar el proveedor.')
    } finally {
      setSubmitting(false)
    }
  }

  const fe = (key) => fieldErrors[key]
  const inputCls = (key) =>
    `h-10 w-full rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
      fe(key) ? 'border-red-400' : 'border-[hsl(var(--border))]'
    }`
  const selectCls = (key) =>
    `h-10 w-full rounded-md border px-3 text-sm shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] ${
      fe(key) ? 'border-red-400' : 'border-[hsl(var(--border))]'
    }`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose?.() }}>
      <DialogContent
        className="max-w-2xl w-full flex flex-col overflow-hidden p-0"
        style={{ maxHeight: 'min(92vh, 820px)' }}
        onInteractOutside={(e) => {
          const original = e.detail?.originalEvent ?? e
          const target = original?.target
          if (target instanceof Element && target.closest('[data-calendar-panel="true"]')) {
            e.preventDefault()
          }
        }}
      >
        {/* Fixed header */}
        <DialogHeader className="shrink-0">
          <DialogTitle>Registro de Proveedores</DialogTitle>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Ingrese los datos del Proveedor
          </p>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="rs-form" onSubmit={handleSubmit} className="flex flex-col gap-5 px-7 py-6">

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2 leading-snug" role="alert">
                {error}
              </p>
            )}

            {/* Nombre comercial */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-name">Nombre Comercial <span className="text-red-500">*</span></Label>
              <input
                id="rs-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="Ingrese datos"
                autoComplete="organization"
                className={inputCls('name')}
              />
              {fe('name') && <span className="text-xs text-red-500">{fe('name')}</span>}
            </div>

            {/* RUT type + RUT */}
            <div className="flex flex-col gap-1.5">
              {/* Tipo de RUT */}
              <div className="flex items-center gap-4 mb-1">
                <span className="text-sm font-medium text-[hsl(var(--foreground))]">Tipo de RUT</span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rutType"
                    value="comercial"
                    checked={rutType === 'comercial'}
                    onChange={() => setRutType('comercial')}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="text-sm">RUT Comercial</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rutType"
                    value="personal"
                    checked={rutType === 'personal'}
                    onChange={() => setRutType('personal')}
                    className="accent-[hsl(var(--primary))]"
                  />
                  <span className="text-sm">RUT Personal</span>
                </label>
              </div>

              <Label htmlFor="rs-rut">
                {rutType === 'comercial' ? 'RUT Comercial' : 'RUT Personal'} <span className="text-red-500">*</span>
              </Label>
              <input
                id="rs-rut"
                value={formatRutForDisplay(form.rut)}
                onChange={(e) => setField('rut', normalizeRutInput(e.target.value))}
                placeholder="12.345.678-9"
                autoComplete="off"
                inputMode="text"
                className={inputCls('rut')}
              />
              {fe('rut') && <span className="text-xs text-red-500">{fe('rut')}</span>}
            </div>

            {/* Categoría */}
            <div className="flex flex-col gap-1.5">
              <Label>Categorías <span className="text-red-500">*</span></Label>
              {catsLoading ? (
                <p className="text-xs text-[hsl(var(--muted-foreground))] py-2">Cargando categorías…</p>
              ) : (
                <CategoryTypeaheadField
                  categories={categories}
                  value={form.category}
                  onConfirm={async (name) => {
                    setField('category', name)
                    if (!name || !localId) return
                    const exists = categories.some(
                      (c) => c.name.toLowerCase() === name.toLowerCase()
                    )
                    if (!exists) {
                      try {
                        const created = await postCategory({ local_id: localId, name, is_active: true })
                        setCategories((prev) => [...prev, created])
                      } catch { /* no crítico */ }
                    }
                  }}
                  disabled={submitting}
                  hasError={!!fe('category')}
                />
              )}
              {fe('category') && <span className="text-xs text-red-500">{fe('category')}</span>}
            </div>

            {/* Dirección */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-address">Dirección <span className="text-red-500">*</span></Label>
              <input
                id="rs-address"
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                placeholder="Ingrese Datos"
                autoComplete="street-address"
                className={inputCls('address')}
              />
              {fe('address') && <span className="text-xs text-red-500">{fe('address')}</span>}
            </div>

            {/* Contacto + Teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-contact">Contacto <span className="text-red-500">*</span></Label>
                <input
                  id="rs-contact"
                  value={form.contact_name}
                  onChange={(e) => setField('contact_name', e.target.value)}
                  placeholder="Ingrese Nombre del contacto"
                  autoComplete="name"
                  className={inputCls('contact_name')}
                />
                {fe('contact_name') && <span className="text-xs text-red-500">{fe('contact_name')}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rs-phone">Teléfono <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))] shrink-0 bg-[hsl(var(--muted))] px-2 rounded-md border border-[hsl(var(--border))] h-10 flex items-center">
                    {CL_PHONE_PREFIX}
                  </span>
                  <input
                    id="rs-phone"
                    type="tel"
                    value={normalizeChileMobileDigits(form.phone)}
                    onChange={(e) => setField('phone', normalizeChileMobileDigits(e.target.value))}
                    placeholder="12345678"
                    inputMode="numeric"
                    maxLength={CL_PHONE_DIGITS}
                    className={`${inputCls('phone')} flex-1 min-w-0`}
                  />
                </div>
                {fe('phone') && <span className="text-xs text-red-500">{fe('phone')}</span>}
              </div>
            </div>

            {/* Correo electrónico */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rs-email">Correo electrónico <span className="text-red-500">*</span></Label>
              <input
                id="rs-email"
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="contacto@proveedor.cl"
                autoComplete="email"
                className={inputCls('email')}
              />
              {fe('email') && <span className="text-xs text-red-500">{fe('email')}</span>}
            </div>

            {/* Inicio de la prestación de servicios */}
            <ModernDateField
              label="Inicio de la prestación de servicios"
              value={form.start_date}
              onChange={(iso) => setField('start_date', iso)}
              disabled={submitting}
            />

          </form>
        </div>

        {/* Fixed footer */}
        <DialogFooter className="shrink-0 flex-col gap-2">
          {error && (
            <p className="w-full rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2 text-left" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end w-full">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="rs-form" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Registrar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default RegisterSupplierModal
