import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnboarding } from '../../context/OnboardingContext'

const PAD = 10
const TOOLTIP_W = 292

function getRect(target) {
  const el = document.querySelector(`[data-onboarding="${target}"]`)
  if (!el) return null
  return el.getBoundingClientRect()
}

function Tooltip({ rect, title, desc, step, total, onNext, onSkip }) {
  const vw = window.innerWidth
  const vh = window.innerHeight

  // Place below target, or above if not enough space
  const spaceBelow = vh - rect.bottom
  const above = spaceBelow < 180 && rect.top > 180

  let left = rect.left + rect.width / 2 - TOOLTIP_W / 2
  left = Math.max(12, Math.min(left, vw - TOOLTIP_W - 12))

  const top = above ? rect.top - 8 : rect.bottom + PAD + 4

  // Arrow horizontal position relative to tooltip
  const arrowLeft = Math.max(16, Math.min(
    rect.left + rect.width / 2 - left - 6,
    TOOLTIP_W - 28
  ))

  return (
    <div style={{ position: 'fixed', top, left, width: TOOLTIP_W, zIndex: 10001, pointerEvents: 'all' }}>
      {/* Arrow up (tooltip is below target) */}
      {!above && (
        <div style={{
          position: 'absolute', top: -5, left: arrowLeft,
          width: 10, height: 10, background: '#fff',
          transform: 'rotate(45deg)',
          borderLeft: '1px solid #e5e7eb',
          borderTop: '1px solid #e5e7eb',
          zIndex: 1,
        }} />
      )}

      <div style={{
        background: '#fff',
        borderRadius: 14,
        boxShadow: '0 20px 60px -8px rgba(0,0,0,0.25), 0 4px 16px -4px rgba(0,0,0,0.12)',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              background: '#4f46e5', color: '#fff',
              borderRadius: 6, fontSize: 10, fontWeight: 700,
              padding: '2px 7px', letterSpacing: '0.05em',
            }}>
              {step + 1}/{total}
            </div>
          </div>
          <button
            onClick={onSkip}
            style={{ color: '#9ca3af', padding: 2, borderRadius: 4, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 14px 12px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.55 }}>{desc}</div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', background: '#f9fafb', borderTop: '1px solid #f3f4f6',
        }}>
          <button
            onClick={onSkip}
            style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
          >
            Saltar tour
          </button>
          <button
            onClick={onNext}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: '#fff',
              background: '#4f46e5', border: 'none', cursor: 'pointer',
              padding: '6px 12px', borderRadius: 8,
            }}
          >
            {step + 1 === total ? 'Entendido ✓' : 'Siguiente'}
            {step + 1 < total && <ChevronRight size={12} />}
          </button>
        </div>
      </div>

      {/* Arrow down (tooltip is above target) */}
      {above && (
        <div style={{
          position: 'absolute', bottom: -5, left: arrowLeft,
          width: 10, height: 10, background: '#fff',
          transform: 'rotate(45deg)',
          borderRight: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          zIndex: 1,
        }} />
      )}

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 16 : 5, height: 5,
            borderRadius: 3,
            background: i === step ? '#4f46e5' : 'rgba(255,255,255,0.55)',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>
    </div>
  )
}

export default function CoachMark() {
  const { active, step, steps, next, skip } = useOnboarding()
  const [rect, setRect] = useState(null)
  const [tick, setTick] = useState(0)

  const currentStep = steps?.[step]

  // Espera que el DOM se estabilice tras navegación, luego busca el elemento
  useEffect(() => {
    if (!active || !currentStep) { setRect(null); return }

    setRect(null) // limpia para evitar que se muestre en posición vieja

    let cancelled = false
    let attempts = 0

    // Delay inicial: deja que React Router y animaciones del sidebar se resuelvan
    const startDelay = setTimeout(() => {
      const try_ = () => {
        if (cancelled) return
        const r = getRect(currentStep.target)
        if (r) { setRect(r); return }
        if (attempts++ < 30) setTimeout(try_, 150)
      }
      try_()
    }, 350)

    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      cancelled = true
      clearTimeout(startDelay)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [active, step]) // solo step, no currentStep (evita re-trigger por referencia)

  // Re-lee posición al hacer resize/scroll
  useEffect(() => {
    if (!active || !currentStep) return
    const r = getRect(currentStep.target)
    if (r) setRect(r)
  }, [tick, active, currentStep])

  if (!active) return null

  return createPortal(
    <AnimatePresence mode="wait">
      {rect && (
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          style={{ position: 'fixed', inset: 0, zIndex: 10000 }}
        >
          {/* Click-through backdrop (clicking advances tour) */}
          <div
            style={{ position: 'absolute', inset: 0, cursor: 'default' }}
            onClick={next}
          />

          {/* Spotlight cutout via box-shadow */}
          <motion.div
            key={`spot-${step}`}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'absolute',
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              borderRadius: 10,
              boxShadow: '0 0 0 9999px rgba(10,10,30,0.68)',
              pointerEvents: 'none',
            }}
          />

          {/* Highlight ring */}
          <div style={{
            position: 'absolute',
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 10,
            border: '2px solid rgba(99,102,241,0.85)',
            pointerEvents: 'none',
            boxSizing: 'border-box',
          }} />

          <Tooltip
            rect={rect}
            title={currentStep.title}
            desc={currentStep.desc}
            step={step}
            total={steps.length}
            onNext={next}
            onSkip={skip}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
