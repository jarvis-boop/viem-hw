/**
 * Mock Ledger transport and Eth app for testing
 *
 * @example
 * ```ts
 * import { MockLedgerTransport, MockLedgerEthApp } from 'viem-hw/ledger/mock'
 * import { createLedgerAccount } from 'viem-hw/ledger'
 *
 * const transport = new MockLedgerTransport()
 * const account = await createLedgerAccount({ transport })
 * ```
 */

export {
  MockLedgerTransport,
  MockLedgerEthApp,
  type MockLedgerOptions,
  type MockScenario,
  type MockDeviceInfo,
  type MockAppConfig,
} from './transport.js'

export {
  createMockLedgerAccount,
  createMockLedgerDiscovery,
  type MockLedgerAccountOptions,
} from './helpers.js'

export {
  createMockLedgerDeviceManager,
  type MockLedgerDeviceManagerOptions,
  type MockDeviceInfoConfig,
  type MockAppConfigConfig,
} from './device.js'
