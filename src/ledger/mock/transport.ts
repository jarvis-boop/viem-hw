/**
 * Mock Ledger Transport implementation for testing
 */

import type { Hex as HexType, PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getTestAccount, TEST_ACCOUNTS } from "../../shared/test-keys.js";
import type { DerivationPath } from "../../shared/types.js";
import type { LedgerTransport } from "../transport.js";

/**
 * Mock scenario configuration
 */
export type MockScenario =
  | "success"
  | "user-rejected"
  | "device-locked"
  | "app-not-open"
  | "disconnected"
  | "timeout"
  | "invalid-data";

/**
 * Mock device information
 */
export interface MockDeviceInfo {
  model: string;
  firmwareVersion: string;
}

/**
 * Mock app configuration
 */
export interface MockAppConfig {
  version: string;
  blindSigningEnabled: boolean;
  contractDataEnabled: boolean;
  erc20ProvisioningNecessary: boolean;
  starkEnabled: boolean;
  starkv2Supported: boolean;
}

/**
 * Options for MockLedgerTransport
 */
export interface MockLedgerOptions {
  /** Default scenario for all operations */
  scenario?: MockScenario;
  /** Scenario overrides by operation */
  scenarioOverrides?: {
    getAddress?: MockScenario;
    signMessage?: MockScenario;
    signTransaction?: MockScenario;
    signTypedData?: MockScenario;
  };
  /** Simulated delay in ms */
  delay?: number;
  /** Device info to return */
  deviceInfo?: MockDeviceInfo;
  /** App config to return */
  appConfig?: MockAppConfig;
  /** Custom test accounts (path -> account mapping) */
  accounts?: Map<string, { address: string; publicKey: string; privateKey: string }>;
  /** Whether device is connected */
  connected?: boolean;
}

/**
 * Mock Ledger Transport for testing
 *
 * Simulates device communication without real hardware.
 */
export class MockLedgerTransport implements LedgerTransport {
  private _connected: boolean;
  public _scenario: MockScenario;
  public _scenarioOverrides: MockLedgerOptions["scenarioOverrides"];
  private _delay: number;
  private _deviceInfo: MockDeviceInfo;
  private _appConfig: MockAppConfig;
  private _accounts: MockLedgerOptions["accounts"];
  private _onDisconnect?: () => void;

  constructor(options: MockLedgerOptions = {}) {
    this._connected = options.connected ?? true;
    this._scenario = options.scenario ?? "success";
    this._scenarioOverrides = options.scenarioOverrides;
    this._delay = options.delay ?? 0;
    this._deviceInfo = options.deviceInfo ?? {
      model: "nanoS",
      firmwareVersion: "2.1.0",
    };
    this._appConfig = options.appConfig ?? {
      version: "1.10.4",
      blindSigningEnabled: true,
      contractDataEnabled: true,
      erc20ProvisioningNecessary: false,
      starkEnabled: false,
      starkv2Supported: false,
    };
    this._accounts = options.accounts;
  }

  /**
   * Set connection state
   */
  setConnected(connected: boolean): void {
    this._connected = connected;
    if (!connected && this._onDisconnect) {
      this._onDisconnect();
    }
  }

  /**
   * Set scenario for subsequent operations
   */
  setScenario(scenario: MockScenario): void {
    this._scenario = scenario;
  }

  /**
   * Get current device info
   */
  getDeviceInfo(): MockDeviceInfo {
    return { ...this._deviceInfo };
  }

