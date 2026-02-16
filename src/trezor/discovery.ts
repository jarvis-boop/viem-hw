import type { Address } from "viem";
import { mapTrezorError } from "../shared/errors.js";
import { DEFAULT_BASE_PATH, buildPath, getLedgerLivePath } from "../shared/paths.js";
import type { DerivationPath, DiscoveredAccount, DiscoveryOptions } from "../shared/types.js";
import { getTrezorConnect, unwrapTrezorResponse, type TrezorConnectOptions } from "./connect.js";

/**
 * Derivation style for Trezor accounts
 */
export type TrezorDerivationStyle = "bip44" | "ledger-live";

/**
 * Options for Trezor account discovery
 */
export interface DiscoverTrezorAccountsOptions extends DiscoveryOptions, TrezorConnectOptions {
  /** Derivation style (default: 'bip44') */
  derivationStyle?: TrezorDerivationStyle;
}

/**
 * Discovers accounts from a Trezor device
 *
 * @param options - Discovery options
 * @returns Array of discovered accounts with addresses and paths
 *
 * @example
 * ```ts
 * const accounts = await discoverTrezorAccounts({
 *   count: 5,
 *   email: 'your@email.com',
 *   appUrl: 'https://yourapp.com'
 * })
 * console.log(accounts)
 * // [
 * //   { address: '0x...', path: "m/44'/60'/0'/0/0", index: 0 },
 * //   { address: '0x...', path: "m/44'/60'/0'/0/1", index: 1 },
 * //   ...
 * // ]
 * ```
 */
export async function discoverTrezorAccounts(
  options: DiscoverTrezorAccountsOptions = {},
): Promise<DiscoveredAccount[]> {
  const {
    count = 5,
    startIndex = 0,
    basePath = DEFAULT_BASE_PATH,
    derivationStyle = "bip44",
    ...connectOptions
  } = options;

  const trezor = await getTrezorConnect(connectOptions);
  const accounts: DiscoveredAccount[] = [];

  try {
    for (let i = 0; i < count; i++) {
      const index = startIndex + i;
      let path: DerivationPath;

      if (derivationStyle === "ledger-live") {
        path = getLedgerLivePath(index);
      } else {
        path = buildPath(basePath, index);
      }

      const response = await trezor.ethereumGetAddress({
        path,
        showOnTrezor: false,
      });

      const result = unwrapTrezorResponse(response);
      accounts.push({
        address: result.address as Address,
        path,
        index,
      });
    }
  } catch (error) {
    throw mapTrezorError(error);
  }

  return accounts;
}
