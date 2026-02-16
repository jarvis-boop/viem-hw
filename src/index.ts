/**
 * viem-hw - Hardware wallet SDK for Viem
 *
 * Root entrypoint exports:
 * - Shared types and interfaces
 * - Unified error classes
 * - Utility functions
 * - Version information
 *
 * For vendor-specific functionality, import from:
 * - viem-hw/ledger
 * - viem-hw/trezor
 */

// Types
export type {
  DerivationPath,
  DiscoveredAccount,
  DiscoveryOptions,
  HardwareWalletAccount,
  SignatureComponents,
  TransactionType,
  TypedDataDomain,
} from './shared/types.js'

// Errors
export {
  HardwareWalletError,
  DeviceNotFoundError,
  UserRejectedError,
  TransportError,
  DeviceLockedError,
  AppNotOpenError,
  InvalidPathError,
  UnsupportedOperationError,
  ConnectionTimeoutError,
  mapLedgerError,
  mapTrezorError,
} from './shared/errors.js'

// Path utilities
export {
  DERIVATION_PATHS,
  DEFAULT_BASE_PATH,
  isValidPath,
  parsePath,
  buildPath,
  pathToLedgerFormat,
  getBip44Path,
  getLedgerLivePath,
} from './shared/paths.js'

// Signature utilities
export {
  normalizeV,
  parseSignatureBytes,
  serializeSignature,
  isValidSignature,
  normalizeS,
  toViemSignature,
} from './shared/signatures.js'

// Version
export { VERSION } from './shared/version.js'
