import { formatCLP } from '../../../lib/formatCLP'
import { AGREGADOS, EMBUTIDOS, EMBUTIDO_SURCHARGE, SANDWICH_PROTEINAS, calcItemPrice, norm } from './menuPricing'

const VARIANT_CONFIG = {
  completo: {
    badge: 'Completo',
    proteinLabel: 'Cambio de embutido',
    proteinHint: `Opcional · +$${formatCLP(EMBUTIDO_SURCHARGE)}`,
    proteinOptions: EMBUTIDOS,
    requireProtein: false,
  },
  sandwich: {
    badge: 'Sandwich',
    proteinLabel: 'Proteína',
    proteinHint: 'Selecciona una para continuar.',
    proteinOptions: SANDWICH_PROTEINAS,
    requireProtein: true,
  },
}

/** Customizador de personalización de recetas ("completo" o "sandwich") — proteína/embutido + agregados. */
export default function RecipeCustomizer({ variant, item, qty, customization, onChange, availableProducts }) {
  const cfg = VARIANT_CONFIG[variant] || VARIANT_CONFIG.completo

  function hasIngredient(matchKeyword) {
    if (!matchKeyword) return true
    const n = norm(matchKeyword)
    return availableProducts.some(p => norm(p.name).includes(n) || n.includes(norm(p.name)))
  }

  const setProteina = (val) =>
    onChange({ ...customization, embutido: customization.embutido === val ? null : val })

  const toggleAgregado = (label) =>
    onChange({
      ...customization,
      agregados: customization.agregados.includes(label)
        ? customization.agregados.filter(a => a !== label)
        : [...customization.agregados, label],
    })

  const unitPrice = calcItemPrice(item.price, customization)
  const totalPrice = unitPrice * qty
  const agregadosTotal = (customization.agregados || []).reduce((s, l) => {
    const a = AGREGADOS.find(ag => ag.label === l)
    return s + (a?.price || 0)
  }, 0)

  return (
    <div className="overflow-hidden rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--primary))]/12 via-[hsl(var(--accent))] to-[hsl(var(--card))] px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[hsl(var(--primary))]">{cfg.badge}</p>
          <p className="mt-1 text-lg font-black leading-tight text-[hsl(var(--foreground))]">{item.name}</p>
          <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Base ${formatCLP(item.price)} · cantidad {qty}</p>
        </div>
        <div className="rounded-2xl bg-[hsl(var(--card))]/90 px-4 py-3 text-right shadow-sm ring-1 ring-[hsl(var(--border))]">
          <p className="text-xs font-bold text-[hsl(var(--muted-foreground))]">Unitario</p>
          <p className="text-2xl font-black text-[hsl(var(--primary))]">${formatCLP(unitPrice)}</p>
          {qty > 1 && <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Total ${formatCLP(totalPrice)}</p>}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-5 lg:grid-cols-[0.9fr_1.4fr]">
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3">
            <p className="text-sm font-black text-[hsl(var(--foreground))]">{cfg.proteinLabel}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{cfg.proteinHint}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {cfg.proteinOptions.map(p => {
              const available = hasIngredient(p.match)
              const selected  = customization.embutido === p.label
              return (
                <button key={p.id} type="button" disabled={!available} onClick={() => setProteina(p.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-4 py-3 text-sm font-black transition-all text-left',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-md'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  {p.label}
                  {!available && <span className="block text-[10px] font-normal opacity-70">Sin stock</span>}
                </button>
              )
            })}
          </div>
          {cfg.requireProtein && !customization.embutido && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">Selecciona una proteína para continuar</p>
          )}
        </section>

        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[hsl(var(--foreground))]">Agregados</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Toca para sumar o quitar extras.</p>
            </div>
            {customization.agregados.length > 0 && <span className="rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 text-xs font-black text-[hsl(var(--primary))]">+${formatCLP(agregadosTotal)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
            {AGREGADOS.map(a => {
              const available = hasIngredient(a.match)
              const selected  = customization.agregados.includes(a.label)
              return (
                <button key={a.id} type="button" disabled={!available} onClick={() => toggleAgregado(a.label)}
                  className={[
                    'min-h-14 rounded-2xl border px-3 py-2 text-left transition-all flex flex-col justify-center gap-1',
                    !available
                      ? 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] text-[hsl(var(--muted-foreground))] opacity-50 cursor-not-allowed'
                      : selected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] shadow-sm'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary)/0.5)] hover:text-[hsl(var(--primary))]',
                  ].join(' ')}>
                  <span className="truncate text-sm font-black">{a.label}</span>
                  <span className={`text-xs font-bold ${selected ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]'}`}>
                    {!available ? 'Sin stock' : `$${formatCLP(a.price)}`}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
