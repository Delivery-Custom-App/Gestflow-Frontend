import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const INITIAL_FORM = { name: '', capacidad: '', zona: '' }

export default function CreateMesaModal({ mesas, onClose, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

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
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return }
    setSubmitting(true)
    setServerError('')
    try {
      await onSubmit({ name: form.name.trim(), capacidad: form.capacidad, zona: form.zona.trim() })
      handleClose()
    } catch (err) {
      setServerError(err.message || 'Error al crear la mesa')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className={cn('flex-1 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={handleClose}
      />
      <div className={cn('w-full max-w-md h-full flex flex-col shadow-2xl bg-[hsl(var(--card))] border-l border-[hsl(var(--border))] overflow-hidden transition-transform duration-300 ease-out', visible ? 'translate-x-0' : 'translate-x-full')}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[hsl(var(--border))] shrink-0">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">Crear Mesa</h2>
        </div>

        {/* Form */}
        <form id="create-mesa-form" onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 space-y-4">

          <div className="space-y-1.5">
            <Label htmlFor="mesa-name">
              Número / Nombre <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-name"
              name="name"
              type="text"
              placeholder="Ingresar nombre"
              value={form.name}
              onChange={handleChange}
              disabled={submitting}
              className={cn(errors.name && 'border-[hsl(var(--destructive))]')}
            />
            {errors.name && <p className="text-xs text-[hsl(var(--destructive))]">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mesa-capacidad">
              Capacidad (personas) <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-capacidad"
              name="capacidad"
              type="number"
              min="1"
              placeholder="0"
              value={form.capacidad}
              onChange={handleChange}
              disabled={submitting}
              className={cn(errors.capacidad && 'border-[hsl(var(--destructive))]')}
            />
            {errors.capacidad && <p className="text-xs text-[hsl(var(--destructive))]">{errors.capacidad}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mesa-zona">
              Zona <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="mesa-zona"
              name="zona"
              type="text"
              placeholder="Ingresar zona"
              value={form.zona}
              onChange={handleChange}
              disabled={submitting}
              className={cn(errors.zona && 'border-[hsl(var(--destructive))]')}
            />
            {errors.zona && <p className="text-xs text-[hsl(var(--destructive))]">{errors.zona}</p>}
          </div>

          {serverError && (
            <p className="text-xs text-[hsl(var(--destructive))] bg-red-50 border border-red-200 rounded px-3 py-2">
              {serverError}
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[hsl(var(--border))] shrink-0 flex gap-3">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="submit"
            form="create-mesa-form"
            disabled={submitting}
            className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
          >
            {submitting ? 'Creando...' : 'Crear Mesa'}
          </Button>
        </div>
      </div>
    </div>
  )
}
