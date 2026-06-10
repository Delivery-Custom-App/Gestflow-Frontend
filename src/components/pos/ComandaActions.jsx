import { useState } from 'react'
import { Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { printComanda, reprintComanda } from '../../lib/apiClient'
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
        toast.success('Reimpresión enviada a la impresora')
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
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size={size}
        onClick={handlePrint}
        disabled={printing}
        title="Imprimir comanda"
        className="flex items-center gap-1.5"
      >
        <Printer className="w-4 h-4" />
        {showLabel && <span>{printing ? 'Imprimiendo...' : 'Imprimir'}</span>}
      </Button>
      <Button
        variant="outline"
        size={size}
        onClick={handleReprint}
        disabled={reprinting}
        title="Reimprimir comanda (copia)"
        className="flex items-center gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
      >
        <RotateCcw className="w-4 h-4" />
        {showLabel && <span>{reprinting ? 'Reimprimiendo...' : 'Reimprimir'}</span>}
      </Button>
    </div>
  )
}
