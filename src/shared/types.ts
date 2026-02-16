import type { Address, Hex, LocalAccount } from "viem";

/**
 * Derivation path string (e.g., "m/44'/60'/0'/0/0")
 */
export type DerivationPath = `m/${string}`;

/**
 * A discovered account from hardware wallet enumeration
 */
export interface DiscoveredAccount {
  /** The Ethereum address */
  address: Address;
  /** The derivation path used */
  path: DerivationPath;
  /** Account index in the derivation */
  index: number;
}

/**
 * Options for account discovery
 */
export interface DiscoveryOptions {
  /** Number of accounts to discover (default: 5) */
  count?: number;
  /** Starting index (default: 0) */
  startIndex?: number;
  /** Base derivation path (default: "m/44'/60'/0'/0") */
  basePath?: string;
}

/**
 * Hardware wallet account - extends Viem's LocalAccount
 */
export interface HardwareWalletAccount extends LocalAccount<"custom"> {
  /** The derivation path of this account */
  path: DerivationPath;
}

/**
 * Transaction types for signing
 */
export type TransactionType = "legacy" | "eip1559" | "eip2930";

/**
 * EIP-712 typed data domain
 */
export interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number | bigint;
  verifyingContract?: Address;
  salt?: Hex;
}

/**
 * Signature components
 */
export interface SignatureComponents {
  r: Hex;
  s: Hex;
  v: bigint;
}
