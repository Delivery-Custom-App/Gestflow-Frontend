import { useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { printComanda, reprintComanda } from '../../lib/apiClient'
import { isV2FeatureEnabled } from '../../lib/v2Features'
import { toast } from 'sonner'

/**
 * ComandaActions — Print and Reprint buttons for an order (OP-02 AC2 + AC4).
 *
 * Props:
 *   orderId       — UUID of the order to print
 *   size          — Button size ("sm" | "default")
 *   showLabel     — Show text labels next to icons
 */
export default function ComandaActions({ orderId, size = 'sm', showLabel = true }) {
  const [printing, setPrinting] = useState(false)
  const [reprinting, setReprinting] = useState(false)

  if (!isV2FeatureEnabled('comandas')) {
    return null
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const res = await printComanda(orderId)
      if (res?.status === 'SENT') {
        toast.success('Comanda enviada a la impresora')
      } else if (res?.warning) {
        toast.warning(res.warning)
      } else if (res?.status === 'FAILED') {
        toast.error('Error al imprimir: ' + (res.error_message || 'Error desconocido'))
      } else {
        toast.success('Comanda procesada')
      }
    } catch (err) {
      toast.error('Error al imprimir: ' + err.message)
    } finally {
      setPrinting(false)
    }
  }

  async function handleReprint() {
    setReprinting(true)
    try {
      const res = await reprintComanda(orderId)
      if (res?.status === 'SENT') {
        toast.success('Reimpresión enviada')
      } else if (res?.warning) {
        toast.warning(res.warning)
      } else if (res?.status === 'FAILED') {
        toast.error('Error al reimprimir: ' + (res.error_message || 'Error desconocido'))
      } else {
        toast.success('Reimpresión procesada')
      }
    } catch (err) {
      toast.error('Error al reimprimir: ' + err.message)
    } finally {
      setReprinting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button size={size} variant="outline" onClick={handlePrint} disabled={printing || !orderId}>
        <Printer className="h-4 w-4" />
        {showLabel ? (printing ? 'Imprimiendo…' : 'Comanda') : null}
      </Button>
      <Button size={size} variant="ghost" onClick={handleReprint} disabled={reprinting || !orderId}>
        <RotateCcw className="h-4 w-4" />
        {showLabel ? (reprinting ? 'Reimprimiendo…' : 'Reimprimir') : null}
      </Button>
    </div>
  )
}
