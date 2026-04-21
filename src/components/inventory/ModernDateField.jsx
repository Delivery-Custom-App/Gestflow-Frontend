import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '../../styles/inventory/ModernDateField.css'

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function parseIsoToParts(iso) {
  if (!iso || typeof iso !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

function partsToIso(y, mo, d) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y, mo) {
  return new Date(y, mo, 0).getDate()
}

function formatDisplay(iso) {
  const p = parseIsoToParts(iso)
  if (!p) return ''
  try {
    return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(p.y, p.mo - 1, p.d))
  } catch {
    return iso
  }
}

function monthTitle(y, mo) {
  try {
    return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1))
  } catch {
    return `${mo}/${y}`
  }
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const mo = i + 1
  let label = String(mo)
  try {
    label = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(new Date(2000, mo - 1, 15))
    label = label.charAt(0).toUpperCase() + label.slice(1)
  } catch {
    /* keep */
  }
  return { value: mo, label }
})

function defaultYearList() {
  const hi = new Date().getFullYear() + 2
  const out = []
  for (let y = hi; y >= 1970; y -= 1) out.push(y)
  return out
}

/**
 * Selector de fecha con panel tipo calendario (sin input type="date" nativo).
 * `value` / `onChange` usan siempre ISO `YYYY-MM-DD`.
 */
