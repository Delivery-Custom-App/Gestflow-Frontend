// Impresión ESC/POS vía Web Bluetooth (BLE). El backend solo genera los
// bytes del ticket (payload_base64) — el envío real ocurre acá, porque el
// radio Bluetooth lo tiene el navegador/dispositivo del cajero, no el server.
//
// UUIDs del perfil "printer service" que usan la mayoría de las ticketeras
// térmicas BLE económicas (Goojprt, MPT-II, HM-A300 y similares).
const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

const CHUNK_SIZE = 180
const CHUNK_DELAY_MS = 30

export function isBluetoothSupported() {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function writeInChunks(characteristic, bytes) {
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
    await characteristic.writeValue(chunk)
    await sleep(CHUNK_DELAY_MS)
  }
}

/**
 * Abre el selector nativo de dispositivos Bluetooth, conecta por GATT y
 * envía el payload ESC/POS (base64). Requiere HTTPS o localhost, y un gesto
 * del usuario (se llama desde el handler de un click).
 *
 * Sin `namePrefix` el selector muestra TODO dispositivo BLE cercano (celulares,
 * audífonos, etc.) — con miles de dispositivos alrededor es imposible ubicar
 * la impresora. Con `namePrefix` (el nombre Bluetooth real de la ticketera,
 * ej. "PRT5090BT") Chrome filtra y solo la muestra a ella.
 */
export async function printEscposViaBluetooth(base64Payload, namePrefix) {
  if (!isBluetoothSupported()) {
    throw new Error('Este navegador no soporta Web Bluetooth. Usa Chrome o Edge (desktop o Android) por HTTPS.')
  }

  const requestOptions = namePrefix
    ? { filters: [{ namePrefix }], optionalServices: [PRINTER_SERVICE_UUID] }
    : { acceptAllDevices: true, optionalServices: [PRINTER_SERVICE_UUID] }

  const device = await navigator.bluetooth.requestDevice(requestOptions)

  const server = await device.gatt.connect()
  try {
    const service = await server.getPrimaryService(PRINTER_SERVICE_UUID)
    const characteristic = await service.getCharacteristic(PRINTER_CHARACTERISTIC_UUID)
    await writeInChunks(characteristic, base64ToBytes(base64Payload))
    return { ok: true, deviceName: device.name || 'Impresora Bluetooth' }
  } finally {
    if (server.connected) server.disconnect()
  }
}
