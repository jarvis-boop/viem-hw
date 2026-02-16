/**
 * Mock Trezor Connect for testing
 *
 * @example
 * ```ts
 * import { MockTrezorConnect, installMockTrezorConnect } from 'viem-hw/trezor/mock'
 * import { createTrezorAccount } from 'viem-hw/trezor'
 *
 * // Install mock globally
 * installMockTrezorConnect()
 *
 * // Or use directly
 * const mock = new MockTrezorConnect()
 * const account = await createTrezorAccountWithMock({ mock })
 * ```
 */

export {
  MockTrezorConnect,
  type MockTrezorOptions,
  type MockTrezorScenario,
  type MockTrezorDeviceInfo,
  type MockTrezorFeatures,
} from './connect.js'

export {
  createMockTrezorAccount,
  createMockTrezorDiscovery,
  type MockTrezorAccountOptions,
} from './helpers.js'
