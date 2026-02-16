import type { Address } from 'viem'
import type {
  LedgerDeviceManager,
  LedgerDeviceInfo,
  LedgerAppConfig,
  ConnectionState,
  ConnectionStateListener,
} from '../device.js'
import type { DerivationPath } from '../../shared/types.js'
import { DEFAULT_BASE_PATH } from '../../shared/paths.js'
import { DeviceLockedError, AppNotOpenError, UserRejectedError } from '../../shared/errors.js'

/**
 * Mock device info configuration
 */
export interface MockDeviceInfoConfig {
  model?: string
  firmwareVersion?: string
}

/**
 * Mock app config configuration  
 */
export interface MockAppConfigConfig {
  version?: string
  supportsEIP712?: boolean
  blindSigningEnabled?: boolean
}

/**
 * Options for creating a mock device manager
 */
export interface MockLedgerDeviceManagerOptions {
  /** Initial connection state */
  initialState?: ConnectionState
  /** Simulated device info */
  deviceInfo?: MockDeviceInfoConfig
  /** Simulated app config */
  appConfig?: MockAppConfigConfig
  /** Simulate connection failure */
  failConnect?: boolean | Error
  /** Simulate verification failure */
  failVerify?: boolean | 'rejected' | 'locked' | 'app-not-open' | Error
  /** Known addresses by path */
  addresses?: Record<string, Address>
  /** Default address index for generation */
  defaultAddressIndex?: number
}

const DEFAULT_DEVICE_INFO: LedgerDeviceInfo = {
  model: 'nanoX',
  firmwareVersion: '2.1.0',
  connected: true,
}

const DEFAULT_APP_CONFIG: LedgerAppConfig = {
  name: 'Ethereum',
  version: '1.10.0',
  flags: 1,
  supportsEIP712: true,
  blindSigningEnabled: true,
}

/**
 * Creates a mock Ledger device manager for testing
 */
export function createMockLedgerDeviceManager(
  options: MockLedgerDeviceManagerOptions = {}
): LedgerDeviceManager {
  const {
    initialState = 'disconnected',
    deviceInfo = {},
    appConfig = {},
    failConnect = false,
    failVerify = false,
    addresses = {},
    defaultAddressIndex = 0,
  } = options

  let state: ConnectionState = initialState
  const listeners = new Set<ConnectionStateListener>()

  const mockDeviceInfo: LedgerDeviceInfo = {
    ...DEFAULT_DEVICE_INFO,
    ...deviceInfo,
    connected: state === 'connected',
  }

  const mockAppConfig: LedgerAppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...appConfig,
  }

  function setState(newState: ConnectionState, error?: Error) {
    state = newState
    mockDeviceInfo.connected = newState === 'connected'
    listeners.forEach(listener => listener(newState, error))
  }

  function getAddressForPath(path: DerivationPath): Address {
    const knownAddress = addresses[path]
    if (knownAddress) {
      return knownAddress
    }
    // Generate deterministic mock address
    const pathParts = path.split('/')
    const lastPart = pathParts[pathParts.length - 1]
    const index = lastPart ? parseInt(lastPart, 10) || defaultAddressIndex : defaultAddressIndex
    const hex = (0xdead0000 + index).toString(16).padStart(40, '0')
    return `0x${hex}` as Address
  }

  async function connect(): Promise<void> {
    if (state === 'connected') return

    setState('connecting')

    if (failConnect) {
      const error = failConnect instanceof Error
        ? failConnect
        : new Error('Connection failed')
      setState('error', error)
      throw error
    }

    setState('connected')
  }

  async function disconnect(): Promise<void> {
    setState('disconnected')
  }

  function isConnected(): boolean {
    return state === 'connected'
  }

  async function getDeviceInfo(): Promise<LedgerDeviceInfo> {
    return { ...mockDeviceInfo, connected: state === 'connected' }
  }

  async function getAppConfig(): Promise<LedgerAppConfig> {
    if (state !== 'connected') {
      throw new AppNotOpenError('ledger', 'Ethereum')
    }
    return { ...mockAppConfig }
  }

  async function verifyAddress(
    path: DerivationPath = DEFAULT_BASE_PATH
  ): Promise<{ address: Address; verified: boolean }> {
    if (state !== 'connected') {
      await connect()
    }

    if (failVerify) {
      if (failVerify === 'rejected') {
        throw new UserRejectedError('address')
      } else if (failVerify === 'locked') {
        throw new DeviceLockedError('ledger')
      } else if (failVerify === 'app-not-open') {
        throw new AppNotOpenError('ledger', 'Ethereum')
      } else if (failVerify instanceof Error) {
        throw failVerify
      } else {
        throw new Error('Verification failed')
      }
    }

    return {
      address: getAddressForPath(path),
      verified: true,
    }
  }

  function onStateChange(listener: ConnectionStateListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getTransport(): null {
    return null // Mock doesn't have real transport
  }

  return {
    get state() { return state },
    connect,
    disconnect,
    isConnected,
    getDeviceInfo,
    getAppConfig,
    verifyAddress,
    onStateChange,
    getTransport,
  }
}
