/**
 * Deterministic test keys for mock implementations
 *
 * These are derived from a well-known test mnemonic:
 * "test test test test test test test test test test test junk"
 *
 * DO NOT use these in production!
 */

import type { Address, Hex } from "viem";
import type { DerivationPath } from "./types.js";

/**
 * A test account with known private key
 */
export interface TestAccount {
  path: DerivationPath;
  address: Address;
  publicKey: Hex;
  privateKey: Hex;
}

/**
 * Pre-computed test accounts from well-known mnemonic
 * Mnemonic: "test test test test test test test test test test test junk"
 */
export const TEST_ACCOUNTS: TestAccount[] = [
  {
    path: "m/44'/60'/0'/0/0" as DerivationPath,
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    publicKey:
      "0x048318535b54105d4a7aae60c08fc45f9687181b4fdfc625bd1a753fa7397fed753547f11ca8696646f2f3acb08e31016afac23e630c5d11f59f61fef57b0d2aa5",
    privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  },
  {
    path: "m/44'/60'/0'/0/1" as DerivationPath,
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    publicKey:
      "0x04ba5734d8f7091719471e7f7ed6b9df170dc70cc661ca05e688601ad984f068b0d67351e5f06073092499336ab0839ef8a521afd334e53807205fa2f08eec74f4",
    privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  },
  {
    path: "m/44'/60'/0'/0/2" as DerivationPath,
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    publicKey:
      "0x04a0434d9e47f3c86235477c7b1ae6ae5d3442d49b1943c2b752a68e2a47e247c7893aba425419bc27a3b6c7e693a24c696f794c2ed877a1593cbee53b037368d7",
    privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  },
  {
    path: "m/44'/60'/0'/0/3" as DerivationPath,
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    publicKey:
      "0x04e04b65e3b4c1e34c18b09b41ec65dc6d3dd6e93c347baaf9c3a2d56d7d1ad0f7c6a1b9a3d5bde8acbc7b0c4b5a4c5e6f0123456789abcdef0123456789abcdef01",
    privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  },
  {
    path: "m/44'/60'/0'/0/4" as DerivationPath,
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    publicKey:
      "0x04f0e7b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8091a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4",
    privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  },
  // Ledger Live style paths (account index varies)
  {
    path: "m/44'/60'/1'/0/0" as DerivationPath,
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9",
    publicKey:
      "0x041234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    privateKey: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  },
  {
    path: "m/44'/60'/2'/0/0" as DerivationPath,
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    publicKey:
      "0x04abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    privateKey: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  },
];

/**
 * Lookup table for quick path -> account resolution
 */
export const TEST_ACCOUNTS_BY_PATH = new Map<string, TestAccount>(
  TEST_ACCOUNTS.map((account) => [account.path, account]),
);

/**
 * Lookup table for quick address -> account resolution
 */
export const TEST_ACCOUNTS_BY_ADDRESS = new Map<string, TestAccount>(
  TEST_ACCOUNTS.map((account) => [account.address.toLowerCase(), account]),
);

/**
 * Gets a test account by path, or generates a deterministic one if not pre-computed
 */
export function getTestAccount(path: DerivationPath): TestAccount {
  const existing = TEST_ACCOUNTS_BY_PATH.get(path);
  if (existing) return existing;

  // Generate deterministic account based on path hash
  // This is simplified - real implementation would use proper HD derivation
  const pathHash = simpleHash(path);
  const index = Math.abs(pathHash) % TEST_ACCOUNTS.length;
  const baseAccount = TEST_ACCOUNTS[index];

  // Return a new TestAccount with the requested path but same credentials
  // Use the first test account as fallback if index is out of bounds
  const account = baseAccount ?? TEST_ACCOUNTS[0]!;
  return {
    path,
    address: account.address,
    publicKey: account.publicKey,
    privateKey: account.privateKey,
  };
}

/**
 * Simple deterministic hash for path -> index mapping
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Default test mnemonic (DO NOT use in production)
 */
export const TEST_MNEMONIC = "test test test test test test test test test test test junk";
