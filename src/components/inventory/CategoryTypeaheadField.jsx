import { useEffect, useRef, useState } from 'react'

function titleCase(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Campo de categoría con typeahead:
 * - Muestra las categorías existentes filtradas mientras el usuario escribe
 * - Enter o clic en sugerencia confirma la selección
 * - Formato automático: primera letra mayúscula, resto minúscula
 * - Si no hay coincidencia sugiere crear una nueva con Enter
 *
 * Props:
 *   categories  — array de { id, name } con las categorías existentes
 *   value       — nombre confirmado actualmente (string)
 *   onConfirm   — callback(formattedName: string) llamado al confirmar
 *   disabled    — deshabilita el input
 *   hasError    — aplica borde rojo
 */
function CategoryTypeaheadField({ categories = [], value = '', onConfirm, disabled = false, hasError = false }) {
  const [input,     setInput]     = useState(value)
  const [open,      setOpen]      = useState(false)
  const [confirmed, setConfirmed] = useState(!!value)
  const wrapperRef = useRef(null)

  useEffect(() => {
    setInput(value)
    setConfirmed(!!value)
  }, [value])

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Muestra todas las categorías si el campo está vacío, o filtra si hay texto
  const suggestions = input.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(input.toLowerCase().trim())
      )
    : categories

  const confirm = (name) => {
    const formatted = titleCase(name.trim())
    setInput(formatted)
    setConfirmed(true)
    setOpen(false)
    onConfirm?.(formatted)
  }

  const handleChange = (e) => {
    const val = e.target.value
    setInput(val)
    setConfirmed(false)
    setOpen(true)
    onConfirm?.('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!input.trim()) return
      confirm(suggestions.length > 0 ? suggestions[0].name : input)
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setOpen(true)}
        placeholder="Escribe la categoría y pulsa Enter"
        disabled={disabled}
        autoComplete="off"
        className={[
          'h-9 w-full rounded-md border px-3 text-sm shadow-sm',
          'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]',
          'disabled:opacity-50',
          hasError
            ? 'border-red-400'
            : confirmed
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]',
        ].join(' ')}
      />

      {open && (
        <ul className="absolute top-full mt-1 left-0 right-0 z-50 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); confirm(cat.name) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  {cat.name}
                </button>
              </li>
            ))
          ) : input.trim() ? (
            <li className="px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
              Pulsa Enter para crear &ldquo;{titleCase(input.trim())}&rdquo;
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}

export default CategoryTypeaheadField
