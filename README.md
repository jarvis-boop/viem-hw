# viem-hw

Hardware wallet SDK for [Viem](https://viem.sh) — Ledger and Trezor support with full TypeScript types.

## Features

- 🔐 **Viem-native** — Returns standard Viem `LocalAccount` objects
- 🌳 **Tree-shakeable** — Import only what you need (`viem-hw/ledger` or `viem-hw/trezor`)
- 🔒 **Type-safe** — Full TypeScript support with strict mode
- 🌐 **Browser-ready** — ESM-first, Chrome MV3 extension compatible
- ⚡ **Zero runtime coupling** — Viem is a peer dependency (type imports only)

## Installation

```bash
# Core package
npm install viem-hw

# For Ledger support (pick your transport)
npm install @ledgerhq/hw-app-eth @ledgerhq/hw-transport-webhid

# For Trezor support
npm install @trezor/connect
```

## Quick Start

### Ledger

```typescript
import { createLedgerAccount, discoverLedgerAccounts } from 'viem-hw/ledger'
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Discover accounts on the device
const accounts = await discoverLedgerAccounts({ count: 5 })
console.log(accounts)
// [{ address: '0x...', path: "m/44'/60'/0'/0/0", index: 0 }, ...]

// Create a Viem account from the first address
const account = await createLedgerAccount({
  path: accounts[0].path,
})

// Use with Viem wallet client
const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
})

// Sign messages
const signature = await client.signMessage({
  message: 'Hello from Ledger!',
})

// Sign transactions
const hash = await client.sendTransaction({
  to: '0x...',
  value: parseEther('0.1'),
})
```

### Trezor

```typescript
import { createTrezorAccount, discoverTrezorAccounts } from 'viem-hw/trezor'
import { createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'

// Discover accounts
const accounts = await discoverTrezorAccounts({
  count: 5,
  email: 'your@email.com', // Required by Trezor
  appUrl: 'https://yourapp.com',
})

// Create account
const account = await createTrezorAccount({
  path: accounts[0].path,
  email: 'your@email.com',
  appUrl: 'https://yourapp.com',
})

// Use exactly like Ledger
const client = createWalletClient({
  account,
  chain: mainnet,
  transport: http(),
})
```

## API Reference

### Root (`viem-hw`)

The root entrypoint exports shared utilities:

```typescript
import {
  // Error classes
  HardwareWalletError,
  DeviceNotFoundError,
  UserRejectedError,
  TransportError,
  DeviceLockedError,
  AppNotOpenError,
  InvalidPathError,
  UnsupportedOperationError,
  ConnectionTimeoutError,

  // Error mapping (for custom integrations)
  mapLedgerError,
  mapTrezorError,

  // Path utilities
  isValidPath,
  parsePath,
  buildPath,
  pathToLedgerFormat,
  getBip44Path,
  getLedgerLivePath,
  DEFAULT_BASE_PATH,
  DERIVATION_PATHS,

  // Signature utilities
  normalizeV,
  normalizeS,
  parseSignatureBytes,
  serializeSignature,
  isValidSignature,
  toViemSignature,

  // Types
  type DerivationPath,
  type DiscoveredAccount,
  type DiscoveryOptions,
  type HardwareWalletAccount,
  type SignatureComponents,

  // Version
  VERSION,
} from 'viem-hw'
```

### Ledger (`viem-hw/ledger`)

```typescript
import {
  createLedgerAccount,
  discoverLedgerAccounts,
  createTransport,
  isWebHIDAvailable,
  isWebUSBAvailable,
  getBestTransportType,
  type CreateLedgerAccountOptions,
  type DiscoverLedgerAccountsOptions,
  type LedgerDerivationStyle,
  type TransportType,
  type TransportOptions,
  type LedgerTransport,
} from 'viem-hw/ledger'
```

#### `createLedgerAccount(options?)`

Creates a Viem-compatible account from a Ledger device.

**Options:**
- `path?: DerivationPath` — Derivation path (default: `m/44'/60'/0'/0/0`)
- `transport?: LedgerTransport` — Pre-existing transport instance
- `transportType?: 'webhid' | 'webusb'` — Transport type (default: `'webhid'`)
- `timeout?: number` — Device selection timeout in ms (default: `60000`)

**Returns:** `Promise<HardwareWalletAccount>`

#### `discoverLedgerAccounts(options?)`

Discovers multiple accounts from a Ledger device.

**Options:**
- `count?: number` — Number of accounts (default: `5`)
- `startIndex?: number` — Starting index (default: `0`)
- `basePath?: string` — Base derivation path (default: `m/44'/60'/0'/0`)
- `derivationStyle?: 'bip44' | 'ledger-live'` — Derivation style (default: `'bip44'`)

**Returns:** `Promise<DiscoveredAccount[]>`

### Trezor (`viem-hw/trezor`)

```typescript
import {
  createTrezorAccount,
  discoverTrezorAccounts,
  getTrezorConnect,
  disposeTrezorConnect,
  type CreateTrezorAccountOptions,
  type DiscoverTrezorAccountsOptions,
  type TrezorDerivationStyle,
  type TrezorConnectOptions,
} from 'viem-hw/trezor'
```

#### `createTrezorAccount(options?)`

Creates a Viem-compatible account from a Trezor device.

**Options:**
- `path?: DerivationPath` — Derivation path (default: `m/44'/60'/0'/0/0`)
- `email?: string` — Email for Trezor manifest (required by Trezor)
- `appUrl?: string` — App URL for Trezor manifest
- `debug?: boolean` — Enable debug mode

**Returns:** `Promise<HardwareWalletAccount>`

#### `discoverTrezorAccounts(options?)`

Discovers multiple accounts from a Trezor device.

**Options:**
- `count?: number` — Number of accounts (default: `5`)
- `startIndex?: number` — Starting index (default: `0`)
- `basePath?: string` — Base derivation path (default: `m/44'/60'/0'/0`)
- `derivationStyle?: 'bip44' | 'ledger-live'` — Derivation style (default: `'bip44'`)

**Returns:** `Promise<DiscoveredAccount[]>`

## Error Handling

All errors extend `HardwareWalletError`:

```typescript
import { createLedgerAccount } from 'viem-hw/ledger'
import {
  DeviceNotFoundError,
  UserRejectedError,
  DeviceLockedError,
  AppNotOpenError,
} from 'viem-hw'

try {
  const account = await createLedgerAccount()
} catch (error) {
  if (error instanceof DeviceNotFoundError) {
    console.log('Please connect your device')
  } else if (error instanceof UserRejectedError) {
    console.log('User rejected on device')
  } else if (error instanceof DeviceLockedError) {
    console.log('Please unlock your device')
  } else if (error instanceof AppNotOpenError) {
    console.log('Please open the Ethereum app')
  }
}
```

## Derivation Paths

Standard BIP-44 Ethereum paths:

| Style | Path | Description |
|-------|------|-------------|
| BIP-44 | `m/44'/60'/0'/0/N` | Standard, used by MetaMask |
| Ledger Live | `m/44'/60'/N'/0/0` | Each account is hardened |
| Legacy | `m/44'/60'/0'/N` | Older wallets |

```typescript
import { getBip44Path, getLedgerLivePath } from 'viem-hw'

getBip44Path(0, 0) // "m/44'/60'/0'/0/0"
getBip44Path(0, 1) // "m/44'/60'/0'/0/1"
getLedgerLivePath(0) // "m/44'/60'/0'/0/0"
getLedgerLivePath(1) // "m/44'/60'/1'/0/0"
```

## Transaction Support

- ✅ Legacy transactions
- ✅ EIP-1559 transactions
- ✅ EIP-712 typed data (signTypedData)
- ✅ Personal message signing (signMessage)

## Browser Extension Support

viem-hw is fully compatible with Chrome MV3 extensions:

- ESM-only output
- No Node.js-specific APIs
- `sideEffects: false` for optimal tree-shaking
- WebHID/WebUSB transport support

## Peer Dependencies

```json
{
  "peerDependencies": {
    "viem": ">=2.0.0"
  },
  "optionalPeerDependencies": {
    "@ledgerhq/hw-app-eth": ">=6.40.0",
    "@ledgerhq/hw-transport-webhid": ">=6.30.0",
    "@ledgerhq/hw-transport-webusb": ">=6.30.0",
    "@trezor/connect": ">=9.0.0"
  }
}
```

## License

MIT
