/**
 * Mock Trezor Connect implementation for testing
 */

import { Hex } from 'ox'
import type { Hex as HexType, PrivateKeyAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { getTestAccount, TEST_ACCOUNTS } from '../../shared/test-keys.js'
import type { DerivationPath } from '../../shared/types.js'
import type {
  TrezorConnect,
  TrezorResponse,
  TrezorAddress,
  TrezorMessageSignature,
  TrezorTransactionSignature,
  TrezorTypedDataSignature,
  TrezorAddressParams,
  TrezorSignMessageParams,
  TrezorSignTransactionParams,
  TrezorSignTypedDataParams,
  TrezorInitSettings,
} from '../connect.js'

/**
 * Mock scenario configuration
 */
export type MockTrezorScenario =
  | 'success'
  | 'user-rejected'
  | 'device-locked'
  | 'device-not-found'
  | 'device-busy'
  | 'timeout'
  | 'passphrase-required'

/**
 * Mock device information
 */
export interface MockTrezorDeviceInfo {
  model: string
  label: string
  deviceId: string
}

/**
 * Mock device features
 */
export interface MockTrezorFeatures {
  vendor: string
  major_version: number
  minor_version: number
  patch_version: number
  bootloader_mode: boolean
  device_id: string
  pin_protection: boolean
  passphrase_protection: boolean
  language: string
  label: string
  initialized: boolean
  needs_backup: boolean
  model: string
}

/**
 * Options for MockTrezorConnect
 */
export interface MockTrezorOptions {
  /** Default scenario for all operations */
  scenario?: MockTrezorScenario
  /** Scenario overrides by operation */
  scenarioOverrides?: {
    getAddress?: MockTrezorScenario
    signMessage?: MockTrezorScenario
    signTransaction?: MockTrezorScenario
    signTypedData?: MockTrezorScenario
  }
  /** Simulated delay in ms */
  delay?: number
  /** Device info to return */
  deviceInfo?: MockTrezorDeviceInfo
  /** Device features */
  features?: Partial<MockTrezorFeatures>
  /** Custom test accounts (path -> account mapping) */
  accounts?: Map<string, { address: string; publicKey: string; privateKey: string }>
  /** Whether device is connected */
  connected?: boolean
}

/**
 * Mock Trezor Connect for testing
 *
 * Simulates Trezor Connect API without real hardware.
 */
export class MockTrezorConnect implements TrezorConnect {
  private _connected: boolean
  public _scenario: MockTrezorScenario
  public _scenarioOverrides: MockTrezorOptions['scenarioOverrides']
  private _delay: number
  private _features: MockTrezorFeatures
  private _accounts: MockTrezorOptions['accounts']

  constructor(options: MockTrezorOptions = {}) {
    this._connected = options.connected ?? true
    this._scenario = options.scenario ?? 'success'
    this._scenarioOverrides = options.scenarioOverrides
    this._delay = options.delay ?? 0
    this._features = {
      vendor: 'trezor.io',
      major_version: 2,
      minor_version: 5,
      patch_version: 3,
      bootloader_mode: false,
      device_id: 'MOCK-DEVICE-001',
      pin_protection: true,
      passphrase_protection: false,
      language: 'en-US',
      label: 'My Trezor',
      initialized: true,
      needs_backup: false,
      model: 'T',
      ...options.features,
    }
    this._accounts = options.accounts
  }

  /**
   * Initialize Trezor Connect
   */
  async init(_settings: TrezorInitSettings): Promise<void> {
    await this.simulateDelay()
  }

  /**
   * Set connection state
   */
  setConnected(connected: boolean): void {
    this._connected = connected
  }

  /**
   * Set scenario for subsequent operations
   */
  setScenario(scenario: MockTrezorScenario): void {
    this._scenario = scenario
  }

  /**
   * Get device features
   */
  getFeatures(): MockTrezorFeatures {
    return { ...this._features }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected
  }

  /**
   * Get address (generic)
   */
  async getAddress(params: TrezorAddressParams): Promise<TrezorResponse<TrezorAddress>> {
    return this.ethereumGetAddress(params)
  }

  /**
   * Get Ethereum address
   */
  async ethereumGetAddress(params: TrezorAddressParams): Promise<TrezorResponse<TrezorAddress>> {
    await this.simulateDelay()

    const scenario = this.getScenario('getAddress')
    if (scenario !== 'success') {
      return this.createErrorResponse(scenario)
    }

    if (!this._connected) {
      return this.createErrorResponse('device-not-found')
    }

    const account = this.getAccountForPath(params.path)
    const pathArray = this.pathToArray(params.path)

    if (params.showOnTrezor) {
      // Simulate user confirmation delay
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return {
      success: true,
      payload: {
        address: account.address,
        path: pathArray,
        serializedPath: params.path,
      },
    }
  }

  /**
   * Sign Ethereum message
   */
  async ethereumSignMessage(params: TrezorSignMessageParams): Promise<TrezorResponse<TrezorMessageSignature>> {
    await this.simulateDelay()

    const scenario = this.getScenario('signMessage')
    if (scenario !== 'success') {
      return this.createErrorResponse(scenario)
    }

    if (!this._connected) {
      return this.createErrorResponse('device-not-found')
    }

    const viemAccount = this.getViemAccountForPath(params.path)

    // Sign using viem
    const message = params.hex
      ? { raw: `0x${params.message}` as HexType }
      : params.message

    const signature = await viemAccount.signMessage({ message })

    // Trezor returns signature without 0x prefix
    return {
      success: true,
      payload: {
        address: viemAccount.address,
        signature: signature.slice(2),
      },
    }
  }

  /**
   * Sign Ethereum transaction
   */
  async ethereumSignTransaction(params: TrezorSignTransactionParams): Promise<TrezorResponse<TrezorTransactionSignature>> {
    await this.simulateDelay()

    const scenario = this.getScenario('signTransaction')
    if (scenario !== 'success') {
      return this.createErrorResponse(scenario)
    }

    if (!this._connected) {
      return this.createErrorResponse('device-not-found')
    }

    const viemAccount = this.getViemAccountForPath(params.path)
    const tx = params.transaction

    // Build transaction object for viem
    const viemTx = {
      to: tx.to as `0x${string}` | undefined,
      value: BigInt(tx.value || '0x0'),
      nonce: parseInt(tx.nonce, 16),
      gas: BigInt(tx.gasLimit),
      data: tx.data as `0x${string}` | undefined,
      chainId: tx.chainId,
      ...(tx.maxFeePerGas !== undefined
        ? {
            maxFeePerGas: BigInt(tx.maxFeePerGas),
            maxPriorityFeePerGas: BigInt(tx.maxPriorityFeePerGas || '0x0'),
          }
        : {
            gasPrice: BigInt(tx.gasPrice || '0x0'),
          }),
    }

    const signature = await viemAccount.signTransaction(viemTx)

    // Parse the signed transaction to get r, s, v
    // For Trezor format, we need just the signature parts
    // The signature is at the end of the serialized transaction
    const sigLength = 65 * 2 // 65 bytes in hex
    const sigStart = signature.length - sigLength
    const sigHex = signature.slice(sigStart)

    const r = sigHex.slice(0, 64)
    const s = sigHex.slice(64, 128)
    // For EIP-155, calculate v
    const yParity = parseInt(sigHex.slice(128, 130), 16) - 27
    const v = BigInt(tx.chainId) * 2n + 35n + BigInt(yParity)

    return {
      success: true,
      payload: {
        v: Hex.fromNumber(v).slice(2),
        r,
        s,
      },
    }
  }

  /**
   * Sign EIP-712 typed data
   */
  async ethereumSignTypedData(params: TrezorSignTypedDataParams): Promise<TrezorResponse<TrezorTypedDataSignature>> {
    await this.simulateDelay()

    const scenario = this.getScenario('signTypedData')
    if (scenario !== 'success') {
      return this.createErrorResponse(scenario)
    }

    if (!this._connected) {
      return this.createErrorResponse('device-not-found')
    }

    const viemAccount = this.getViemAccountForPath(params.path)

    // Sign using viem
    const signature = await viemAccount.signTypedData({
      domain: params.data.domain,
      types: params.data.types as Record<string, unknown[]>,
      primaryType: params.data.primaryType,
      message: params.data.message,
    })

    return {
      success: true,
      payload: {
        address: viemAccount.address,
        signature: signature.slice(2),
      },
    }
  }

  /**
   * Dispose Trezor Connect
   */
  async dispose(): Promise<void> {
    this._connected = false
  }

  /**
   * Simulate delay
   */
  private async simulateDelay(): Promise<void> {
    if (this._delay > 0) {
      await new Promise(resolve => setTimeout(resolve, this._delay))
    } else {
      // Small delay to simulate async
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  /**
   * Get scenario for operation
   */
  private getScenario(operation: keyof NonNullable<MockTrezorOptions['scenarioOverrides']>): MockTrezorScenario {
    return this._scenarioOverrides?.[operation] ?? this._scenario
  }

  /**
   * Get test account for path
   */
  private getAccountForPath(path: string): { address: string; publicKey: string; privateKey: string } {
    // Check custom accounts first
    if (this._accounts?.has(path)) {
      return this._accounts.get(path)!
    }

    // Use test accounts
    const testAccount = getTestAccount(path as DerivationPath)
    return {
      address: testAccount.address,
      publicKey: testAccount.publicKey,
      privateKey: testAccount.privateKey,
    }
  }

  /**
   * Get viem account for path
   */
  private getViemAccountForPath(path: string): PrivateKeyAccount {
    const account = this.getAccountForPath(path)
    return privateKeyToAccount(account.privateKey as HexType)
  }

  /**
   * Convert path string to array
   */
  private pathToArray(path: string): number[] {
    const parts = path.slice(2).split('/') // Remove 'm/'
    return parts.map(part => {
      const hardened = part.endsWith("'")
      const num = parseInt(hardened ? part.slice(0, -1) : part, 10)
      return hardened ? num + 0x80000000 : num
    })
  }

  /**
   * Create error response based on scenario
   */
  private createErrorResponse<T>(scenario: MockTrezorScenario): TrezorResponse<T> {
    switch (scenario) {
      case 'user-rejected':
        return {
          success: false,
          payload: { error: 'Action cancelled by user', code: 'Failure_ActionCancelled' },
        }
      case 'device-locked':
        return {
          success: false,
          payload: { error: 'Device is locked', code: 'Device_InvalidState' },
        }
      case 'device-not-found':
        return {
          success: false,
          payload: { error: 'Device not found', code: 'Device_NotFound' },
        }
      case 'device-busy':
        return {
          success: false,
          payload: { error: 'Device is busy', code: 'Device_CallInProgress' },
        }
      case 'timeout':
        return {
          success: false,
          payload: { error: 'Operation timed out', code: 'Transport_Missing' },
        }
      case 'passphrase-required':
        return {
          success: false,
          payload: { error: 'Passphrase required', code: 'Device_InvalidState' },
        }
      default:
        return {
          success: false,
          payload: { error: 'Unknown error', code: 'UNKNOWN' },
        }
    }
  }
}

/**
 * Default test accounts for convenience
 */
export const DEFAULT_TEST_ACCOUNTS = TEST_ACCOUNTS
