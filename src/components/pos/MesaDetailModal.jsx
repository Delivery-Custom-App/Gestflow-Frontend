import { useState, useEffect, useCallback, useMemo } from 'react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { createOrder } from '../../lib/salesApi'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import MenuCategoryAccordion from './menu-picker/MenuCategoryAccordion'
import RecipeCustomizer from './menu-picker/RecipeCustomizer'
import { calcItemPrice, isCompleto, productKey } from './menu-picker/menuPricing'

/* ─── helpers ─────────────────────────────────────────────── */
const Spinner = () => (
  <div className="flex flex-col items-center gap-2 py-8 text-[hsl(var(--muted-foreground))]">
    <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
    <p className="text-xs">Cargando...</p>
  </div>
)

/* ─── modal principal ─────────────────────────────────────── */
export default function MesaDetailModal({ mesa, localId, cajaId, onClose, onTableUpdated }) {
  const { data: menuData, loading: menuLoading, fetch: fetchMenu } = useMenuPOS(localId)

  const [step, setStep]                 = useState('select')   // 'select' | 'customize'
  const [selectedQtys, setSelectedQtys] = useState({})
  const [customizations, setCustomizations] = useState({})     // { itemKey: {embutido, agregados} }

  const [processing, setProcessing] = useState(false)
  const [error, setError]           = useState('')

  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  useEffect(() => { fetchMenu() }, [fetchMenu])

  /* lista plana de todos los productos del menú (para check de disponibilidad) */
  const allMenuProducts = useMemo(() =>
    (menuData?.categories ?? []).flatMap(c => c.products || []),
    [menuData]
  )

  /* Misma carta que el Creador de menú (fetchPosMenu / local-products activos) */
  const categorizedItems = useMemo(() => {
    return (menuData?.categories ?? [])
      .map((cat) => ({
        name: cat.name || 'Sin categoría',
        items: (cat.products || []).map((p) => ({
          key: productKey(p.id),
          id: p.id,
          type: 'product',
          categoryName: cat.name || 'Sin categoría',
          name: p.name,
          description: p.description || '',
          price: p.price || 0,
        })),
      }))
      .filter((cat) => cat.items.length > 0)
  }, [menuData])

  const allItems = useMemo(() =>
    categorizedItems.flatMap(cat => cat.items),
    [categorizedItems]
  )

  /* totales — incluye precio de extras si estamos en paso customize */
  const totalItems = Object.values(selectedQtys).reduce((s, q) => s + q, 0)
  const subtotal   = Object.entries(selectedQtys).reduce((s, [key, qty]) => {
    const it   = allItems.find(i => i.key === key)
    const cust = step === 'customize' ? customizations[key] : null
    return s + calcItemPrice(it?.price || 0, cust) * qty
  }, 0)

  /* items de completo/sandwich seleccionados (requieren personalización) */
  const menuItemsSelected = useMemo(() =>
    allItems.filter(it => (isCompleto(it) || it.type === 'recipe') && (selectedQtys[it.key] || 0) > 0),
    [allItems, selectedQtys]
  )

  const handleAdd = useCallback((key) => {
    setSelectedQtys(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [])
  const handleRemove = useCallback((key) => {
    setSelectedQtys(prev => {
      const next = { ...prev }
      if ((next[key] || 0) <= 1) delete next[key]
      else next[key]--
      return next
    })
  }, [])

  /* ir a paso de personalización */
  const handleContinuar = () => {
    // Inicializar customizations para cada item de receta seleccionado
    const init = {}
    menuItemsSelected.forEach(it => {
      init[it.key] = customizations[it.key] || { embutido: null, agregados: [] }
    })
    setCustomizations(init)
    setStep('customize')
  }

  /* crear la orden */
  const handleConfirmOrder = async () => {
    if (!totalItems) { setError('Selecciona al menos un producto'); return }
    // Validar que sandwiches tengan proteína seleccionada
    const sandwichSinProteina = menuItemsSelected
      .filter(it => !isCompleto(it))
      .find(it => !(customizations[it.key]?.embutido))
    if (sandwichSinProteina) {
      setError(`Selecciona una proteína para "${sandwichSinProteina.name}"`)
      return
    }
    setProcessing(true); setError('')
    try {
      const items = Object.entries(selectedQtys).map(([key, quantity]) => {
        const it   = allItems.find(i => i.key === key)
        const cust = customizations[key]
        let itemName = it?.name || 'Producto'
        if (cust?.embutido)           itemName += ` [${cust.embutido}]`
        if (cust?.agregados?.length)  itemName += ` + ${cust.agregados.join(', ')}`
        const unitPrice = Math.round(calcItemPrice(it?.price || 0, cust))
        const base = { item_name: itemName, quantity, unit_price: unitPrice }
        return it?.type === 'recipe' ? { ...base, recipe_id: it.id } : { ...base, product_id: it.id }
      })
      await createOrder({
        local_id: localId,
        mesa_id: mesa.id,
        caja_id: cajaId || null,
        source: 'dine_in',
        items,
      })
      onTableUpdated?.()
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Error al crear la orden')
    } finally {
      setProcessing(false) }
  }

  const loading = menuLoading

  /* ─── un solo return para ambos pasos — bottom sheet mobile, drawer desktop ─── */
  return (
    <div className="fixed inset-0 z-50">
      <div
        className={cn('absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={handleClose}
      />
      
      {/* Mobile: Bottom sheet / Desktop: Right drawer */}
      <div className={cn(
        'absolute flex flex-col shadow-2xl bg-[hsl(var(--card))] border overflow-hidden transition-transform duration-300 ease-out',
        // Mobile: bottom sheet
        'inset-x-0 bottom-0 max-h-[90vh] rounded-t-3xl border-t border-[hsl(var(--border))]',
        // Desktop: right drawer
        'md:inset-y-0 md:right-0 md:left-auto md:w-full md:max-w-3xl xl:max-w-4xl md:max-h-none md:rounded-none md:border-l md:border-t-0',
        // Transitions
        visible 
          ? 'translate-y-0 md:translate-x-0 md:translate-y-0' 
          : 'translate-y-full md:translate-x-full md:translate-y-0'
      )}>

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-3 border-b border-[hsl(var(--border))] shrink-0">
          {/* Mobile: Drag handle */}
          <div className="md:hidden flex justify-center mb-3">
            <div className="w-12 h-1.5 rounded-full bg-[hsl(var(--muted))]" />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {step === 'customize' && (
                <button 
                  onClick={() => setStep('select')} 
                  className="flex items-center justify-center h-8 w-8 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
                  aria-label="Volver"
                >
                  ←
                </button>
              )}
              <div>
                <span className="text-base font-semibold text-[hsl(var(--foreground))]">{mesa.name}</span>
                <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))] font-normal">
                  {step === 'customize' ? 'Personalización' : `${mesa.zona || 'General'} · ${mesa.capacidad} personas`}
                </span>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* ── Contenido según step ── */}
        {step === 'select' ? (
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-5 py-4 space-y-3">
            {loading ? <Spinner /> : categorizedItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
                  No hay productos en venta para este local
                </p>
                <p className="mt-1 max-w-xs text-xs text-[hsl(var(--muted-foreground))]">
                  Actívalos en Inventario → Menú (misma carta que Mesas).
                </p>
              </div>
            ) : (
              categorizedItems.map(cat => (
                <MenuCategoryAccordion
                  key={cat.name}
                  label={cat.name}
                  items={cat.items}
                  selectedQtys={selectedQtys}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 px-5 py-5 space-y-5">
            {menuItemsSelected.filter(isCompleto).map(it => (
              <RecipeCustomizer
                key={it.key}
                variant="completo"
                item={it}
                qty={selectedQtys[it.key] || 0}
                customization={customizations[it.key] || { embutido: null, agregados: [] }}
                onChange={(val) => setCustomizations(prev => ({ ...prev, [it.key]: val }))}
                availableProducts={allMenuProducts}
              />
            ))}
            {menuItemsSelected.filter(it => !isCompleto(it)).map(it => (
              <RecipeCustomizer
                key={it.key}
                variant="sandwich"
                item={it}
                qty={selectedQtys[it.key] || 0}
                customization={customizations[it.key] || { embutido: null, agregados: [] }}
                onChange={(val) => setCustomizations(prev => ({ ...prev, [it.key]: val }))}
                availableProducts={allMenuProducts}
              />
            ))}
            {/* Productos sin personalización (ej: bebidas, postres, etc.) */}
            {allItems.filter(it => it.type === 'product' && (selectedQtys[it.key] || 0) > 0).length > 0 && (
              <div className="rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-sm">
                <p className="text-sm font-black text-[hsl(var(--foreground))]">Productos seleccionados</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {allItems.filter(it => it.type === 'product' && (selectedQtys[it.key] || 0) > 0).map(it => (
                    <div key={it.key} className="flex items-center justify-between rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{it.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">${formatCLP(it.price)}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-[hsl(var(--primary))]/10 px-3 py-1 font-black text-[hsl(var(--primary))]">×{selectedQtys[it.key]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer según step ── */}
        {step === 'select' ? (
          totalItems > 0 && (
            <div className="px-5 py-4 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--card))]">
              <div className="flex items-center justify-between w-full gap-3">
                <div className="flex-1">
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    {totalItems} producto{totalItems !== 1 ? 's' : ''}
                  </p>
                  <p className="text-lg font-bold text-[hsl(var(--primary))]">
                    ${formatCLP(subtotal)}
                  </p>
                </div>
                <Button 
                  size="lg" 
                  onClick={handleContinuar}
                  className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-bold px-8 h-12 rounded-xl shadow-lg"
                >
                  Continuar →
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="px-5 py-4 border-t border-[hsl(var(--border))] shrink-0 bg-[hsl(var(--card))]">
            <div className="flex items-center justify-between w-full gap-3">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setStep('select')} 
                disabled={processing}
                className="h-12 rounded-xl"
              >
                ← Volver
              </Button>
              <Button 
                size="lg" 
                onClick={handleConfirmOrder} 
                disabled={processing}
                className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white font-bold h-12 rounded-xl shadow-lg"
              >
                {processing ? 'Confirmando...' : `Confirmar · $${formatCLP(subtotal)}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
