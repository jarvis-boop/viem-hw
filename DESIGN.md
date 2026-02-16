# viem-hw Design Document

## Overview

viem-hw is a hardware wallet SDK designed to integrate seamlessly with [Viem](https://viem.sh). It provides Viem-compatible `LocalAccount` objects for Ledger and Trezor devices.

## Design Goals

1. **Viem-native** — Return standard Viem account objects, not custom wrappers
2. **Tree-shakeable** — Importing Ledger code shouldn't pull in Trezor code
3. **Type-safe** — Full TypeScript support with strict mode enabled
4. **Browser-first** — ESM-only, compatible with Chrome MV3 extensions
5. **Minimal runtime** — Viem as peer dependency, vendor SDKs as optional peers

## Architecture

```
viem-hw/
├── src/
│   ├── index.ts          # Root: errors, types, utilities
│   ├── shared/           # Shared code (no vendor dependencies)
│   │   ├── types.ts      # TypeScript types
│   │   ├── errors.ts     # Unified error classes
│   │   ├── paths.ts      # Derivation path utilities
│   │   ├── signatures.ts # Signature normalization
│   │   └── version.ts    # Package version
│   ├── ledger/           # Ledger-specific code
│   │   ├── index.ts      # Public exports
│   │   ├── account.ts    # createLedgerAccount
│   │   ├── discovery.ts  # discoverLedgerAccounts
│   │   └── transport.ts  # WebHID/WebUSB transport
│   └── trezor/           # Trezor-specific code
│       ├── index.ts      # Public exports
│       ├── account.ts    # createTrezorAccount
│       ├── discovery.ts  # discoverTrezorAccounts
│       └── connect.ts    # Trezor Connect wrapper
```

## Entrypoints

The package has exactly three entrypoints:

| Entrypoint | Purpose |
|------------|---------|
| `viem-hw` | Shared types, errors, utilities |
| `viem-hw/ledger` | Ledger device support |
| `viem-hw/trezor` | Trezor device support |

This design ensures:
- Users import only what they need
- No vendor code is loaded unless explicitly imported
- Root entrypoint has zero vendor dependencies

## Dependency Strategy

### Runtime Dependencies

- **ox** — Hex/bytes/hash utilities (lighter than ethers)

### Peer Dependencies

- **viem** — Required, but only used for types (`import type`)

### Optional Peer Dependencies

These are dynamically imported at runtime:

**Ledger:**
- `@ledgerhq/hw-app-eth` — Ethereum app communication
- `@ledgerhq/hw-transport-webhid` — WebHID transport
- `@ledgerhq/hw-transport-webusb` — WebUSB transport

**Trezor:**
- `@trezor/connect` — Trezor Connect library

### Why Dynamic Imports?

Vendor SDKs are loaded via dynamic `import()` to:
1. Enable tree-shaking (unused vendors aren't bundled)
2. Fail gracefully with helpful error messages
3. Allow users to install only what they need

## Account Interface

All accounts implement Viem's `LocalAccount` interface:

```typescript
interface HardwareWalletAccount extends LocalAccount<'custom'> {
  address: Address
  path: DerivationPath
  signMessage(args: { message: SignableMessage }): Promise<Hex>
  signTransaction(tx: TransactionSerializable): Promise<Hex>
  signTypedData(data: TypedDataDefinition): Promise<Hex>
}
```

This allows hardware wallet accounts to be used anywhere Viem expects an account:

```typescript
const client = createWalletClient({ account, chain, transport })
await client.signMessage({ message: 'Hello' })
await client.sendTransaction({ to, value })
```

## Error Handling

### Unified Error Classes

All errors extend `HardwareWalletError`:

```typescript
class HardwareWalletError extends Error {
  code: string
  name: string
}

class DeviceNotFoundError extends HardwareWalletError
class UserRejectedError extends HardwareWalletError
class DeviceLockedError extends HardwareWalletError
class TransportError extends HardwareWalletError
class AppNotOpenError extends HardwareWalletError
class InvalidPathError extends HardwareWalletError
class UnsupportedOperationError extends HardwareWalletError
class ConnectionTimeoutError extends HardwareWalletError
```

### Error Mapping

Vendor-specific errors are mapped to unified types:

```typescript
// Ledger status code 0x6985 → UserRejectedError
// Trezor code 'Failure_ActionCancelled' → UserRejectedError
```

## Transaction Serialization

### Ledger

Ledger requires RLP-encoded transactions:

1. **Legacy**: `rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])`
2. **EIP-1559**: `0x02 || rlp([chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList])`

The SDK includes a minimal RLP encoder to avoid additional dependencies.

### Trezor

Trezor Connect accepts structured transaction objects:

```typescript
interface TrezorEthereumTransaction {
  to: string
  value: string
  gasLimit: string
  nonce: string
  chainId: number
  gasPrice?: string           // Legacy
  maxFeePerGas?: string       // EIP-1559
  maxPriorityFeePerGas?: string
}
```

## Signature Handling

### V Value Normalization

Different devices return V in different formats:
- `0` or `1` (yParity)
- `27` or `28` (legacy)
- `chainId * 2 + 35 + yParity` (EIP-155)

The SDK normalizes all to standard 27/28 format.

### S Value Normalization (EIP-2)

The SDK ensures S is in the lower half of the curve order for transaction malleability protection.

## Derivation Paths

### Supported Styles

| Style | Path | Use Case |
|-------|------|----------|
| BIP-44 | `m/44'/60'/0'/0/N` | MetaMask, most wallets |
| Ledger Live | `m/44'/60'/N'/0/0` | Ledger Live app |
| Legacy | `m/44'/60'/0'/N` | Older implementations |

### Path Utilities

```typescript
getBip44Path(accountIndex, addressIndex)  // Standard BIP-44
getLedgerLivePath(index)                   // Ledger Live style
buildPath(basePath, index)                 // Custom base paths
```

## Build System

### Zile Configuration

The project uses [zile](https://github.com/wevm/zile) for building:

- ESM-only output
- TypeScript declarations
- Source maps
- No bundling (preserves tree-shaking)

### Package Exports

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./ledger": "./src/ledger/index.ts",
    "./trezor": "./src/trezor/index.ts"
  }
}
```

After build, zile transforms these to point to `./dist/`.

## Testing Strategy

### Unit Tests

- Path parsing and validation
- Error class behavior
- Error mapping logic
- Signature normalization
- Dependency isolation

### Integration Tests (Manual)

Due to hardware requirements, device integration is tested manually:
- Device connection
- Address derivation
- Message signing
- Transaction signing
- EIP-712 typed data

## Browser Compatibility

### Supported Environments

- Chrome 89+ (WebHID)
- Edge 89+ (WebHID)
- Chrome 61+ (WebUSB, legacy)

### Chrome MV3 Extensions

The SDK is fully compatible with Manifest V3:
- ESM modules
- No eval or remote code
- `sideEffects: false` in package.json

## Future Considerations

### Potential Additions

1. **Account abstraction** — Support for ERC-4337 user operations
2. **Multiple chains** — Non-Ethereum chain support
3. **Batch operations** — Sign multiple messages/transactions
4. **Keyring pattern** — Manage multiple accounts from one device connection

### Non-Goals

- Legacy CommonJS support
- Node.js-specific transports (USB)
- Wallet UI components
- Full EIP-712 encoding (use Viem for that)

## References

- [Viem Documentation](https://viem.sh)
- [BIP-32](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)
- [BIP-44](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [EIP-155](https://eips.ethereum.org/EIPS/eip-155)
- [EIP-712](https://eips.ethereum.org/EIPS/eip-712)
- [EIP-1559](https://eips.ethereum.org/EIPS/eip-1559)
- [Ledger JS SDK](https://github.com/LedgerHQ/ledger-live/tree/develop/libs/ledgerjs)
- [Trezor Connect](https://github.com/trezor/trezor-suite/tree/develop/packages/connect)
