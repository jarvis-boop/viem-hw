/**
 * viem-hw/trezor - Trezor device support
 *
 * Requires peer dependency:
 * - @trezor/connect
 */

export { createTrezorAccount, type CreateTrezorAccountOptions } from './account.js'

export {
  discoverTrezorAccounts,
  type DiscoverTrezorAccountsOptions,
  type TrezorDerivationStyle,
} from './discovery.js'

export {
  getTrezorConnect,
  disposeTrezorConnect,
  unwrapTrezorResponse,
  type TrezorConnect,
  type TrezorConnectOptions,
  type TrezorResponse,
} from './connect.js'
