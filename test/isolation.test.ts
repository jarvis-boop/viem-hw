import { describe, expect, it } from "bun:test";

describe("Dependency Isolation", () => {
  it("should import root module without vendor dependencies", async () => {
    // This should work without any hardware wallet SDKs installed
    const root = await import("../src/index.js");

    expect(root.HardwareWalletError).toBeDefined();
    expect(root.isValidPath).toBeDefined();
    expect(root.normalizeV).toBeDefined();
    expect(root.VERSION).toBeDefined();
  });

  it("should export Ledger module separately", async () => {
    // The module should be importable (types/exports exist)
    const ledger = await import("../src/ledger/index.js");

    expect(ledger.createLedgerAccount).toBeDefined();
    expect(ledger.discoverLedgerAccounts).toBeDefined();
    expect(ledger.createTransport).toBeDefined();
    expect(ledger.isWebHIDAvailable).toBeDefined();
  });

  it("should export Trezor module separately", async () => {
    // The module should be importable (types/exports exist)
    const trezor = await import("../src/trezor/index.js");

    expect(trezor.createTrezorAccount).toBeDefined();
    expect(trezor.discoverTrezorAccounts).toBeDefined();
    expect(trezor.getTrezorConnect).toBeDefined();
  });

  it("should not import Trezor code when importing Ledger", async () => {
    // Import Ledger module
    const ledgerModule = await import("../src/ledger/index.js");

    // Check that Trezor-specific functions don't exist
    expect((ledgerModule as Record<string, unknown>).createTrezorAccount).toBeUndefined();
    expect((ledgerModule as Record<string, unknown>).getTrezorConnect).toBeUndefined();
  });

  it("should not import Ledger code when importing Trezor", async () => {
    // Import Trezor module
    const trezorModule = await import("../src/trezor/index.js");

    // Check that Ledger-specific functions don't exist
    expect((trezorModule as Record<string, unknown>).createLedgerAccount).toBeUndefined();
    expect((trezorModule as Record<string, unknown>).createTransport).toBeUndefined();
  });

  it("root module should not export vendor-specific functions", async () => {
    const root = await import("../src/index.js");

    // Root should NOT have vendor-specific exports
    expect((root as Record<string, unknown>).createLedgerAccount).toBeUndefined();
    expect((root as Record<string, unknown>).createTrezorAccount).toBeUndefined();
    expect((root as Record<string, unknown>).discoverLedgerAccounts).toBeUndefined();
    expect((root as Record<string, unknown>).discoverTrezorAccounts).toBeUndefined();
  });
});

describe("Type Exports", () => {
  it("should export shared types from root", async () => {
    // TypeScript types are compile-time only, but we can verify
    // the module structure is correct
    const root = await import("../src/index.js");

    // These are runtime exports that should exist
    expect(typeof root.DERIVATION_PATHS).toBe("object");
    expect(typeof root.DEFAULT_BASE_PATH).toBe("string");
    expect(typeof root.VERSION).toBe("string");
  });
});
