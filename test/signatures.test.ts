import { describe, expect, it } from "bun:test";
import {
  normalizeV,
  parseSignatureBytes,
  serializeSignature,
  isValidSignature,
  normalizeS,
  toViemSignature,
} from "../src/index.js";

describe("normalizeV", () => {
  it("should convert 0/1 to 27/28", () => {
    expect(normalizeV(0)).toBe(27n);
    expect(normalizeV(1)).toBe(28n);
    expect(normalizeV(0n)).toBe(27n);
    expect(normalizeV(1n)).toBe(28n);
  });

  it("should keep 27/28 as-is", () => {
    expect(normalizeV(27)).toBe(27n);
    expect(normalizeV(28)).toBe(28n);
    expect(normalizeV(27n)).toBe(27n);
    expect(normalizeV(28n)).toBe(28n);
  });

  it("should keep EIP-155 values as-is", () => {
    // For chainId 1: v = 1 * 2 + 35 = 37 or 38
    expect(normalizeV(37)).toBe(37n);
    expect(normalizeV(38)).toBe(38n);
  });
});

describe("parseSignatureBytes", () => {
  it("should parse hex strings", () => {
    const r = "0x" + "ab".repeat(32);
    const s = "0x" + "cd".repeat(32);
    const v = 27;

    const components = parseSignatureBytes(r, s, v);
    expect(components.r).toBe(r);
    expect(components.s).toBe(s);
    expect(components.v).toBe(27n);
  });

  it("should parse Uint8Array", () => {
    const r = new Uint8Array(32).fill(0xab);
    const s = new Uint8Array(32).fill(0xcd);
    const v = 1;

    const components = parseSignatureBytes(r, s, v);
    expect(components.r).toBe("0x" + "ab".repeat(32));
    expect(components.s).toBe("0x" + "cd".repeat(32));
    expect(components.v).toBe(28n); // 1 -> 28
  });
});

describe("isValidSignature", () => {
  it("should validate properly formed signatures", () => {
    const valid = {
      r: "0x" + "12".repeat(32),
      s: "0x" + "34".repeat(32),
      v: 27n,
    };
    expect(isValidSignature(valid)).toBe(true);
  });

  it("should reject signatures with wrong r length", () => {
    const invalid = {
      r: "0x1234", // Too short
      s: "0x" + "34".repeat(32),
      v: 27n,
    };
    expect(isValidSignature(invalid)).toBe(false);
  });

  it("should reject signatures with wrong s length", () => {
    const invalid = {
      r: "0x" + "12".repeat(32),
      s: "0x5678", // Too short
      v: 27n,
    };
    expect(isValidSignature(invalid)).toBe(false);
  });

  it("should reject zero r value", () => {
    const invalid = {
      r: "0x" + "00".repeat(32),
      s: "0x" + "34".repeat(32),
      v: 27n,
    };
    expect(isValidSignature(invalid)).toBe(false);
  });

  it("should reject zero s value", () => {
    const invalid = {
      r: "0x" + "12".repeat(32),
      s: "0x" + "00".repeat(32),
      v: 27n,
    };
    expect(isValidSignature(invalid)).toBe(false);
  });
});

describe("normalizeS", () => {
  // secp256k1 curve order divided by 2
  const _halfOrder = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

  it("should keep s values in lower half unchanged", () => {
    const lowS = "0x" + "00".repeat(31) + "01"; // Very small s
    expect(normalizeS(lowS)).toBe(lowS);
  });

  it("should normalize s values in upper half", () => {
    // Create an s value that's definitely > halfOrder
    // The curve order is ~0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
    const highS = "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140";
    const normalized = normalizeS(highS);
    // Normalized should be smaller
    expect(BigInt(normalized)).toBeLessThan(BigInt(highS));
  });
});

describe("serializeSignature and toViemSignature", () => {
  it("should serialize signature to hex", () => {
    const components = {
      r: "0x" + "ab".repeat(32),
      s: "0x" + "cd".repeat(32),
      v: 28n,
    };

    const serialized = serializeSignature(components);
    // Should be 65 bytes (130 hex chars + 0x prefix)
    expect(serialized.length).toBe(132);
    expect(serialized.startsWith("0x")).toBe(true);
  });

  it("should include normalized s in toViemSignature", () => {
    const components = {
      r: "0x" + "ab".repeat(32),
      s: "0x" + "01".repeat(32), // Low s, should stay same
      v: 27n,
    };

    const result = toViemSignature(components);
    expect(result.startsWith("0x")).toBe(true);
    expect(result.length).toBe(132); // 65 bytes
  });
});
