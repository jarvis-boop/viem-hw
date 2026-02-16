/**
 * viem-hw/ledger - Ledger device support
 *
 * Requires peer dependencies:
 * - @ledgerhq/hw-app-eth
 * - @ledgerhq/hw-transport-webhid (for WebHID transport)
 * - @ledgerhq/hw-transport-webusb (for WebUSB transport)
 */

export { createLedgerAccount, type CreateLedgerAccountOptions } from "./account.js";

export {
  discoverLedgerAccounts,
  type DiscoverLedgerAccountsOptions,
  type LedgerDerivationStyle,
} from "./discovery.js";

export {
  createTransport,
  isWebHIDAvailable,
  isWebUSBAvailable,
  getBestTransportType,
  type TransportType,
  type TransportOptions,
  type LedgerTransport,
} from "./transport.js";

export {
  createLedgerDeviceManager,
  type LedgerDeviceManager,
  type LedgerDeviceInfo,
  type LedgerAppConfig,
  type CreateDeviceManagerOptions,
  type ConnectionState,
  type ConnectionStateListener,
} from "./device.js";
