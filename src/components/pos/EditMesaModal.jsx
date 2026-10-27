import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// apiClient arma el mensaje como «409: detalle»; a quien edita solo le sirve el detalle.
const mensajeDelError = (err) => err?.detail || err?.message?.replace(/^\d+:\s*/, '') || 'No se pudo guardar la mesa'

/**
 * Modal para editar una mesa existente
 * Permite cambiar: nombre, capacidad, estado activo/inactivo.
 * Zona (A-05): texto libre de hasta 50 caracteres; vaciarla la quita.
 * Si el backend rechaza el cambio (p. ej. dar de baja una mesa en uso), el motivo
 * se muestra aquí y el formulario sigue abierto para corregirlo.
 */
export default function EditMesaModal({ mesa, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: mesa.name || '',
    capacidad: mesa.capacidad || 4,
    is_active: mesa.is_active !== false,
    zona: mesa.zona || '',
  })

  const [errors, setErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const validate = () => {
    const next = {}

    if (!form.name.trim()) {
      next.name = 'El nombre es obligatorio'
    }

    if (form.capacidad < 1 || form.capacidad > 100) {
      next.capacidad = 'La capacidad debe estar entre 1 y 100'
    }


    return Object.keys(next).length === 0 ? {} : next
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    setServerError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setServerError('')
    try {
      await onSubmit({
        id: mesa.id,
        name: form.name.trim(),
        capacidad: form.capacidad,
        is_active: form.is_active,
        zona: form.zona.trim(),
      })
    } catch (err) {
      setServerError(mensajeDelError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Mesa</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 pt-5">
          {/* Nombre */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-name">
              Nombre <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="edit-mesa-name"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Ej: mesa 1, mesa A, etc."
              className={errors.name ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.name && <p className="text-xs text-[hsl(var(--destructive))]">{errors.name}</p>}
          </div>

          {/* Capacidad */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-capacidad">
              Capacidad (personas) <span className="text-[hsl(var(--destructive))]">*</span>
            </Label>
            <Input
              id="edit-mesa-capacidad"
              type="number"
              name="capacidad"
              value={form.capacidad}
              onChange={handleChange}
              min="1"
              max="100"
              className={errors.capacidad ? 'border-[hsl(var(--destructive))]' : ''}
            />
            {errors.capacidad && <p className="text-xs text-[hsl(var(--destructive))]">{errors.capacidad}</p>}
          </div>

          {/* Zona */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-zona">Zona</Label>
            <Input id="edit-mesa-zona" type="text" name="zona" maxLength={50} value={form.zona}
              onChange={handleChange} placeholder="Ej: Terraza (vacío = sin zona)" />
          </div>

          {/* Estado activo/inactivo */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-mesa-active" className="flex items-center gap-2 cursor-pointer">
              <input
                id="edit-mesa-active"
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                className="w-4 h-4 rounded accent-[hsl(var(--primary))]"
              />
              <span>Mesa activa</span>
            </Label>
            <p className="text-xs text-[hsl(var(--muted-foreground))] pl-6">
              {form.is_active
                ? 'La mesa está disponible para usar'
                : 'La mesa está inactiva y no aparecerá en el listado'}
            </p>
          </div>

          {serverError && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-[hsl(var(--destructive))]">
              {serverError}
            </div>
          )}

          <DialogFooter className="-mx-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
