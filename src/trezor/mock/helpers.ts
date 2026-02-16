/**
 * Helper functions for mock Trezor testing
 */

import type {
  Address,
  Hex as HexType,
  SignableMessage,
  TransactionSerializable,
  TypedDataDefinition,
  LocalAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  DerivationPath,
  HardwareWalletAccount,
  DiscoveredAccount,
} from "../../shared/types.js";
import { DEFAULT_BASE_PATH, buildPath, getLedgerLivePath } from "../../shared/paths.js";
import { getTestAccount } from "../../shared/test-keys.js";
import { mapTrezorError } from "../../shared/errors.js";
import { type MockTrezorOptions, type MockTrezorScenario } from "./connect.js";

/**
 * Options for creating a mock Trezor account
 */
export interface MockTrezorAccountOptions extends MockTrezorOptions {
  /** Derivation path */
  path?: DerivationPath;
  /** Email for manifest */
  email?: string;
  /** App URL for manifest */
  appUrl?: string;
}

/**
 * Creates a mock Trezor account for testing
 *
 * This provides the same interface as createTrezorAccount but uses
 * deterministic test keys instead of real hardware.
 *
 * @example
 * ```ts
 * import { createMockTrezorAccount } from 'viem-hw/trezor/mock'
 *
 * const account = createMockTrezorAccount()
 * const signature = await account.signMessage({ message: 'Hello' })
 * ```
 */
export function createMockTrezorAccount(
  options: MockTrezorAccountOptions = {},
): HardwareWalletAccount {
  const { path = `${DEFAULT_BASE_PATH}/0` as DerivationPath, scenario = "success" } = options;

  const testAccount = getTestAccount(path);
  const viemAccount = privateKeyToAccount(testAccount.privateKey as HexType);

  // Build account synchronously since we have test keys
  const account: HardwareWalletAccount = {
    address: testAccount.address as Address,
    path,
    type: "local",
    source: "custom",
    publicKey: testAccount.publicKey as HexType,

    async signMessage({ message }: { message: SignableMessage }): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signMessage);

      try {
        return await viemAccount.signMessage({ message });
      } catch (error) {
        throw mapTrezorError(error);
      }
    },

    async signTransaction(transaction: TransactionSerializable): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signTransaction);

      try {
        return await viemAccount.signTransaction(transaction);
      } catch (error) {
        throw mapTrezorError(error);
      }
    },

    signTypedData: async function (typedData: TypedDataDefinition): Promise<HexType> {
      // Check scenario
      checkScenario(scenario, options.scenarioOverrides?.signTypedData);

      try {
        return await viemAccount.signTypedData({
          domain: typedData.domain as Record<string, unknown>,
          types: typedData.types as unknown as Record<string, unknown[]>,
          primaryType: typedData.primaryType as string,
          message: typedData.message as Record<string, unknown>,
        });
      } catch (error) {
        throw mapTrezorError(error);
      }
    } as LocalAccount["signTypedData"],
  };

  return account;
}

/**
 * Creates mock discovery results
 *
 * @example
 * ```ts
 * import { createMockTrezorDiscovery } from 'viem-hw/trezor/mock'
 *
 * const accounts = createMockTrezorDiscovery({ count: 5 })
 * console.log(accounts[0].address) // Known test address
 * ```
 */
export function createMockTrezorDiscovery(
  options: {
    count?: number;
    startIndex?: number;
    basePath?: string;
    derivationStyle?: "bip44" | "ledger-live";
  } = {},
): DiscoveredAccount[] {
  const {
    count = 5,
    startIndex = 0,
    basePath = DEFAULT_BASE_PATH,
    derivationStyle = "bip44",
  } = options;

  const accounts: DiscoveredAccount[] = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    let derivedPath: DerivationPath;

    if (derivationStyle === "ledger-live") {
      derivedPath = getLedgerLivePath(index);
    } else {
      derivedPath = buildPath(basePath, index);
    }

    const testAccount = getTestAccount(derivedPath);
    accounts.push({
      address: testAccount.address as Address,
      path: derivedPath,
      index,
    });
  }

  return accounts;
}

/**
 * Check scenario and throw appropriate error
 */
function checkScenario(defaultScenario: MockTrezorScenario, override?: MockTrezorScenario): void {
  const scenario = override ?? defaultScenario;
  if (scenario !== "success") {
    throwScenarioError(scenario);
  }
}

/**
 * Throw error based on scenario
 */
function throwScenarioError(scenario: MockTrezorScenario): never {
  switch (scenario) {
    case "user-rejected":
      throw mapTrezorError({ code: "Failure_ActionCancelled", message: "User rejected" });
    case "device-locked":
      throw mapTrezorError({ code: "Device_InvalidState", message: "Device locked" });
    case "device-not-found":
      throw mapTrezorError({ code: "Device_NotFound", message: "Device not found" });
    case "device-busy":
      throw mapTrezorError({ code: "Device_CallInProgress", message: "Device busy" });
    case "timeout":
      throw mapTrezorError({ code: "Transport_Missing", message: "Timeout" });
    case "passphrase-required":
      throw mapTrezorError({ code: "Device_InvalidState", message: "Passphrase required" });
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}