  /**
   * Get current app config
   */
  getAppConfig(): MockAppConfig {
    return { ...this._appConfig };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Register disconnect callback
   */
  onDisconnect(callback: () => void): void {
    this._onDisconnect = callback;
  }

  /**
   * Simulate delay
   */
  private async simulateDelay(): Promise<void> {
    if (this._delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this._delay));
    }
  }

  /**
   * Throw error based on scenario
   */
  private throwScenarioError(scenario: MockScenario): never {
    switch (scenario) {
      case "user-rejected":
        throw { statusCode: 0x6985, message: "Conditions of use not satisfied" };
      case "device-locked":
        throw { statusCode: 0x6faa, message: "Device is locked" };
      case "app-not-open":
        throw { statusCode: 0x6d00, message: "INS not supported (please open Ethereum app)" };
      case "disconnected":
        throw { name: "TransportOpenUserCancelled", message: "Device disconnected" };
      case "timeout":
        throw { name: "TransportError", message: "Timeout" };
      case "invalid-data":
        throw { statusCode: 0x6a80, message: "Invalid data received" };
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Send APDU command (not used directly with MockEthApp)
   */
  async send(
    _cla: number,
    _ins: number,
    _p1: number,
    _p2: number,
    _data?: Uint8Array | Buffer,
  ): Promise<Buffer> {
    await this.simulateDelay();

    if (!this._connected) {
      this.throwScenarioError("disconnected");
    }

    // Return success status
    return Buffer.from([0x90, 0x00]);
  }

  /**
   * Close transport
   */
  async close(): Promise<void> {
    this._connected = false;
  }

  /**
   * Get test account for path
   */
  getAccountForPath(path: string): { address: string; publicKey: string; privateKey: string } {
    // Check custom accounts first
    if (this._accounts?.has(path)) {
      return this._accounts.get(path)!;
    }

    // Use test accounts
    const testAccount = getTestAccount(path as DerivationPath);
    return {
      address: testAccount.address,
      publicKey: testAccount.publicKey,
      privateKey: testAccount.privateKey,
    };
  }

  /**
   * Get viem account for path (for signing)
   */
  getViemAccountForPath(path: string): PrivateKeyAccount {
    const account = this.getAccountForPath(path);
    return privateKeyToAccount(account.privateKey as HexType);
  }
}

/**
 * Mock Ledger Ethereum App for testing
 *
 * Provides the same interface as @ledgerhq/hw-app-eth
 */
export class MockLedgerEthApp {
  private transport: MockLedgerTransport;

  constructor(transport: MockLedgerTransport) {
    this.transport = transport;
  }

  /**
   * Get address from path
   */
  async getAddress(
    path: string,
    boolDisplay = false,
    _boolChaincode = false,
  ): Promise<{ publicKey: string; address: string; chainCode?: string }> {
    await this.simulateDelay();
    this.checkScenario("getAddress");

    if (boolDisplay) {
      // Simulate user confirmation delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const account = this.transport.getAccountForPath(path);
    return {
      publicKey: account.publicKey.slice(2), // Remove 0x prefix
      address: account.address,
    };
  }

  /**
   * Sign personal message
   */
  async signPersonalMessage(
    path: string,
    messageHex: string,
  ): Promise<{ v: number; s: string; r: string }> {
    await this.simulateDelay();
    this.checkScenario("signMessage");

    const viemAccount = this.transport.getViemAccountForPath(path);

    // Sign using viem
    const message = { raw: `0x${messageHex}` as HexType };
    const signature = await viemAccount.signMessage({ message });

    // Parse signature (65 bytes: r(32) + s(32) + v(1))
    const r = signature.slice(2, 66);
    const s = signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return { r, s, v };
  }

  /**
   * Sign transaction
   */
  async signTransaction(
    path: string,
    rawTxHex: string,
    _resolution?: unknown,
  ): Promise<{ v: string; s: string; r: string }> {
    await this.simulateDelay();
    this.checkScenario("signTransaction");

    // For mock purposes, we just return a valid-looking signature
    // In real usage, the serialized transaction would be signed
    const viemAccount = this.transport.getViemAccountForPath(path);

    // Sign a hash of the raw tx for testing
    const message = {
      raw: `0x${rawTxHex.replace(/^0x/, "").slice(0, 64).padEnd(64, "0")}` as HexType,
    };
    const signature = await viemAccount.signMessage({ message });

    // Parse signature
    const r = signature.slice(2, 66);
    const s = signature.slice(66, 130);
    const v = signature.slice(130, 132);

    return { r, s, v };
  }

  /**
   * Sign EIP-712 hashed message
   */
  async signEIP712HashedMessage(
    path: string,
    domainSeparatorHex: string,
    hashStructMessageHex: string,
  ): Promise<{ v: number; s: string; r: string }> {
    await this.simulateDelay();
    this.checkScenario("signTypedData");

    const viemAccount = this.transport.getViemAccountForPath(path);

    // For mock, sign a combined hash
    const combined = domainSeparatorHex + hashStructMessageHex;
    const message = { raw: `0x${combined.slice(0, 64).padEnd(64, "0")}` as HexType };
    const signature = await viemAccount.signMessage({ message });

    const r = signature.slice(2, 66);
    const s = signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return { r, s, v };
  }

  /**
   * Sign full EIP-712 message (newer firmware)
   */
  async signEIP712Message(
    path: string,
    jsonMessage: {
      domain: unknown;
      types: unknown;
      primaryType: string;
      message: unknown;
    },
    _fullImplem = false,
  ): Promise<{ v: number; s: string; r: string }> {
    await this.simulateDelay();
    this.checkScenario("signTypedData");

    const viemAccount = this.transport.getViemAccountForPath(path);

    // Sign typed data using viem
    const signature = await viemAccount.signTypedData({
      domain: jsonMessage.domain as Record<string, unknown>,
      types: jsonMessage.types as Record<string, unknown[]>,
      primaryType: jsonMessage.primaryType,
      message: jsonMessage.message as Record<string, unknown>,
    });

    const r = signature.slice(2, 66);
    const s = signature.slice(66, 130);
    const v = parseInt(signature.slice(130, 132), 16);

    return { r, s, v };
  }

  /**
   * Get app configuration
   */
  async getAppConfiguration(): Promise<MockAppConfig> {
    await this.simulateDelay();
    if (!this.transport.isConnected()) {
      throw { name: "TransportOpenUserCancelled", message: "Device disconnected" };
    }
    return this.transport.getAppConfig();
  }

  /**
   * Simulate delay
   */
  private async simulateDelay(): Promise<void> {
    // Small delay to simulate async
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Check scenario and throw if not success
   */
  private checkScenario(
    operation: "getAddress" | "signMessage" | "signTransaction" | "signTypedData",
  ): void {
    if (!this.transport.isConnected()) {
      throw { name: "TransportOpenUserCancelled", message: "Device disconnected" };
    }

    const scenario = this.transport._scenarioOverrides?.[operation] ?? this.transport._scenario;

    if (scenario !== "success") {
      this.throwScenarioError(scenario);
    }
  }

  /**
   * Throw error based on scenario
   */
  private throwScenarioError(scenario: MockScenario): never {
    switch (scenario) {
      case "user-rejected":
        throw { statusCode: 0x6985, message: "Conditions of use not satisfied" };
      case "device-locked":
        throw { statusCode: 0x6faa, message: "Device is locked" };
      case "app-not-open":
        throw { statusCode: 0x6d00, message: "INS not supported (please open Ethereum app)" };
      case "disconnected":
        throw { name: "TransportOpenUserCancelled", message: "Device disconnected" };
      case "timeout":
        throw { name: "TransportError", message: "Timeout" };
      case "invalid-data":
        throw { statusCode: 0x6a80, message: "Invalid data received" };
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }
}

/**
 * Default test accounts for convenience
 */
export const DEFAULT_TEST_ACCOUNTS = TEST_ACCOUNTS;
