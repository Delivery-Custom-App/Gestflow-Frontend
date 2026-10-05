import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCLPCurrency as formatMoney } from '../../lib/formatCLP'
import { TURNOS_POR_PAGINA, horaDe, useTotalesVendidos } from '../../lib/registroTurnos'

/** "YYYY-MM-DD" → "dd/mm/yyyy" sin pasar por Date: es un día calendario, no un instante. */
function fechaDelTurno(value) {
  const [y, m, d] = String(value || '').split('-')
  return y && m && d ? `${d}/${m}/${y}` : 'Sin fecha'
}

function TotalVendido({ valor }) {
  if (valor === undefined) return <span className="text-[hsl(var(--muted-foreground))]">…</span>
  if (valor === false) return <span className="text-[hsl(var(--muted-foreground))]" title="No se pudo consultar">—</span>
  return formatMoney(valor)
}

/**
 * Tabla de turnos: fecha, hora de apertura y de cierre, total vendido y
 * estado. Con `cajaFisicaDe` agrega el turno y su caja física; con
 * `vendedorDe`, quién lo abrió. La máquina usada no se muestra mientras el
 * turno no la guarde (B-03).
 *
 * Se muestran de a TURNOS_POR_PAGINA: cada fila pide su total vendido.
 */
export default function TablaTurnos({ turnos, vendedorDe, cajaFisicaDe, onVer, textoVer = 'Ver resumen', vacio }) {
  const [visibles, setVisibles] = useState(TURNOS_POR_PAGINA)
  const lista = Array.isArray(turnos) ? turnos : []
  const pagina = lista.slice(0, visibles)
  const totales = useTotalesVendidos(pagina)

  const encabezados = [
    ...(cajaFisicaDe ? ['Turno'] : []),
    ...(vendedorDe ? ['Vendedor'] : []),
    'Fecha', 'Apertura', 'Cierre', 'Total vendido', 'Estado',
    ...(onVer ? ['Acciones'] : []),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--muted))]">
            <tr>
              {encabezados.map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagina.length === 0 ? (
              <tr>
                <td colSpan={encabezados.length} className="px-4 py-6 text-center text-xs text-[hsl(var(--muted-foreground))]">{vacio}</td>
              </tr>
            ) : pagina.map((t) => {
              const abierto = t.is_active === true || String(t.status) === 'open'
              const cajaFisica = cajaFisicaDe?.(t)
              return (
                <tr key={t.id} className="border-t border-[hsl(var(--border))]">
                  {cajaFisicaDe && (
                    <td className="px-4 py-3">
                      <span>{t.name || 'Turno sin nombre'}</span>
                      {cajaFisica && <span className="block text-xs text-[hsl(var(--muted-foreground))]">{cajaFisica}</span>}
                    </td>
                  )}
                  {vendedorDe && <td className="px-4 py-3">{vendedorDe(t)}</td>}
                  <td className="px-4 py-3 whitespace-nowrap">{fechaDelTurno(t.business_date)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{horaDe(t.opened_at) || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{abierto ? '—' : (horaDe(t.closed_at) || '—')}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-semibold"><TotalVendido valor={totales.get(String(t.id))} /></td>
                  <td className="px-4 py-3">{abierto ? 'Abierto' : 'Cerrado'}</td>
                  {onVer && (
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => onVer(t)}>{textoVer}</Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {lista.length > visibles && (
        <div className="flex items-center justify-between gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          <span>Mostrando {visibles} de {lista.length}</span>
          <Button size="sm" variant="outline" onClick={() => setVisibles((n) => n + TURNOS_POR_PAGINA)}>Ver más</Button>
        </div>
      )}
    </div>
  )
}
