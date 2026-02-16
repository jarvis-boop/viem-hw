/**
 * Base error class for all viem-hw errors
 */
export class HardwareWalletError extends Error {
  override readonly name: string = 'HardwareWalletError'
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.code = code
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

/**
 * Device is not connected or not found
 */
export class DeviceNotFoundError extends HardwareWalletError {
  override readonly name: string = 'DeviceNotFoundError'

  constructor(vendor: 'ledger' | 'trezor', details?: string) {
    super(
      `${vendor === 'ledger' ? 'Ledger' : 'Trezor'} device not found${details ? `: ${details}` : ''}`,
      'DEVICE_NOT_FOUND'
    )
  }
}

/**
 * User rejected the action on the device
 */
export class UserRejectedError extends HardwareWalletError {
  override readonly name: string = 'UserRejectedError'

  constructor(action: 'signature' | 'connection' | 'address') {
    super(`User rejected ${action} on device`, 'USER_REJECTED')
  }
}

/**
 * Transport layer error (WebHID/WebUSB communication failure)
 */
export class TransportError extends HardwareWalletError {
  override readonly name: string = 'TransportError'

  constructor(message: string) {
    super(`Transport error: ${message}`, 'TRANSPORT_ERROR')
  }
}

/**
 * Device is locked (requires PIN or passphrase)
 */
export class DeviceLockedError extends HardwareWalletError {
  override readonly name: string = 'DeviceLockedError'

  constructor(vendor: 'ledger' | 'trezor') {
    super(
      `${vendor === 'ledger' ? 'Ledger' : 'Trezor'} device is locked. Please unlock it first.`,
      'DEVICE_LOCKED'
    )
  }
}

/**
 * App not open on Ledger device
 */
export class AppNotOpenError extends HardwareWalletError {
  override readonly name: string = 'AppNotOpenError'

  constructor(requiredApp = 'Ethereum') {
    super(`Please open the ${requiredApp} app on your Ledger device`, 'APP_NOT_OPEN')
  }
}

/**
 * Invalid derivation path
 */
export class InvalidPathError extends HardwareWalletError {
  override readonly name: string = 'InvalidPathError'

  constructor(path: string, reason?: string) {
    super(`Invalid derivation path "${path}"${reason ? `: ${reason}` : ''}`, 'INVALID_PATH')
  }
}

/**
 * Unsupported operation for this device/configuration
 */
export class UnsupportedOperationError extends HardwareWalletError {
  override readonly name: string = 'UnsupportedOperationError'

  constructor(operation: string, reason?: string) {
    super(
      `Unsupported operation: ${operation}${reason ? `. ${reason}` : ''}`,
      'UNSUPPORTED_OPERATION'
    )
  }
}

/**
 * Connection timeout
 */
export class ConnectionTimeoutError extends HardwareWalletError {
  override readonly name: string = 'ConnectionTimeoutError'

  constructor(timeoutMs: number) {
    super(`Connection timed out after ${timeoutMs}ms`, 'CONNECTION_TIMEOUT')
  }
}

/**
 * Maps vendor-specific errors to viem-hw unified errors
 */
export function mapLedgerError(error: unknown): HardwareWalletError {
  if (error instanceof HardwareWalletError) {
    return error
  }

  const err = error as { statusCode?: number; message?: string; name?: string }
  const message = err.message ?? String(error)

  // Ledger status codes
  // https://github.com/LedgerHQ/ledger-live/blob/develop/libs/ledgerjs/packages/errors/src/index.ts
  switch (err.statusCode) {
    case 0x6985: // User rejected
    case 0x6986:
      return new UserRejectedError('signature')
    case 0x6a80: // Invalid data
    case 0x6a82:
      return new HardwareWalletError(`Invalid data: ${message}`, 'INVALID_DATA')
    case 0x6b00: // Wrong parameter
      return new HardwareWalletError(`Wrong parameter: ${message}`, 'WRONG_PARAMETER')
    case 0x6d00: // INS not supported
    case 0x6e00: // CLA not supported
      return new UnsupportedOperationError(message)
    case 0x6faa: // Device locked
      return new DeviceLockedError('ledger')
  }

  // String-based error detection
  if (message.includes('0x6985') || message.includes('denied') || message.includes('rejected')) {
    return new UserRejectedError('signature')
  }
  if (
    message.includes('locked') ||
    message.includes('pin') ||
    message.toLowerCase().includes('0x6faa')
  ) {
    return new DeviceLockedError('ledger')
  }
  if (
    message.includes('not found') ||
    message.includes('no device') ||
    err.name === 'TransportOpenUserCancelled'
  ) {
    return new DeviceNotFoundError('ledger', message)
  }
  if (message.includes('app') && (message.includes('open') || message.includes('launch'))) {
    return new AppNotOpenError()
  }

  return new HardwareWalletError(message, 'UNKNOWN_ERROR')
}

/**
 * Maps Trezor Connect errors to viem-hw unified errors
 */
export function mapTrezorError(error: unknown): HardwareWalletError {
  if (error instanceof HardwareWalletError) {
    return error
  }

  const err = error as { code?: string; message?: string; error?: string }
  const message = err.message ?? err.error ?? String(error)
  const code = err.code ?? ''

  // Trezor error codes
  // https://github.com/trezor/trezor-suite/blob/develop/packages/connect/src/constants/errors.ts
  switch (code) {
    case 'Failure_ActionCancelled':
    case 'Method_Cancel':
      return new UserRejectedError('signature')
    case 'Device_CallInProgress':
      return new HardwareWalletError('Device is busy with another operation', 'DEVICE_BUSY')
    case 'Device_InvalidState':
    case 'Device_NotInitialized':
      return new DeviceLockedError('trezor')
    case 'Transport_Missing':
    case 'Device_NotFound':
      return new DeviceNotFoundError('trezor', message)
  }

  // String-based detection
  if (message.includes('cancelled') || message.includes('rejected') || message.includes('denied')) {
    return new UserRejectedError('signature')
  }
  if (message.includes('not found') || message.includes('no device')) {
    return new DeviceNotFoundError('trezor', message)
  }
  if (message.includes('pin') || message.includes('passphrase') || message.includes('locked')) {
    return new DeviceLockedError('trezor')
  }

  return new HardwareWalletError(message, 'UNKNOWN_ERROR')
}
