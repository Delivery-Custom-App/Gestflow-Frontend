import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { getAuthContext } from '../../lib/apiClient'
import { loadCategoriesForLocalCached } from '../../lib/inventoryApi'

function normalizeActiveRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => r && r.is_active !== false)
}

/**
 * Combobox de categoría con typeahead (HU-87): sugiere existentes; permite texto libre.
 */
function CategoryTypeahead({ localId, value, onChange, disabled, 'aria-invalid': ariaInvalid }) {
  const baseId = useId()
  const inputDomId = `${baseId}-input`
  const listDomId = `${baseId}-list`
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const activeRows = useMemo(() => normalizeActiveRows(rows), [rows])

  const suggestions = useMemo(() => {
    const q = String(value || '').trim().toLowerCase()
    const base = activeRows
    const filtered = q
      ? base.filter((r) => String(r.name || '').toLowerCase().includes(q))
      : base
    return filtered.slice(0, 20)
  }, [activeRows, value])

  const hasInsensitiveMatch = useMemo(() => {
    const t = String(value || '').trim().toLowerCase()
    if (!t) return false
    return activeRows.some((r) => String(r.name || '').toLowerCase() === t)
  }, [activeRows, value])

  const showNewHint =
    Boolean(String(value || '').trim()) && !hasInsensitiveMatch && !loading && !loadError

  const load = useCallback(async () => {
    if (!localId) return
    setLoadError('')
    setLoading(true)
    try {
      const { token } = await getAuthContext()
      const list = await loadCategoriesForLocalCached(localId, token)
      setRows(Array.isArray(list) ? list : [])
    } catch (err) {
      setRows([])
      setLoadError(err?.message || 'No se pudieron cargar las categorías.')
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (!localId) {
      setRows([])
      return
    }
    load()
  }, [localId, load])

  useEffect(() => {
    if (!open) return
    const onDoc = (ev) => {
      if (wrapRef.current && !wrapRef.current.contains(ev.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = (name) => {
    onChange(name)
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="npmodal-category-typeahead" ref={wrapRef}>
      <input
        ref={inputRef}
        id={inputDomId}
        type="text"
        value={value}
        onChange={(ev) => {
          onChange(ev.target.value)
          setOpen(true)
        }}
        onFocus={() => {
          setOpen(true)
          if (!rows.length && !loading) load()
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listDomId}
        aria-expanded={open}
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled}
        placeholder="Escribe o elige una categoría"
      />
      {loadError ? <p className="npmodal-category-typeahead__hint npmodal-category-typeahead__hint--error">{loadError}</p> : null}
      {showNewHint ? (
        <p className="npmodal-category-typeahead__hint">Nueva categoría: se creará al guardar el producto.</p>
      ) : null}
      {open && (loading || suggestions.length > 0) ? (
        <ul id={listDomId} className="npmodal-category-typeahead__list" role="listbox">
          {loading ? (
            <li className="npmodal-category-typeahead__item npmodal-category-typeahead__item--muted" role="presentation">
              Cargando…
            </li>
          ) : null}
          {!loading &&
            suggestions.map((r) => (
              <li key={String(r.id)} role="option">
                <button
                  type="button"
                  className="npmodal-category-typeahead__option"
                  onMouseDown={(ev) => {
                    ev.preventDefault()
                    pick(String(r.name))
                  }}
                >
                  {r.name}
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  )
}

export default CategoryTypeahead
