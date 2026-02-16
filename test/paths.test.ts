import { describe, expect, it } from "bun:test";
import {
  isValidPath,
  parsePath,
  buildPath,
  pathToLedgerFormat,
  getBip44Path,
  getLedgerLivePath,
  DEFAULT_BASE_PATH,
  DERIVATION_PATHS,
  InvalidPathError,
} from "../src/index.js";

describe("isValidPath", () => {
  it("should validate correct paths", () => {
    expect(isValidPath("m/44'/60'/0'/0/0")).toBe(true);
    expect(isValidPath("m/44'/60'/0'/0/1")).toBe(true);
    expect(isValidPath("m/44'/60'/1'/0/0")).toBe(true);
    expect(isValidPath("m/0/1/2/3")).toBe(true);
    expect(isValidPath("m/0'/1'/2'/3'")).toBe(true);
  });

  it("should reject invalid paths", () => {
    expect(isValidPath("")).toBe(false);
    expect(isValidPath("44/60/0/0/0")).toBe(false); // Missing m/
    expect(isValidPath("m/")).toBe(false); // Empty after m/
    expect(isValidPath("m/44'/60'/abc")).toBe(false); // Non-numeric
    expect(isValidPath("m/-1'/60'/0'/0")).toBe(false); // Negative
  });
});

describe("parsePath", () => {
  it("should parse standard BIP-44 path", () => {
    const parsed = parsePath("m/44'/60'/0'/0/0");
    expect(parsed).toEqual([
      { index: 44, hardened: true },
      { index: 60, hardened: true },
      { index: 0, hardened: true },
      { index: 0, hardened: false },
      { index: 0, hardened: false },
    ]);
  });

  it("should parse non-hardened path", () => {
    const parsed = parsePath("m/0/1/2");
    expect(parsed).toEqual([
      { index: 0, hardened: false },
      { index: 1, hardened: false },
      { index: 2, hardened: false },
    ]);
  });

  it("should throw on invalid path", () => {
    expect(() => parsePath("invalid")).toThrow(InvalidPathError);
  });
});

describe("buildPath", () => {
  it("should build path from base and index", () => {
    expect(buildPath("m/44'/60'/0'/0", 0)).toBe("m/44'/60'/0'/0/0");
    expect(buildPath("m/44'/60'/0'/0", 5)).toBe("m/44'/60'/0'/0/5");
    expect(buildPath("m/44'/60'/0'/0", 100)).toBe("m/44'/60'/0'/0/100");
  });

  it("should throw on invalid base path", () => {
    expect(() => buildPath("invalid", 0)).toThrow(InvalidPathError);
  });

  it("should throw on negative index", () => {
    expect(() => buildPath("m/44'/60'/0'/0", -1)).toThrow(InvalidPathError);
  });
});

describe("pathToLedgerFormat", () => {
  it("should convert path to Ledger format", () => {
    const ledgerPath = pathToLedgerFormat("m/44'/60'/0'/0/0");
    expect(ledgerPath).toEqual([
      44 + 0x80000000, // 44' hardened
      60 + 0x80000000, // 60' hardened
      0 + 0x80000000, // 0' hardened
      0, // 0 non-hardened
      0, // 0 non-hardened
    ]);
  });

  it("should handle mixed hardened/non-hardened", () => {
    const ledgerPath = pathToLedgerFormat("m/44'/60'/0'/0/1");
    expect(ledgerPath[0]).toBe(44 + 0x80000000);
    expect(ledgerPath[3]).toBe(0);
    expect(ledgerPath[4]).toBe(1);
  });
});

describe("getBip44Path", () => {
  it("should generate BIP-44 paths", () => {
    expect(getBip44Path(0, 0)).toBe("m/44'/60'/0'/0/0");
    expect(getBip44Path(1, 0)).toBe("m/44'/60'/1'/0/0");
    expect(getBip44Path(0, 5)).toBe("m/44'/60'/0'/0/5");
  });

  it("should throw on negative indices", () => {
    expect(() => getBip44Path(-1, 0)).toThrow(InvalidPathError);
    expect(() => getBip44Path(0, -1)).toThrow(InvalidPathError);
  });
});

describe("getLedgerLivePath", () => {
  it("should generate Ledger Live style paths", () => {
    expect(getLedgerLivePath(0)).toBe("m/44'/60'/0'/0/0");
    expect(getLedgerLivePath(1)).toBe("m/44'/60'/1'/0/0");
    expect(getLedgerLivePath(5)).toBe("m/44'/60'/5'/0/0");
  });

  it("should throw on negative index", () => {
    expect(() => getLedgerLivePath(-1)).toThrow(InvalidPathError);
  });
});

describe("constants", () => {
  it("should have correct default base path", () => {
    expect(DEFAULT_BASE_PATH).toBe("m/44'/60'/0'/0");
  });

  it("should have correct derivation path constants", () => {
    expect(DERIVATION_PATHS.BIP44).toBe("m/44'/60'");
    expect(DERIVATION_PATHS.LEDGER_LIVE).toBe("m/44'/60'");
    expect(DERIVATION_PATHS.LEGACY).toBe("m/44'/60'/0'");
  });
});
