import type { Address } from 'viem'
import { mapLedgerError } from '../shared/errors.js'
import { DEFAULT_BASE_PATH, buildPath, getLedgerLivePath } from '../shared/paths.js'
import type { DerivationPath, DiscoveredAccount, DiscoveryOptions } from '../shared/types.js'
import { createTransport, type TransportOptions, type LedgerTransport } from './transport.js'

/**
 * Ledger Ethereum app interface for discovery
 */
interface LedgerEthApp {
  getAddress(
    path: string,
    boolDisplay?: boolean,
    boolChaincode?: boolean
  ): Promise<{ publicKey: string; address: string; chainCode?: string }>
}

/**
 * Discovery style for Ledger accounts
 */
export type LedgerDerivationStyle = 'bip44' | 'ledger-live'

/**
 * Options for Ledger account discovery
 */
export interface DiscoverLedgerAccountsOptions extends DiscoveryOptions, TransportOptions {
  /** Derivation style (default: 'bip44') */
  derivationStyle?: LedgerDerivationStyle
  /** Pre-existing transport instance */
  transport?: LedgerTransport
}

/**
 * Discovers accounts from a Ledger device
 *
 * @param options - Discovery options
 * @returns Array of discovered accounts with addresses and paths
 *
 * @example
 * ```ts
 * const accounts = await discoverLedgerAccounts({ count: 5 })
 * console.log(accounts)
 * // [
 * //   { address: '0x...', path: "m/44'/60'/0'/0/0", index: 0 },
 * //   { address: '0x...', path: "m/44'/60'/0'/0/1", index: 1 },
 * //   ...
 * // ]
 * ```
 */
export async function discoverLedgerAccounts(
  options: DiscoverLedgerAccountsOptions = {}
): Promise<DiscoveredAccount[]> {
  const {
    count = 5,
    startIndex = 0,
    basePath = DEFAULT_BASE_PATH,
    derivationStyle = 'bip44',
    transport: existingTransport,
    ...transportOptions
  } = options

  // Create or use existing transport
  const transport = existingTransport ?? (await createTransport(transportOptions))

  // Create Eth app instance
  let eth: LedgerEthApp
  try {
    const EthModule = await import('@ledgerhq/hw-app-eth')
    const EthApp = EthModule.default
    eth = new (EthApp as unknown as new (transport: LedgerTransport) => LedgerEthApp)(transport)
  } catch (error) {
    const err = error as { message?: string }
    if (err.message?.includes('cannot find module')) {
      throw mapLedgerError(
        new Error(
          '@ledgerhq/hw-app-eth is not installed. Install it with: npm install @ledgerhq/hw-app-eth'
        )
      )
    }
    throw mapLedgerError(error)
  }

  const accounts: DiscoveredAccount[] = []

  try {
    for (let i = 0; i < count; i++) {
      const index = startIndex + i
      let path: DerivationPath

      if (derivationStyle === 'ledger-live') {
        path = getLedgerLivePath(index)
      } else {
        path = buildPath(basePath, index)
      }

      const result = await eth.getAddress(path, false, false)
      accounts.push({
        address: result.address as Address,
        path,
        index,
      })
    }
  } catch (error) {
    throw mapLedgerError(error)
  }

  return accounts
}
