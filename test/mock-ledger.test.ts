import { describe, expect, it } from "bun:test";
import { verifyMessage, verifyTypedData, parseEther } from "viem";
import {
  createMockLedgerAccount,
  createMockLedgerDiscovery,
  MockLedgerTransport,
  MockLedgerEthApp,
} from "../src/ledger/mock/index.js";
import {
  UserRejectedError,
  DeviceLockedError,
  AppNotOpenError,
  DeviceNotFoundError,
} from "../src/index.js";

describe("MockLedgerTransport", () => {
  it("should create with default options", () => {
    const transport = new MockLedgerTransport();
    expect(transport.isConnected()).toBe(true);
    expect(transport.getDeviceInfo().model).toBe("nanoS");
  });

  it("should set and check connection state", () => {
    const transport = new MockLedgerTransport();
    expect(transport.isConnected()).toBe(true);
    transport.setConnected(false);
    expect(transport.isConnected()).toBe(false);
  });

  it("should set scenario", () => {
    const transport = new MockLedgerTransport();
    transport.setScenario("user-rejected");
    expect(transport._scenario).toBe("user-rejected");
  });

  it("should return device info", () => {
    const transport = new MockLedgerTransport({
      deviceInfo: { model: "nanoX", firmwareVersion: "2.2.0" },
    });
    const info = transport.getDeviceInfo();
    expect(info.model).toBe("nanoX");
    expect(info.firmwareVersion).toBe("2.2.0");
  });

  it("should return app config", () => {
    const transport = new MockLedgerTransport();
    const config = transport.getAppConfig();
    expect(config.version).toBe("1.10.4");
    expect(config.blindSigningEnabled).toBe(true);
  });

  it("should get account for path", () => {
    const transport = new MockLedgerTransport();
    const account = transport.getAccountForPath("m/44'/60'/0'/0/0");
    expect(account.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("should close transport", async () => {
    const transport = new MockLedgerTransport();
    await transport.close();
    expect(transport.isConnected()).toBe(false);
  });
});

describe("MockLedgerEthApp", () => {
  it("should get address", async () => {
    const transport = new MockLedgerTransport();
    const eth = new MockLedgerEthApp(transport);

    const result = await eth.getAddress("m/44'/60'/0'/0/0");
    expect(result.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(result.publicKey).toBeDefined();
  });

  it("should sign personal message", async () => {
    const transport = new MockLedgerTransport();
    const eth = new MockLedgerEthApp(transport);

    const messageHex = Buffer.from("Hello, World!").toString("hex");
    const result = await eth.signPersonalMessage("m/44'/60'/0'/0/0", messageHex);

    expect(result.r).toBeDefined();
    expect(result.s).toBeDefined();
    expect(result.v).toBeGreaterThanOrEqual(27);
  });

  it("should throw on user rejection", async () => {
    const transport = new MockLedgerTransport({ scenario: "user-rejected" });
    const eth = new MockLedgerEthApp(transport);

    await expect(eth.signPersonalMessage("m/44'/60'/0'/0/0", "aa")).rejects.toMatchObject({
      statusCode: 0x6985,
    });
  });

  it("should throw on device locked", async () => {
    const transport = new MockLedgerTransport({ scenario: "device-locked" });
    const eth = new MockLedgerEthApp(transport);

    await expect(eth.signPersonalMessage("m/44'/60'/0'/0/0", "aa")).rejects.toMatchObject({
      statusCode: 0x6faa,
    });
  });

  it("should throw on app not open", async () => {
    const transport = new MockLedgerTransport({ scenario: "app-not-open" });
    const eth = new MockLedgerEthApp(transport);

    await expect(eth.signPersonalMessage("m/44'/60'/0'/0/0", "aa")).rejects.toMatchObject({
      statusCode: 0x6d00,
    });
  });

  it("should throw when disconnected", async () => {
    const transport = new MockLedgerTransport({ connected: false });
    const eth = new MockLedgerEthApp(transport);

    await expect(eth.signPersonalMessage("m/44'/60'/0'/0/0", "aa")).rejects.toMatchObject({
      name: "TransportOpenUserCancelled",
    });
  });

  it("should get app configuration", async () => {
    const transport = new MockLedgerTransport();
    const eth = new MockLedgerEthApp(transport);

    const config = await eth.getAppConfiguration();
    expect(config.version).toBe("1.10.4");
  });
});

describe("createMockLedgerAccount", () => {
  it("should create account with default path", () => {
    const account = createMockLedgerAccount();
    expect(account.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(account.path).toBe("m/44'/60'/0'/0/0");
    expect(account.type).toBe("local");
  });

  it("should create account with custom path", () => {
    const account = createMockLedgerAccount({ path: "m/44'/60'/0'/0/1" });
    expect(account.address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(account.path).toBe("m/44'/60'/0'/0/1");
  });

  it("should sign message and verify", async () => {
    const account = createMockLedgerAccount();
    const message = "Hello, Ledger!";

    const signature = await account.signMessage({ message });

    // Verify the signature
    const valid = await verifyMessage({
      address: account.address,
      message,
      signature,
    });
    expect(valid).toBe(true);
  });

  it("should sign typed data and verify", async () => {
    const account = createMockLedgerAccount();

    const domain = {
      name: "Test App",
      version: "1",
      chainId: 1,
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC" as const,
    };

    const types = {
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
    };

    const primaryType = "Mail" as const;

    const message = {
      from: {
        name: "Alice",
        wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" as const,
      },
      to: {
        name: "Bob",
        wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" as const,
      },
      contents: "Hello!",
    };

    const signature = await account.signTypedData({
      domain,
      types,
      primaryType,
      message,
    });

    // Verify the signature
    const valid = await verifyTypedData({
      address: account.address,
      domain,
      types,
      primaryType,
      message,
      signature,
    });
    expect(valid).toBe(true);
  });

  it("should sign transaction", async () => {
    const account = createMockLedgerAccount();

    const signature = await account.signTransaction({
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      value: parseEther("1"),
      gas: 21000n,
      maxFeePerGas: 20000000000n,
      maxPriorityFeePerGas: 1000000000n,
      nonce: 0,
      chainId: 1,
    });

    expect(signature).toMatch(/^0x/);
    expect(signature.length).toBeGreaterThan(100);
  });

  it("should throw UserRejectedError on rejection scenario", async () => {
    const account = createMockLedgerAccount({ scenario: "user-rejected" });

    await expect(account.signMessage({ message: "test" })).rejects.toBeInstanceOf(
      UserRejectedError,
    );
  });

  it("should throw DeviceLockedError on locked scenario", async () => {
    const account = createMockLedgerAccount({ scenario: "device-locked" });

    await expect(account.signMessage({ message: "test" })).rejects.toBeInstanceOf(
      DeviceLockedError,
    );
  });

  it("should throw AppNotOpenError on app-not-open scenario", async () => {
    const account = createMockLedgerAccount({ scenario: "app-not-open" });

    await expect(account.signMessage({ message: "test" })).rejects.toBeInstanceOf(AppNotOpenError);
  });

  it("should throw DeviceNotFoundError on disconnected scenario", async () => {
    const account = createMockLedgerAccount({ scenario: "disconnected" });

    await expect(account.signMessage({ message: "test" })).rejects.toBeInstanceOf(
      DeviceNotFoundError,
    );
  });

  it("should use scenario overrides per operation", async () => {
    const account = createMockLedgerAccount({
      scenario: "success",
      scenarioOverrides: {
        signMessage: "user-rejected",
      },
    });

    // signMessage should fail
    await expect(account.signMessage({ message: "test" })).rejects.toBeInstanceOf(
      UserRejectedError,
    );
  });
});

describe("createMockLedgerDiscovery", () => {
  it("should discover default 5 accounts", () => {
    const accounts = createMockLedgerDiscovery();
    expect(accounts.length).toBe(5);
    expect(accounts[0].index).toBe(0);
    expect(accounts[4].index).toBe(4);
  });

  it("should discover custom count", () => {
    const accounts = createMockLedgerDiscovery({ count: 3 });
    expect(accounts.length).toBe(3);
  });

  it("should start from custom index", () => {
    const accounts = createMockLedgerDiscovery({ count: 2, startIndex: 5 });
    expect(accounts[0].index).toBe(5);
    expect(accounts[1].index).toBe(6);
    expect(accounts[0].path).toBe("m/44'/60'/0'/0/5");
  });

  it("should use Ledger Live style paths", () => {
    const accounts = createMockLedgerDiscovery({ count: 3, derivationStyle: "ledger-live" });
    expect(accounts[0].path).toBe("m/44'/60'/0'/0/0");
    expect(accounts[1].path).toBe("m/44'/60'/1'/0/0");
    expect(accounts[2].path).toBe("m/44'/60'/2'/0/0");
  });

  it("should return known addresses", () => {
    const accounts = createMockLedgerDiscovery({ count: 2 });
    expect(accounts[0].address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    expect(accounts[1].address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  });
});
