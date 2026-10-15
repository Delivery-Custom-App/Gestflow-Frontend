const CAMPO = 'h-9 rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.4)]'
const ETIQUETA = 'text-xs font-semibold text-[hsl(var(--muted-foreground))]'

/**
 * Filtros de la tabla de turnos: por fecha y, si se pasan `vendedores`, por
 * quién abrió el turno.
 */
export default function FiltrosTurnos({ vendedores, vendedorId, onVendedor, fecha, onFecha }) {
  const hayFiltro = Boolean(fecha || vendedorId)
  return (
    <div className="flex flex-wrap items-end gap-3">
      {vendedores && (
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-turnos-vendedor" className={ETIQUETA}>Vendedor</label>
          <select id="filtro-turnos-vendedor" value={vendedorId} onChange={(e) => onVendedor(e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="filtro-turnos-fecha" className={ETIQUETA}>Fecha</label>
        <input id="filtro-turnos-fecha" type="date" value={fecha} onChange={(e) => onFecha(e.target.value)} className={CAMPO} />
      </div>
      {hayFiltro && (
        <button type="button" onClick={() => { onFecha(''); onVendedor?.('') }}
          className="h-9 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors">
          Quitar filtros
        </button>
      )}
    </div>
  )
}
