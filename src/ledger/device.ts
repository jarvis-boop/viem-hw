import type { Address } from 'viem'
import { mapLedgerError, AppNotOpenError } from '../shared/errors.js'
import { isValidPath, DEFAULT_BASE_PATH } from '../shared/paths.js'
import type { DerivationPath } from '../shared/types.js'
import { createTransport, type TransportOptions, type LedgerTransport } from './transport.js'

/**
 * Ledger device information
 */
export interface LedgerDeviceInfo {
  /** Device model (e.g., 'nanoS', 'nanoX', 'stax') */
  model?: string
  /** Firmware version */
  firmwareVersion?: string
  /** Whether the device is connected */
  connected: boolean
}

/**
 * Ledger Ethereum app configuration
 */
export interface LedgerAppConfig {
  /** App name */
  name: string
  /** App version */
  version: string
  /** Supported flags */
  flags: number
  /** Whether EIP-712 is supported */
  supportsEIP712: boolean
  /** Whether blind signing is enabled */
  blindSigningEnabled: boolean
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

/**
 * Connection state change listener
 */
export type ConnectionStateListener = (state: ConnectionState, error?: Error) => void

/**
 * Ledger device manager for connection state and device operations
 */
export interface LedgerDeviceManager {
  /** Current connection state */
  readonly state: ConnectionState
  /** Connect to device */
  connect(): Promise<void>
  /** Disconnect from device */
  disconnect(): Promise<void>
  /** Check if device is connected */
  isConnected(): boolean
  /** Get device information */
  getDeviceInfo(): Promise<LedgerDeviceInfo>
  /** Get Ethereum app configuration */
  getAppConfig(): Promise<LedgerAppConfig>
  /** Verify address on device (displays for user confirmation) */
  verifyAddress(path?: DerivationPath): Promise<{ address: Address; verified: boolean }>
  /** Add connection state listener */
  onStateChange(listener: ConnectionStateListener): () => void
  /** Get the underlying transport */
  getTransport(): LedgerTransport | null
}

/**
 * Options for creating a device manager
 */
export interface CreateDeviceManagerOptions extends TransportOptions {
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean
  /** Reconnect delay in ms */
  reconnectDelay?: number
}

/**
 * Creates a Ledger device manager for connection state management
 */
export function createLedgerDeviceManager(
  options: CreateDeviceManagerOptions = {}
): LedgerDeviceManager {
  const { autoReconnect = false, reconnectDelay = 1000, ...transportOptions } = options
  
  let transport: LedgerTransport | null = null
  let ethApp: LedgerEthApp | null = null
  let state: ConnectionState = 'disconnected'
  const listeners = new Set<ConnectionStateListener>()
  
  function setState(newState: ConnectionState, error?: Error) {
    state = newState
    listeners.forEach(listener => listener(newState, error))
  }
  
  async function connect(): Promise<void> {
    if (state === 'connected' && transport) return
    
    setState('connecting')
    
    try {
      transport = await createTransport(transportOptions)
      
      // Try to create Eth app to verify it's ready
      const EthApp = await loadEthApp()
      ethApp = new EthApp(transport as any)
      
      // Test connection by getting app config
      await (ethApp as any).getAppConfiguration?.()
      
      setState('connected')
    } catch (error) {
      transport = null
      ethApp = null
      setState('error', error as Error)
      throw mapLedgerError(error)
    }
  }
  
  async function disconnect(): Promise<void> {
    if (transport) {
      try {
        await (transport as any).close?.()
      } catch {
        // Ignore close errors
      }
    }
    transport = null
    ethApp = null
    setState('disconnected')
  }
  
  function isConnected(): boolean {
    return state === 'connected' && transport !== null
  }
  
  async function getDeviceInfo(): Promise<LedgerDeviceInfo> {
    if (!transport) {
      return { connected: false }
    }
    
    try {
      const deviceModel = (transport as any).deviceModel
      return {
        model: deviceModel?.productName || deviceModel?.id,
        firmwareVersion: deviceModel?.firmwareVersion,
        connected: true,
      }
    } catch {
      return { connected: isConnected() }
    }
  }
  
  async function getAppConfig(): Promise<LedgerAppConfig> {
    if (!ethApp) {
      throw new AppNotOpenError('ledger', 'Ethereum')
    }
    
    try {
      const config = await (ethApp as any).getAppConfiguration()
      return {
        name: 'Ethereum',
        version: config.version || 'unknown',
        flags: config.arbitraryDataEnabled ? 1 : 0,
        supportsEIP712: true,
        blindSigningEnabled: config.arbitraryDataEnabled || false,
      }
    } catch (error) {
      throw mapLedgerError(error)
    }
  }
  
  async function verifyAddress(
    path: DerivationPath = DEFAULT_BASE_PATH
  ): Promise<{ address: Address; verified: boolean }> {
    if (!ethApp) {
      await connect()
    }
    
    if (!ethApp) {
      throw new AppNotOpenError('ledger', 'Ethereum')
    }
    
    if (!isValidPath(path)) {
      throw new Error(`Invalid derivation path: ${path}`)
    }
    
    try {
      // Pass true to display address on device for verification
      const result = await ethApp.getAddress(path, true)
      return {
        address: result.address as Address,
        verified: true,
      }
    } catch (error) {
      throw mapLedgerError(error)
    }
  }
  
  function onStateChange(listener: ConnectionStateListener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  
  function getTransport(): LedgerTransport | null {
    return transport
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

// Internal helpers

interface LedgerEthApp {
  getAddress(
    path: string,
    boolDisplay?: boolean,
    boolChaincode?: boolean
  ): Promise<{ publicKey: string; address: string; chainCode?: string }>
  getAppConfiguration?(): Promise<{ version: string; arbitraryDataEnabled: boolean }>
}

async function loadEthApp(): Promise<new (transport: unknown) => LedgerEthApp> {
  try {
    const module = await import('@ledgerhq/hw-app-eth')
    return module.default as unknown as new (transport: unknown) => LedgerEthApp
  } catch {
    throw new Error(
      'Ledger SDK not installed. Run: bun add @ledgerhq/hw-app-eth @ledgerhq/hw-transport-webhid'
    )
  }
}
