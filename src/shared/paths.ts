import { InvalidPathError } from "./errors.js";
import type { DerivationPath } from "./types.js";

/**
 * Standard Ethereum derivation paths
 */
export const DERIVATION_PATHS = {
  /** BIP-44 standard: m/44'/60'/account'/0/index */
  BIP44: "m/44'/60'",
  /** Ledger Live: m/44'/60'/index'/0/0 */
  LEDGER_LIVE: "m/44'/60'",
  /** Legacy MEW/MyCrypto: m/44'/60'/0'/index */
  LEGACY: "m/44'/60'/0'",
} as const;

/**
 * Default base path for account derivation
 */
export const DEFAULT_BASE_PATH = "m/44'/60'/0'/0";

/**
 * Validates a derivation path string
 */
export function isValidPath(path: string): path is DerivationPath {
  // Must start with m/
  if (!path.startsWith("m/")) {
    return false;
  }

  // Split into components (skip the 'm')
  const parts = path.slice(2).split("/");

  // Must have at least one component after m/
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
    return false;
  }

  // Each component must be a number, optionally followed by '
  for (const part of parts) {
    const isHardened = part.endsWith("'");
    const numStr = isHardened ? part.slice(0, -1) : part;

    // Must be a valid non-negative integer
    if (!/^\d+$/.test(numStr)) {
      return false;
    }

    const num = parseInt(numStr, 10);
    // BIP-32 allows 31-bit indices (2^31 - 1 for hardened offset)
    if (num < 0 || num > 0x7fffffff) {
      return false;
    }
  }

  return true;
}

/**
 * Parses a derivation path into its components
 */
export function parsePath(path: string): { index: number; hardened: boolean }[] {
  if (!isValidPath(path)) {
    throw new InvalidPathError(path, "Invalid path format");
  }

  const parts = path.slice(2).split("/");
  return parts.map((part) => {
    const hardened = part.endsWith("'");
    const index = parseInt(hardened ? part.slice(0, -1) : part, 10);
    return { index, hardened };
  });
}

/**
 * Builds a derivation path from a base path and account index
 */
export function buildPath(basePath: string, index: number): DerivationPath {
  if (!basePath.startsWith("m/")) {
    throw new InvalidPathError(basePath, "Base path must start with m/");
  }

  if (index < 0 || !Number.isInteger(index)) {
    throw new InvalidPathError(`${basePath}/${index}`, "Index must be a non-negative integer");
  }

  const fullPath = `${basePath}/${index}`;
  if (!isValidPath(fullPath)) {
    throw new InvalidPathError(fullPath, "Resulting path is invalid");
  }

  return fullPath as DerivationPath;
}

/**
 * Converts a derivation path to Ledger's expected format (array of numbers)
 * Hardened indices have 0x80000000 added
 */
export function pathToLedgerFormat(path: DerivationPath): number[] {
  const components = parsePath(path);
  return components.map(({ index, hardened }) => (hardened ? index + 0x80000000 : index));
}

/**
 * Gets the standard BIP-44 path for an account index
 */
export function getBip44Path(accountIndex: number, addressIndex = 0): DerivationPath {
  if (accountIndex < 0 || addressIndex < 0) {
    throw new InvalidPathError(
      `m/44'/60'/${accountIndex}'/0/${addressIndex}`,
      "Indices must be non-negative",
    );
  }
  return `m/44'/60'/${accountIndex}'/0/${addressIndex}` as DerivationPath;
}

/**
 * Gets Ledger Live style path (account at index position)
 */
export function getLedgerLivePath(index: number): DerivationPath {
  if (index < 0) {
    throw new InvalidPathError(`m/44'/60'/${index}'/0/0`, "Index must be non-negative");
  }
  return `m/44'/60'/${index}'/0/0` as DerivationPath;
}
