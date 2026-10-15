import { useState } from 'react'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import TicketModal from './TicketModal'

/**
 * Abre la comanda de una orden: se ve en pantalla y se imprime desde el
 * navegador.
 *
 * Antes llamaba a `/comandas/{id}/print` y `/reprint`, que no existen en
 * Backend V2. La reimpresión desapareció con ellos: sin servicio de impresión
 * no hay historial de impresiones que repetir — volver a imprimir es abrir la
 * comanda otra vez.
 */
export default function ComandaActions({ orderId, createdAt, size = 'sm', showLabel = true, className }) {
  const [abierta, setAbierta] = useState(false)

  if (!isV2FeatureEnabled('comandas')) return null

  return (
    <>
      <Button size={size} variant="outline" onClick={() => setAbierta(true)} disabled={!orderId} className={className} title="Ver e imprimir la comanda">
        <Printer className="h-4 w-4" />
        {showLabel ? 'Comanda' : null}
      </Button>

      {abierta && (
        <TicketModal tipo="comanda" orderId={orderId} createdAt={createdAt} onClose={() => setAbierta(false)} />
      )}
    </>
  )
}
