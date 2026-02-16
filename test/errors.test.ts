import { describe, expect, it } from 'bun:test'
import {
  HardwareWalletError,
  DeviceNotFoundError,
  UserRejectedError,
  TransportError,
  DeviceLockedError,
  AppNotOpenError,
  InvalidPathError,
  UnsupportedOperationError,
  ConnectionTimeoutError,
  mapLedgerError,
  mapTrezorError,
} from '../src/index.js'

describe('HardwareWalletError', () => {
  it('should create base error with message and code', () => {
    const error = new HardwareWalletError('Test message', 'TEST_CODE')
    expect(error.message).toBe('Test message')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('HardwareWalletError')
    expect(error instanceof Error).toBe(true)
  })
})

describe('DeviceNotFoundError', () => {
  it('should create Ledger device not found error', () => {
    const error = new DeviceNotFoundError('ledger')
    expect(error.message).toBe('Ledger device not found')
    expect(error.code).toBe('DEVICE_NOT_FOUND')
    expect(error.name).toBe('DeviceNotFoundError')
  })

  it('should create Trezor device not found error with details', () => {
    const error = new DeviceNotFoundError('trezor', 'USB disconnected')
    expect(error.message).toBe('Trezor device not found: USB disconnected')
    expect(error.code).toBe('DEVICE_NOT_FOUND')
  })
})

describe('UserRejectedError', () => {
  it('should create user rejected signature error', () => {
    const error = new UserRejectedError('signature')
    expect(error.message).toBe('User rejected signature on device')
    expect(error.code).toBe('USER_REJECTED')
  })

  it('should create user rejected connection error', () => {
    const error = new UserRejectedError('connection')
    expect(error.message).toBe('User rejected connection on device')
  })
})

describe('TransportError', () => {
  it('should create transport error', () => {
    const error = new TransportError('Connection failed')
    expect(error.message).toBe('Transport error: Connection failed')
    expect(error.code).toBe('TRANSPORT_ERROR')
  })
})

describe('DeviceLockedError', () => {
  it('should create device locked error', () => {
    const error = new DeviceLockedError('ledger')
    expect(error.message).toContain('Ledger device is locked')
    expect(error.code).toBe('DEVICE_LOCKED')
  })
})

describe('AppNotOpenError', () => {
  it('should create app not open error with default app', () => {
    const error = new AppNotOpenError()
    expect(error.message).toContain('Ethereum app')
    expect(error.code).toBe('APP_NOT_OPEN')
  })

  it('should create app not open error with custom app', () => {
    const error = new AppNotOpenError('Bitcoin')
    expect(error.message).toContain('Bitcoin app')
  })
})

describe('InvalidPathError', () => {
  it('should create invalid path error', () => {
    const error = new InvalidPathError('m/invalid')
    expect(error.message).toContain('m/invalid')
    expect(error.code).toBe('INVALID_PATH')
  })

  it('should create invalid path error with reason', () => {
    const error = new InvalidPathError('m/invalid', 'Non-numeric component')
    expect(error.message).toContain('Non-numeric component')
  })
})

describe('UnsupportedOperationError', () => {
  it('should create unsupported operation error', () => {
    const error = new UnsupportedOperationError('EIP-4844 signing')
    expect(error.message).toContain('EIP-4844 signing')
    expect(error.code).toBe('UNSUPPORTED_OPERATION')
  })
})

describe('ConnectionTimeoutError', () => {
  it('should create connection timeout error', () => {
    const error = new ConnectionTimeoutError(30000)
    expect(error.message).toContain('30000ms')
    expect(error.code).toBe('CONNECTION_TIMEOUT')
  })
})

describe('mapLedgerError', () => {
  it('should pass through HardwareWalletError', () => {
    const original = new UserRejectedError('signature')
    const mapped = mapLedgerError(original)
    expect(mapped).toBe(original)
  })

  it('should map user rejection status code', () => {
    const error = { statusCode: 0x6985, message: 'User rejected' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(UserRejectedError)
  })

  it('should map device locked status code', () => {
    const error = { statusCode: 0x6faa, message: 'Locked' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(DeviceLockedError)
  })

  it('should map 0x6d00 to AppNotOpenError (wrong/no app)', () => {
    const error = { statusCode: 0x6d00, message: 'INS not supported' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(AppNotOpenError)
  })

  it('should map 0x6e00 to UnsupportedOperationError', () => {
    const error = { statusCode: 0x6e00, message: 'CLA not supported' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(UnsupportedOperationError)
  })

  it('should detect rejection from message string', () => {
    const error = { message: 'Transaction was denied by user' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(UserRejectedError)
  })

  it('should detect device not found from message', () => {
    const error = { message: 'no device found' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(DeviceNotFoundError)
  })

  it('should detect app not open from message', () => {
    const error = { message: 'Please open the Ethereum app' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(AppNotOpenError)
  })

  it('should return generic error for unknown errors', () => {
    const error = { message: 'Some unknown error' }
    const mapped = mapLedgerError(error)
    expect(mapped).toBeInstanceOf(HardwareWalletError)
    expect(mapped.code).toBe('UNKNOWN_ERROR')
  })
})

describe('mapTrezorError', () => {
  it('should pass through HardwareWalletError', () => {
    const original = new DeviceLockedError('trezor')
    const mapped = mapTrezorError(original)
    expect(mapped).toBe(original)
  })

  it('should map action cancelled code', () => {
    const error = { code: 'Failure_ActionCancelled', message: 'Cancelled' }
    const mapped = mapTrezorError(error)
    expect(mapped).toBeInstanceOf(UserRejectedError)
  })

  it('should map device not found code', () => {
    const error = { code: 'Device_NotFound', message: 'No device' }
    const mapped = mapTrezorError(error)
    expect(mapped).toBeInstanceOf(DeviceNotFoundError)
  })

  it('should map device invalid state code', () => {
    const error = { code: 'Device_InvalidState', message: 'Invalid state' }
    const mapped = mapTrezorError(error)
    expect(mapped).toBeInstanceOf(DeviceLockedError)
  })

  it('should detect rejection from message', () => {
    const error = { message: 'User cancelled the operation' }
    const mapped = mapTrezorError(error)
    expect(mapped).toBeInstanceOf(UserRejectedError)
  })

  it('should return generic error for unknown errors', () => {
    const error = { message: 'Unknown trezor error' }
    const mapped = mapTrezorError(error)
    expect(mapped).toBeInstanceOf(HardwareWalletError)
    expect(mapped.code).toBe('UNKNOWN_ERROR')
  })
})
