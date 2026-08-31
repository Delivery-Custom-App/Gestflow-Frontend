import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { apiRequest } from '../../lib/apiClient'
import { formatCLP } from '../../lib/formatCLP'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  { value: 'comestible', label: 'Comestible' },
  { value: 'bebestible', label: 'Bebestible' },
]

const EMPTY_FORM = { name: '', category: 'comestible', quantity: '', price: '' }

export default function RegistrarProductoView() {
  const { localId } = useParams()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState([])
  const [loadingList, setLoadingList] = useState(false)

  const loadProducts = useCallback(() => {
    if (!localId) return
    setLoadingList(true)
    apiRequest(`/products/catalog?local_id=${localId}`)
      .then((groups) => setCategories(Array.isArray(groups) ? groups : []))
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [localId])

  useEffect(() => { loadProducts() }, [loadProducts])

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const isValid = form.name.trim().length > 0
    && Number(form.quantity) >= 0 && form.quantity !== ''
    && Number(form.price) > 0 && form.price !== ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isValid || submitting) return
    setSubmitting(true); setError('')
    try {
      await apiRequest('/products/register', {
        method: 'POST',
        body: {
          local_id: localId,
          name: form.name.trim(),
          category: form.category,
          quantity: Number(form.quantity),
          price: Number(form.price),
        },
      })
      setForm(EMPTY_FORM)
      loadProducts()
    } catch (err) {
      setError(err?.message || 'No se pudo registrar el producto')
    } finally {
      setSubmitting(false)
    }
  }

  const totalProducts = categories.reduce((s, g) => s + (g.products?.length || 0), 0)

  return (
    <div className="flex h-full flex-col overflow-y-auto no-scrollbar p-4 lg:p-6">
      <div className="max-w-xl w-full mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-black text-[hsl(var(--foreground))]">Registrar productos</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Productos de venta directa, sin receta.</p>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
            {error}<button type="button" className="ml-2 underline text-xs" onClick={() => setError('')}>✕</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-[hsl(var(--foreground))]">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={setField('name')}
              placeholder="Ej: Jugo natural"
              className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-bold text-[hsl(var(--foreground))]">Categoría</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, category: c.value }))}
                  className={cn(
                    'rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors',
                    form.category === c.value
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] hover:border-[hsl(var(--primary))]/50'
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[hsl(var(--foreground))]">Cantidad</label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={setField('quantity')}
                placeholder="0"
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-[hsl(var(--foreground))]">Precio</label>
              <input
                type="number"
                min="1"
                value={form.price}
                onChange={setField('price')}
                placeholder="$0"
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] outline-none focus:border-[hsl(var(--primary))]"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={!isValid || submitting}
            className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-white"
          >
            {submitting ? 'Registrando...' : 'Registrar producto'}
          </Button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[hsl(var(--foreground))]">Productos registrados</p>
            {totalProducts > 0 && (
              <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{totalProducts} en total</span>
            )}
          </div>

          {loadingList ? (
            <div className="flex flex-col items-center gap-2 py-6 text-[hsl(var(--muted-foreground))]">
              <div className="w-5 h-5 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Cargando productos...</p>
            </div>
          ) : totalProducts === 0 ? (
            <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">Todavía no hay productos registrados.</p>
          ) : (
            categories.map((group) => (
              <div key={group.category_id} className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{group.category_name}</p>
                {(group.products || []).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-3 text-sm">
                    <div>
                      <p className="font-bold text-[hsl(var(--foreground))]">{p.name}</p>
                      <p className="text-xs text-[hsl(var(--muted-foreground))]">Stock {p.stock}</p>
                    </div>
                    <span className="font-black text-[hsl(var(--primary))]">${formatCLP(p.price)}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
