import { useEffect, useState, useMemo } from 'react'
import { useMenuPOS } from '../../hooks/useMenuPOS'
import { formatCLP } from '../../lib/formatCLP'
import '../../styles/MenuModal.css'

/**
 * HU-65 SCRUM-469
 * SCRUM-505: KPIs por categoría
 * SCRUM-506: Filtros por nombre y categoría
 * SCRUM-507: Lista de productos renderizada
 * HU-46 / SCRUM-429: búsqueda por texto vía API (`?search=`) con debounce; categoría sigue filtrándose en cliente.
 */
export default function MenuModal({ localId, onClose }) {
  const { data, loading, error, fetch } = useMenuPOS(localId)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedCat, setSelectedCat] = useState('all')

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(id)
  }, [search])

  useEffect(() => {
    fetch({ search: debouncedSearch })
  }, [fetch, debouncedSearch])

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  // SCRUM-506: filtrar por categoría (la búsqueda por texto la aplica el backend, HU-46)
  const filteredCategories = useMemo(() => {
    if (!data?.categories) return []

    return data.categories
      .filter((cat) => selectedCat === 'all' || cat.id === selectedCat)
      .filter((cat) => (cat.products?.length || 0) > 0)
  }, [data, selectedCat])

  const totalVisible = filteredCategories.reduce((sum, c) => sum + c.products.length, 0)

  return (
    <div className="menu-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Menú del local">
      <div className="menu-modal">

        {/* Header */}
        <header className="menu-header">
          <div className="menu-header-title">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <h2>Menú</h2>
            {data && (
              <span className="menu-total-badge">{data.total_products} productos</span>
            )}
          </div>
          <button className="menu-close" onClick={onClose} aria-label="Cerrar menú">✕</button>
        </header>

        {/* SCRUM-505: KPIs por categoría */}
        {data?.categories?.length > 0 && (
          <div className="menu-kpis" role="list" aria-label="Filtrar por categoría">
            <button
              className={`menu-kpi-chip${selectedCat === 'all' ? ' active' : ''}`}
              onClick={() => setSelectedCat('all')}
            >
              <span className="menu-kpi-name">Todos</span>
              <span className="menu-kpi-count">{data.total_products}</span>
            </button>
            {data.categories.map((cat) => (
              <button
                key={cat.id}
                className={`menu-kpi-chip${selectedCat === cat.id ? ' active' : ''}`}
                onClick={() => setSelectedCat(selectedCat === cat.id ? 'all' : cat.id)}
              >
                <span className="menu-kpi-name">{cat.name}</span>
                <span className="menu-kpi-count">{cat.product_count}</span>
              </button>
            ))}
          </div>
        )}

        {/* SCRUM-506: Filtros */}
        {data && !loading && !error && (
          <div className="menu-filters">
            <div className="menu-search-wrapper">
              <svg className="menu-search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                className="menu-search-input"
                type="text"
                placeholder="Buscar producto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar producto por nombre"
              />
            </div>
            <select
              className="menu-cat-select"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              aria-label="Filtrar por categoría"
            >
              <option value="all">Todas las categorías</option>
              {data.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Body */}
        <div className="menu-body">
          {loading && (
            <div className="menu-loading">
              <div className="menu-spinner" aria-label="Cargando..." />
              <p>Cargando menú...</p>
            </div>
          )}

          {error && (
            <div className="menu-error">
              <p>Error al cargar el menú: {error}</p>
              <button type="button" onClick={() => fetch({ search: debouncedSearch })} style={{ marginTop: '0.75rem', padding: '0.5rem 1.25rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}>
                Reintentar
              </button>
            </div>
          )}

          {/* SCRUM-507: Lista de productos */}
          {!loading && !error && data && (
            <>
              {filteredCategories.length === 0 ? (
                <p className="menu-empty">
                  {search ? `Sin resultados para "${search}"` : 'No hay productos disponibles.'}
                </p>
              ) : (
                filteredCategories.map((cat) => (
                  <section key={cat.id} className="menu-category-group">
                    <h3 className="menu-category-label">{cat.name} ({cat.products.length})</h3>
                    {cat.products.map((product) => (
                      <div key={product.id} className="menu-product-item">
                        <div className="menu-product-info">
                          <span className="menu-product-name">{product.name}</span>
                          {product.description && (
                            <span className="menu-product-desc">{product.description}</span>
                          )}
                        </div>
                        <span className="menu-product-price">${formatCLP(product.price)}</span>
                      </div>
                    ))}
                  </section>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="menu-footer">
          <button className="menu-btn-cerrar" onClick={onClose}>Cerrar</button>
        </footer>

      </div>
    </div>
  )
}
