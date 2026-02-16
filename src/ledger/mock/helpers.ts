/**
 * Helper functions for mock Ledger testing
 */

import type { Address, Hex as HexType } from 'viem'
import type { SignableMessage, TransactionSerializable, TypedDataDefinition, LocalAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import type { DerivationPath, HardwareWalletAccount, DiscoveredAccount } from '../../shared/types.js'
import { DEFAULT_BASE_PATH, buildPath, getLedgerLivePath } from '../../shared/paths.js'
import { getTestAccount } from '../../shared/test-keys.js'
import { mapLedgerError } from '../../shared/errors.js'
import { type MockLedgerOptions, type MockScenario } from './transport.js'

/**
 * Options for creating a mock Ledger account
 */
export interface MockLedgerAccountOptions extends MockLedgerOptions {
  /** Derivation path */
  path?: DerivationPath
}

/**
 * Creates a mock Ledger account for testing
 *
 * This provides the same interface as createLedgerAccount but uses
 * deterministic test keys instead of real hardware.
 *
 * @example
 * ```ts
 * import { createMockLedgerAccount } from 'viem-hw/ledger/mock'
 *
 * const account = createMockLedgerAccount()
 * const signature = await account.signMessage({ message: 'Hello' })
 * ```
 */
export function createMockLedgerAccount(
  options: MockLedgerAccountOptions = {}
): HardwareWalletAccount {
  const {
    path = `${DEFAULT_BASE_PATH}/0` as DerivationPath,
    scenario = 'success',
  } = options

  const testAccount = getTestAccount(path)
  const viemAccount = privateKeyToAccount(testAccount.privateKey as HexType)

  // Build account synchronously since we have test keys
  const account: HardwareWalletAccount = {
    address: testAccount.address as Address,
    path,
    type: 'local',
    source: 'custom',
    publicKey: testAccount.publicKey as HexType,

    async signMessage({ message }: { message: SignableMessage }): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signMessage)

      try {
        // Use viem's built-in signing
        return await viemAccount.signMessage({ message })
      } catch (error) {
        throw mapLedgerError(error)
      }
    },

    async signTransaction(transaction: TransactionSerializable): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signTransaction)

      try {
        // Use viem's built-in signing
        return await viemAccount.signTransaction(transaction)
      } catch (error) {
        throw mapLedgerError(error)
      }
    },

    signTypedData: async function (typedData: TypedDataDefinition): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signTypedData)

      try {
        // Use viem's built-in signing
        return await viemAccount.signTypedData({
          domain: typedData.domain as Record<string, unknown>,
          types: typedData.types as unknown as Record<string, unknown[]>,
          primaryType: typedData.primaryType as string,
          message: typedData.message as Record<string, unknown>,
        })
      } catch (error) {
        throw mapLedgerError(error)
      }
    } as LocalAccount['signTypedData'],
  }

  return account
}

/**
 * Creates mock discovery results
 *
 * @example
 * ```ts
 * import { createMockLedgerDiscovery } from 'viem-hw/ledger/mock'
 *
 * const accounts = createMockLedgerDiscovery({ count: 5 })
 * console.log(accounts[0].address) // Known test address
 * ```
 */
export function createMockLedgerDiscovery(options: {
  count?: number
  startIndex?: number
  basePath?: string
  derivationStyle?: 'bip44' | 'ledger-live'
} = {}): DiscoveredAccount[] {
  const {
    count = 5,
    startIndex = 0,
    basePath = DEFAULT_BASE_PATH,
    derivationStyle = 'bip44',
  } = options

  const accounts: DiscoveredAccount[] = []

  for (let i = 0; i < count; i++) {
    const index = startIndex + i
    let derivedPath: DerivationPath

    if (derivationStyle === 'ledger-live') {
      derivedPath = getLedgerLivePath(index)
    } else {
      derivedPath = buildPath(basePath, index)
    }

    const testAccount = getTestAccount(derivedPath)
    accounts.push({
      address: testAccount.address as Address,
      path: derivedPath,
      index,
    })
  }

  return accounts
}

/**
 * Check scenario and throw appropriate error
 */
function checkScenario(defaultScenario: MockScenario, override?: MockScenario): void {
  const scenario = override ?? defaultScenario
  if (scenario !== 'success') {
    throwScenarioError(scenario)
  }
}

/**
 * Throw error based on scenario
 */
function throwScenarioError(scenario: MockScenario): never {
  switch (scenario) {
    case 'user-rejected':
      throw mapLedgerError({ statusCode: 0x6985, message: 'User rejected' })
    case 'device-locked':
      throw mapLedgerError({ statusCode: 0x6faa, message: 'Device locked' })
    case 'app-not-open':
      throw mapLedgerError({ statusCode: 0x6d00, message: 'App not open' })
    case 'disconnected':
      throw mapLedgerError({ name: 'TransportOpenUserCancelled', message: 'Disconnected' })
    case 'timeout':
      throw mapLedgerError({ name: 'TransportError', message: 'Timeout' })
    case 'invalid-data':
      throw mapLedgerError({ statusCode: 0x6a80, message: 'Invalid data' })
    default:
      throw new Error(`Unknown scenario: ${scenario}`)
  }
}
