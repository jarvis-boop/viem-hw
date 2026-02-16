import { useState, useCallback } from "react";

// Import from local viem-hw (linked via workspace)
import {
  HardwareWalletError,
  UserRejectedError,
  DeviceLockedError,
  AppNotOpenError,
  DeviceNotFoundError,
} from "../../src/index.js";
import {
  createLedgerAccount,
  discoverLedgerAccounts,
  createLedgerDeviceManager,
  type LedgerDeviceInfo,
  type LedgerAppConfig,
} from "../../src/ledger/index.js";
import { createTrezorAccount, discoverTrezorAccounts } from "../../src/trezor/index.js";
import type { DiscoveredAccount, HardwareWalletAccount } from "../../src/shared/types.js";

type Vendor = "ledger" | "trezor" | null;
type Status = "idle" | "connecting" | "discovering" | "signing" | "verifying";

interface Log {
  id: number;
  type: "info" | "success" | "error";
  message: string;
  time: Date;
}

function App() {
  const [vendor, setVendor] = useState<Vendor>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<HardwareWalletAccount | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<LedgerDeviceInfo | null>(null);
  const [_appConfig, setAppConfig] = useState<LedgerAppConfig | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [messageToSign, setMessageToSign] = useState("Hello from viem-hw!");
  const [lastSignature, setLastSignature] = useState<string | null>(null);

  const log = useCallback((type: Log["type"], message: string) => {
    setLogs((prev) => [...prev, { id: Date.now(), type, message, time: new Date() }]);
  }, []);

  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof UserRejectedError) {
        log("error", "❌ User rejected on device");
      } else if (error instanceof DeviceLockedError) {
        log("error", "🔒 Device is locked - please unlock");
      } else if (error instanceof AppNotOpenError) {
        log("error", "📱 Please open the Ethereum app on your device");
      } else if (error instanceof DeviceNotFoundError) {
        log("error", "🔌 Device not found - please connect");
      } else if (error instanceof HardwareWalletError) {
        log("error", `⚠️ ${error.message}`);
      } else {
        log("error", `❌ ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    [log],
  );

  const connectLedger = async () => {
    setVendor("ledger");
    setStatus("connecting");
    log("info", "🔌 Connecting to Ledger...");

    try {
      const manager = createLedgerDeviceManager();
      await manager.connect();

      const info = await manager.getDeviceInfo();
      setDeviceInfo(info);
      log(
        "success",
        `✅ Connected: ${info.model || "Ledger"} (FW: ${info.firmwareVersion || "unknown"})`,
      );

      try {
        const config = await manager.getAppConfig();
        setAppConfig(config);
        log(
          "info",
          `📱 Ethereum app v${config.version} (EIP-712: ${config.supportsEIP712 ? "yes" : "no"})`,
        );
      } catch {
        log("info", "📱 Open Ethereum app to see app info");
      }

      setStatus("discovering");
      log("info", "🔍 Discovering accounts...");

      const discovered = await discoverLedgerAccounts({ count: 5 });
      setAccounts(discovered);
      log("success", `✅ Found ${discovered.length} accounts`);

      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const connectTrezor = async () => {
    setVendor("trezor");
    setStatus("connecting");
    log("info", "🔌 Connecting to Trezor...");

    try {
      setStatus("discovering");
      log("info", "🔍 Discovering accounts...");

      const discovered = await discoverTrezorAccounts({
        count: 5,
        email: "test@viem-hw.dev",
        appUrl: "https://viem-hw.dev",
      });
      setAccounts(discovered);
      log("success", `✅ Found ${discovered.length} accounts`);

      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const selectAccount = async (account: DiscoveredAccount) => {
    setStatus("connecting");
    log("info", `📍 Selecting account ${account.address.slice(0, 10)}...`);

    try {
      let hwAccount: HardwareWalletAccount;

      if (vendor === "ledger") {
        hwAccount = await createLedgerAccount({ path: account.path });
      } else {
        hwAccount = await createTrezorAccount({
          path: account.path,
          email: "test@viem-hw.dev",
          appUrl: "https://viem-hw.dev",
        });
      }

      setSelectedAccount(hwAccount);
      log("success", `✅ Account ready: ${hwAccount.address}`);
      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const signMessage = async () => {
    if (!selectedAccount) return;

    setStatus("signing");
    log("info", `✍️ Signing message: "${messageToSign}"`);
    log("info", "👀 Please confirm on your device...");

    try {
      const signature = await selectedAccount.signMessage({ message: messageToSign });
      setLastSignature(signature);
      log("success", `✅ Signature: ${signature.slice(0, 20)}...`);
      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const signTypedData = async () => {
    if (!selectedAccount) return;

    setStatus("signing");
    log("info", "✍️ Signing EIP-712 typed data...");
    log("info", "👀 Please confirm on your device...");

    const typedData = {
      domain: {
        name: "viem-hw Test",
        version: "1",
        chainId: 1,
      },
      types: {
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
        Mail: [
          { name: "from", type: "Person" },
          { name: "to", type: "Person" },
          { name: "contents", type: "string" },
        ],
      },
      primaryType: "Mail" as const,
      message: {
        from: { name: "Alice", wallet: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826" },
        to: { name: "Bob", wallet: "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB" },
        contents: "Hello, Bob!",
      },
    };

    try {
      const signature = await selectedAccount.signTypedData(typedData);
      setLastSignature(signature);
      log("success", `✅ EIP-712 Signature: ${signature.slice(0, 20)}...`);
      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const verifyAddress = async () => {
    if (!selectedAccount || vendor !== "ledger") return;

    setStatus("verifying");
    log("info", "🔍 Verifying address on device...");
    log("info", "👀 Please confirm the address matches on your device...");

    try {
      const manager = createLedgerDeviceManager();
      await manager.connect();
      const { address, verified } = await manager.verifyAddress(
        accounts.find((a) => a.address === selectedAccount.address)?.path,
      );

      if (verified) {
        log("success", `✅ Address verified: ${address}`);
      }
      setStatus("idle");
    } catch (error) {
      handleError(error);
      setStatus("idle");
    }
  };

  const reset = () => {
    setVendor(null);
    setAccounts([]);
    setSelectedAccount(null);
    setDeviceInfo(null);
    setAppConfig(null);
    setLastSignature(null);
    setStatus("idle");
    log("info", "🔄 Reset");
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2">viem-hw Test App</h1>
          <p className="text-[var(--muted)]">Test hardware wallet integration with real devices</p>
        </header>

        {/* Vendor Selection */}
        {!vendor && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold mb-4">Select Device</h2>
            <div className="flex gap-4">
              <button onClick={connectLedger} className="btn btn-primary flex-1 py-4">
                🔵 Connect Ledger
              </button>
              <button onClick={connectTrezor} className="btn btn-primary flex-1 py-4">
                ⚫ Connect Trezor
              </button>
            </div>
          </div>
        )}

        {/* Device Info */}
        {vendor && (
          <div className="card mb-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {vendor === "ledger" ? "🔵 Ledger" : "⚫ Trezor"}
                </h2>
                {deviceInfo && (
                  <p className="text-sm text-[var(--muted)]">
                    {deviceInfo.model} • FW {deviceInfo.firmwareVersion}
                  </p>
                )}
              </div>
              <button onClick={reset} className="btn btn-secondary text-sm">
                Disconnect
              </button>
            </div>

            {/* Account Selection */}
            {accounts.length > 0 && !selectedAccount && (
              <div>
                <h3 className="font-medium mb-3">Select Account</h3>
                <div className="space-y-2">
                  {accounts.map((acc) => (
                    <button
                      key={acc.path}
                      onClick={() => selectAccount(acc)}
                      disabled={status !== "idle"}
                      className="w-full text-left p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
                    >
                      <div className="font-mono text-sm">{acc.address}</div>
                      <div className="text-xs text-[var(--muted)]">{acc.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected Account Actions */}
            {selectedAccount && (
              <div>
                <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--success)] mb-4">
                  <div className="text-sm text-[var(--success)] mb-1">Active Account</div>
                  <div className="font-mono text-sm break-all">{selectedAccount.address}</div>
                </div>

                <div className="space-y-4">
                  {/* Sign Message */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Sign Message</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={messageToSign}
                        onChange={(e) => setMessageToSign(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
                        placeholder="Message to sign"
                      />
                      <button
                        onClick={signMessage}
                        disabled={status !== "idle"}
                        className="btn btn-primary"
                      >
                        {status === "signing" ? "⏳" : "✍️"} Sign
                      </button>
                    </div>
                  </div>

                  {/* Other Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={signTypedData}
                      disabled={status !== "idle"}
                      className="btn btn-secondary"
                    >
                      📝 Sign EIP-712
                    </button>
                    {vendor === "ledger" && (
                      <button
                        onClick={verifyAddress}
                        disabled={status !== "idle"}
                        className="btn btn-secondary"
                      >
                        🔍 Verify Address
                      </button>
                    )}
                  </div>

                  {/* Last Signature */}
                  {lastSignature && (
                    <div className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                      <div className="text-sm text-[var(--muted)] mb-1">Last Signature</div>
                      <div className="font-mono text-xs break-all">{lastSignature}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Status */}
        {status !== "idle" && (
          <div className="card mb-6 bg-[var(--accent)]/10 border-[var(--accent)]/30">
            <div className="flex items-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
              <span>
                {status === "connecting" && "Connecting to device..."}
                {status === "discovering" && "Discovering accounts..."}
                {status === "signing" && "Waiting for device confirmation..."}
                {status === "verifying" && "Verify address on device..."}
              </span>
            </div>
          </div>
        )}

        {/* Logs */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="text-sm text-[var(--muted)] hover:text-[var(--fg)]"
            >
              Clear
            </button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <p className="text-[var(--muted)]">Connect a device to get started</p>
            ) : (
              logs.map((l) => (
                <div
                  key={l.id}
                  className={`${
                    l.type === "error"
                      ? "text-[var(--error)]"
                      : l.type === "success"
                        ? "text-[var(--success)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  <span className="opacity-50">{l.time.toLocaleTimeString()}</span> {l.message}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 text-sm text-[var(--muted)]">
          <h3 className="font-medium text-[var(--fg)] mb-2">Instructions</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Connect your Ledger or Trezor device via USB</li>
            <li>For Ledger: Open the Ethereum app on your device</li>
            <li>For Trezor: A popup will appear for confirmation</li>
            <li>WebHID requires Chrome/Edge and HTTPS (or localhost)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