function ModernDateField({ id, label, value, onChange, disabled, 'aria-label': ariaLabel }) {
  const autoId = useId()
  const fieldId = id || `mdate-${autoId}`
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const controlRef = useRef(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)
  const [panelBox, setPanelBox] = useState(null)

  const selected = parseIsoToParts(value)
  const [view, setView] = useState(() => ({
    y: selected?.y ?? new Date().getFullYear(),
    mo: selected?.mo ?? new Date().getMonth() + 1,
  }))
  const viewY = view.y
  const viewMo = view.mo

  const yearChoices = useMemo(() => {
    const set = new Set(defaultYearList())
    set.add(viewY)
    return [...set].sort((a, b) => b - a)
  }, [viewY])

  useEffect(() => {
    if (!open) return
    const p = parseIsoToParts(value)
    if (p) setView({ y: p.y, mo: p.mo })
  }, [open, value])

  const cells = useMemo(() => {
    const firstDow = new Date(viewY, viewMo - 1, 1).getDay()
    const total = daysInMonth(viewY, viewMo)
    const blanks = firstDow
    const out = []
    for (let i = 0; i < blanks; i += 1) out.push({ type: 'blank', key: `b-${i}` })
    for (let d = 1; d <= total; d += 1) {
      out.push({ type: 'day', d, key: `d-${d}` })
    }
    while (out.length % 7 !== 0) out.push({ type: 'blank', key: `t-${out.length}` })
    return out
  }, [viewY, viewMo])

  const close = useCallback(() => setOpen(false), [])

  useLayoutEffect(() => {
    if (!open) {
      setPanelBox(null)
      return undefined
    }
    const EST_PANEL_H = 380
    const place = () => {
      const anchor = controlRef.current || btnRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const margin = 8
      let width = Math.max(288, Math.round(rect.width))
      width = Math.min(width, vw - 2 * margin)
      let left = rect.right - width
      if (left < margin) left = margin
      if (left + width > vw - margin) left = Math.max(margin, vw - margin - width)

      let top = rect.bottom + 6
      if (top + EST_PANEL_H > vh - margin) {
        top = Math.max(margin, rect.top - EST_PANEL_H - 6)
      }

      setPanelBox({
        position: 'fixed',
        top: `${Math.round(top)}px`,
        left: `${Math.round(left)}px`,
        width: `${Math.round(width)}px`,
        zIndex: 5600,
      })
    }
    let raf1 = 0
    let raf2 = 0
    raf1 = requestAnimationFrame(() => {
      place()
      raf2 = requestAnimationFrame(place)
    })
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      cancelAnimationFrame(raf1)
      cancelAnimationFrame(raf2)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      const wrap = wrapRef.current
      const panel = panelRef.current
      const t = e.target
      if ((wrap && wrap.contains(t)) || (panel && panel.contains(t))) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  const shiftMonth = (delta) => {
    setView(({ y, mo }) => {
      const d = new Date(y, mo - 1 + delta, 1)
      return { y: d.getFullYear(), mo: d.getMonth() + 1 }
    })
  }

  const setMonth = (mo) => {
    const m = Number(mo)
    if (!Number.isFinite(m) || m < 1 || m > 12) return
    setView(({ y }) => ({ y, mo: m }))
  }

  const setYear = (y) => {
    const yy = Number(y)
    if (!Number.isFinite(yy)) return
    setView(({ mo }) => ({ y: yy, mo }))
  }

  const pickDay = (d) => {
    const maxD = daysInMonth(viewY, viewMo)
    const safe = Math.min(Math.max(1, d), maxD)
    onChange?.(partsToIso(viewY, viewMo, safe))
    close()
    btnRef.current?.focus()
  }

  const clear = () => {
    onChange?.('')
    close()
    btnRef.current?.focus()
  }

  const labelText = label || 'Fecha'
  const btnLabel = ariaLabel || labelText

  return (
    <div className="mdate" ref={wrapRef}>
      {label ? (
        <span className="mdate__label" id={`${fieldId}-lbl`}>
          {label}
        </span>
      ) : null}
      <div className="mdate__control" ref={controlRef}>
        <button
          ref={btnRef}
          type="button"
          className="mdate__trigger"
          id={fieldId}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-controls={`${fieldId}-panel`}
          aria-labelledby={label ? `${fieldId}-lbl` : undefined}
          aria-label={!label ? btnLabel : undefined}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="mdate__trigger-text">{value ? formatDisplay(value) : 'Seleccionar fecha'}</span>
          <span className="mdate__trigger-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <rect x="3" y="5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        </button>
        {value ? (
          <button type="button" className="mdate__clear" onClick={clear} disabled={disabled} aria-label="Quitar fecha">
            Borrar
          </button>
        ) : null}
      </div>

      {open && panelBox
        ? createPortal(
            <div
              ref={panelRef}
              className="mdate__panel mdate__panel--portal"
              id={`${fieldId}-panel`}
              role="dialog"
              aria-label="Calendario"
              style={panelBox}
            >
              <div className="mdate__panel-head">
                <button type="button" className="mdate__nav" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
                  ‹
                </button>
                <div className="mdate__panel-selects">
                  <label className="mdate__sr-only" htmlFor={`${fieldId}-mo`}>
                    Mes
                  </label>
                  <select
                    id={`${fieldId}-mo`}
                    className="mdate__select"
                    value={viewMo}
                    onChange={(e) => setMonth(e.target.value)}
                    aria-label="Seleccionar mes"
                  >
                    {MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <label className="mdate__sr-only" htmlFor={`${fieldId}-yr`}>
                    Año
                  </label>
                  <select
                    id={`${fieldId}-yr`}
                    className="mdate__select mdate__select--year"
                    value={viewY}
                    onChange={(e) => setYear(e.target.value)}
                    aria-label="Seleccionar año"
                  >
                    {yearChoices.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" className="mdate__nav" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
                  ›
                </button>
              </div>
              <p className="mdate__month-caption" aria-hidden="true">
                {monthTitle(viewY, viewMo)}
              </p>
              <div className="mdate__weekdays" aria-hidden="true">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="mdate__weekday">
                    {w}
                  </span>
                ))}
              </div>
              <div className="mdate__grid">
                {cells.map((c) =>
                  c.type === 'blank' ? (
                    <span key={c.key} className="mdate__cell mdate__cell--blank" />
                  ) : (
                    <button
                      key={c.key}
                      type="button"
                      className={`mdate__cell mdate__cell--day${
                        selected && selected.y === viewY && selected.mo === viewMo && selected.d === c.d
                          ? ' is-selected'
                          : ''
                      }`}
                      onClick={() => pickDay(c.d)}
                    >
                      {c.d}
                    </button>
                  ),
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default ModernDateField
