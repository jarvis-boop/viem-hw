import { Hex, Signature } from 'ox'
import type { Hex as HexType } from 'viem'
import type { SignatureComponents } from './types.js'

/**
 * Normalizes a signature's V value to standard 27/28 format
 * Different devices may return V in different formats (0/1 or 27/28)
 */
export function normalizeV(v: number | bigint): bigint {
  const vNum = typeof v === 'bigint' ? v : BigInt(v)

  // If V is 0 or 1, convert to 27/28
  if (vNum === 0n || vNum === 1n) {
    return vNum + 27n
  }

  // If V is already 27/28, return as-is
  if (vNum === 27n || vNum === 28n) {
    return vNum
  }

  // For EIP-155 signatures (v >= 35), keep as-is
  // v = chainId * 2 + 35 + yParity
  if (vNum >= 35n) {
    return vNum
  }

  // Fallback: assume it's yParity
  return (vNum % 2n) + 27n
}

/**
 * Converts raw signature bytes to components
 */
export function parseSignatureBytes(
  r: Uint8Array | HexType,
  s: Uint8Array | HexType,
  v: number | bigint
): SignatureComponents {
  const rHex = typeof r === 'string' ? r : Hex.fromBytes(r)
  const sHex = typeof s === 'string' ? s : Hex.fromBytes(s)

  return {
    r: rHex as HexType,
    s: sHex as HexType,
    v: normalizeV(v),
  }
}

/**
 * Converts signature components to a serialized signature hex
 */
export function serializeSignature(components: SignatureComponents): HexType {
  // Use ox's Signature utilities for proper serialization
  const yParity = components.v === 28n || components.v % 2n === 0n ? 1 : 0
  
  const signature = Signature.from({
    r: BigInt(components.r),
    s: BigInt(components.s),
    yParity,
  })

  return Signature.toHex(signature) as HexType
}

/**
 * Validates that a signature is properly formed
 */
export function isValidSignature(components: SignatureComponents): boolean {
  try {
    // R and S must be 32 bytes (66 chars with 0x prefix)
    if (components.r.length !== 66 || components.s.length !== 66) {
      return false
    }

    // R and S must be valid hex
    const rBigInt = BigInt(components.r)
    const sBigInt = BigInt(components.s)

    // R and S must be non-zero and less than curve order
    // secp256k1 curve order
    const curveOrder = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

    if (rBigInt === 0n || rBigInt >= curveOrder) {
      return false
    }
    if (sBigInt === 0n || sBigInt >= curveOrder) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Ensures S is in the lower half of the curve (EIP-2)
 * This is required for transaction validity
 */
export function normalizeS(s: HexType): HexType {
  const curveOrder = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
  const halfOrder = curveOrder / 2n

  const sBigInt = BigInt(s)

  if (sBigInt > halfOrder) {
    // s = curveOrder - s
    const normalizedS = curveOrder - sBigInt
    return Hex.fromNumber(normalizedS, { size: 32 }) as HexType
  }

  return s
}

/**
 * Combines R, S, V into recovery signature format expected by Viem
 */
export function toViemSignature(components: SignatureComponents): HexType {
  const normalizedS = normalizeS(components.s)
  return serializeSignature({
    r: components.r,
    s: normalizedS,
    v: components.v,
  })
}
