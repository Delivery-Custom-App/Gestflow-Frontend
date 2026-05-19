import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { resolveCategoryNameForLocal } from '../../lib/inventoryApi'

/**
 * Categoría libre (HU-87): sin listado de sugerencias; escribes el nombre y Enter
 * crea la fila en `categories` del local o reutiliza una existente (mismo nombre, sin distinguir mayúsculas).
 */
function CategoryTypeahead({ localId, value, onChange, disabled, 'aria-invalid': ariaInvalid }) {
  const baseId = useId()
  const inputDomId = `${baseId}-input`
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [okHint, setOkHint] = useState(false)
  const okTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (okTimerRef.current) clearTimeout(okTimerRef.current)
    }
  }, [])

  const commitCategory = useCallback(async () => {
    const trimmed = String(value || '').trim()
    if (!trimmed || !localId || disabled) return
    setLoadError('')
    setSaving(true)
    setOkHint(false)
    if (okTimerRef.current) clearTimeout(okTimerRef.current)
    try {
      const name = await resolveCategoryNameForLocal(localId, trimmed)
      onChange(name)
      setOkHint(true)
      okTimerRef.current = setTimeout(() => setOkHint(false), 2200)
    } catch (err) {
      setOkHint(false)
      setLoadError(err?.message || 'No se pudo guardar la categoría.')
    } finally {
      setSaving(false)
    }
  }, [localId, value, onChange, disabled])

  const onKeyDown = (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      ev.stopPropagation()
      void commitCategory()
    }
  }

  return (
    <div className="npmodal-category-typeahead">
      <input
        id={inputDomId}
        type="text"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled || saving}
        placeholder="Escribe la categoría y pulsa Enter para guardarla"
      />
      {loadError ? (
        <p className="npmodal-category-typeahead__hint npmodal-category-typeahead__hint--error" role="alert">
          {loadError}
        </p>
      ) : null}
      {saving ? (
        <p className="npmodal-category-typeahead__hint npmodal-category-typeahead__item--muted" aria-live="polite">
          Guardando categoría…
        </p>
      ) : null}
      {okHint && !loadError && !saving ? (
        <p className="npmodal-category-typeahead__hint" aria-live="polite">
          Categoría guardada en el local.
        </p>
      ) : null}
    </div>
  )
}

export default CategoryTypeahead
