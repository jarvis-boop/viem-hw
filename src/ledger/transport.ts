import { DeviceNotFoundError, TransportError } from '../shared/errors.js'

/**
 * Transport type for Ledger device communication
 */
export type TransportType = 'webhid' | 'webusb'

/**
 * Ledger Transport interface (minimal subset we need)
 */
export interface LedgerTransport {
  send(
    cla: number,
    ins: number,
    p1: number,
    p2: number,
    data?: Uint8Array | Buffer
  ): Promise<Buffer>
  close(): Promise<void>
}

/**
 * Options for transport creation
 */
export interface TransportOptions {
  /** Preferred transport type (default: 'webhid') */
  transportType?: TransportType
  /** Timeout in ms for device selection (default: 60000) */
  timeout?: number
}

/**
 * Dynamically imports and creates a WebHID transport
 */
async function createWebHIDTransport(timeout: number): Promise<LedgerTransport> {
  try {
    // Dynamic import to avoid bundling if not used
    const module = await import('@ledgerhq/hw-transport-webhid')
    const TransportWebHID = module.default
    return await (TransportWebHID as unknown as { create(timeout: number): Promise<LedgerTransport> }).create(timeout)
  } catch (error) {
    const err = error as { message?: string }
    if (err.message?.includes('cannot find module')) {
      throw new TransportError(
        '@ledgerhq/hw-transport-webhid is not installed. ' +
          'Install it with: npm install @ledgerhq/hw-transport-webhid'
      )
    }
    throw error
  }
}

/**
 * Dynamically imports and creates a WebUSB transport
 */
async function createWebUSBTransport(timeout: number): Promise<LedgerTransport> {
  try {
    const module = await import('@ledgerhq/hw-transport-webusb')
    const TransportWebUSB = module.default
    return await (TransportWebUSB as unknown as { create(timeout: number): Promise<LedgerTransport> }).create(timeout)
  } catch (error) {
    const err = error as { message?: string }
    if (err.message?.includes('cannot find module')) {
      throw new TransportError(
        '@ledgerhq/hw-transport-webusb is not installed. ' +
          'Install it with: npm install @ledgerhq/hw-transport-webusb'
      )
    }
    throw error
  }
}

/**
 * Creates a Ledger transport using the specified method
 */
export async function createTransport(
  options: TransportOptions = {}
): Promise<LedgerTransport> {
  const { transportType = 'webhid', timeout = 60000 } = options

  try {
    if (transportType === 'webhid') {
      return await createWebHIDTransport(timeout)
    } else {
      return await createWebUSBTransport(timeout)
    }
  } catch (error) {
    const err = error as { name?: string; message?: string }

    // Handle user cancellation
    if (err.name === 'TransportOpenUserCancelled') {
      throw new DeviceNotFoundError('ledger', 'User cancelled device selection')
    }

    // Handle no device found
    if (err.message?.includes('No device selected') || err.message?.includes('no device')) {
      throw new DeviceNotFoundError('ledger')
    }

    throw error
  }
}

/**
 * Check if WebHID is available in the current environment
 */
export function isWebHIDAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'hid' in navigator
}

/**
 * Check if WebUSB is available in the current environment
 */
export function isWebUSBAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator
}

/**
 * Determines the best available transport type for the current environment
 */
export function getBestTransportType(): TransportType | null {
  if (isWebHIDAvailable()) return 'webhid'
  if (isWebUSBAvailable()) return 'webusb'
  return null
}
