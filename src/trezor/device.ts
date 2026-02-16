import type { Address } from "viem";
import { mapTrezorError, AppNotOpenError } from "../shared/errors.js";
import { isValidPath, DEFAULT_BASE_PATH } from "../shared/paths.js";
import type { DerivationPath } from "../shared/types.js";
import { getTrezorConnect, type TrezorConnectOptions } from "./connect.js";

/**
 * Trezor device information
 */
export interface TrezorDeviceInfo {
  /** Device model (e.g., 'T', '1', 'R') */
  model?: string;
  /** Firmware version */
  firmwareVersion?: string;
  /** Device label (user-defined) */
  label?: string;
  /** Device ID */
  deviceId?: string;
  /** Whether the device is connected */
  connected: boolean;
}

/**
 * Trezor features/capabilities
 */
export interface TrezorFeatures {
  /** Whether EIP-712 is supported */
  supportsEIP712: boolean;
  /** Whether passphrase is enabled */
  passphraseEnabled: boolean;
  /** Whether PIN is enabled */
  pinEnabled: boolean;
  /** Firmware version */
  firmwareVersion: string;
  /** Device model */
  model: string;
}

/**
 * Connection state
 */
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

/**
 * Connection state change listener
 */
export type ConnectionStateListener = (state: ConnectionState, error?: Error) => void;

/**
 * Trezor device manager for connection state and device operations
 */
export interface TrezorDeviceManager {
  /** Current connection state */
  readonly state: ConnectionState;
  /** Connect to device */
  connect(): Promise<void>;
  /** Disconnect from device */
  disconnect(): Promise<void>;
  /** Check if device is connected */
  isConnected(): boolean;
  /** Get device information */
  getDeviceInfo(): Promise<TrezorDeviceInfo>;
  /** Get device features/capabilities */
  getFeatures(): Promise<TrezorFeatures>;
  /** Verify address on device (displays for user confirmation) */
  verifyAddress(path?: DerivationPath): Promise<{ address: Address; verified: boolean }>;
  /** Add connection state listener */
  onStateChange(listener: ConnectionStateListener): () => void;
}

/**
 * Options for creating a device manager
 */
export interface CreateTrezorDeviceManagerOptions extends TrezorConnectOptions {
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
}

/**
 * Creates a Trezor device manager for connection state management
 */
export function createTrezorDeviceManager(
  options: CreateTrezorDeviceManagerOptions = {},
): TrezorDeviceManager {
  const { autoReconnect: _autoReconnect = false, ...connectOptions } = options;

  let state: ConnectionState = "disconnected";
  let deviceFeatures: TrezorFeatures | null = null;
  const listeners = new Set<ConnectionStateListener>();

  function setState(newState: ConnectionState, error?: Error) {
    state = newState;
    listeners.forEach((listener) => listener(newState, error));
  }

  async function connect(): Promise<void> {
    if (state === "connected") return;

    setState("connecting");

    try {
      await getTrezorConnect(connectOptions);

      // Test connection by getting features
      const TrezorConnect = await loadTrezorConnect();
      const result = await TrezorConnect.getFeatures();

      if (!result.success) {
        throw result.payload;
      }

      const features = result.payload;
      deviceFeatures = {
        supportsEIP712: parseInt(features.major_version?.toString() || "0") >= 2,
        passphraseEnabled: features.passphrase_protection || false,
        pinEnabled: features.pin_protection || false,
        firmwareVersion: `${features.major_version}.${features.minor_version}.${features.patch_version}`,
        model: features.model || "unknown",
      };

      setState("connected");
    } catch (error) {
      deviceFeatures = null;
      setState("error", error as Error);
      throw mapTrezorError(error);
    }
  }

  async function disconnect(): Promise<void> {
    try {
      const TrezorConnect = await loadTrezorConnect();
      TrezorConnect.dispose();
    } catch {
      // Ignore dispose errors
    }
    deviceFeatures = null;
    setState("disconnected");
  }

  function isConnected(): boolean {
    return state === "connected";
  }

  async function getDeviceInfo(): Promise<TrezorDeviceInfo> {
    if (state !== "connected") {
      return { connected: false };
    }

    try {
      const TrezorConnect = await loadTrezorConnect();
      const result = await TrezorConnect.getFeatures();

      if (!result.success) {
        return { connected: isConnected() };
      }

      const features = result.payload;
      return {
        model: features.model,
        firmwareVersion: `${features.major_version}.${features.minor_version}.${features.patch_version}`,
        label: features.label || undefined,
        deviceId: features.device_id || undefined,
        connected: true,
      };
    } catch {
      return { connected: isConnected() };
    }
  }

  async function getFeatures(): Promise<TrezorFeatures> {
    if (!deviceFeatures) {
      await connect();
    }

    if (!deviceFeatures) {
      throw new AppNotOpenError("trezor");
    }

    return deviceFeatures;
  }

  async function verifyAddress(
    path: DerivationPath = DEFAULT_BASE_PATH,
  ): Promise<{ address: Address; verified: boolean }> {
    if (state !== "connected") {
      await connect();
    }

    if (!isValidPath(path)) {
      throw new Error(`Invalid derivation path: ${path}`);
    }

    try {
      const TrezorConnect = await loadTrezorConnect();
      const result = await TrezorConnect.ethereumGetAddress({
        path,
        showOnTrezor: true, // Display on device for verification
      });

      if (!result.success) {
        throw result.payload;
      }

      return {
        address: result.payload.address as Address,
        verified: true,
      };
    } catch (error) {
      throw mapTrezorError(error);
    }
  }

  function onStateChange(listener: ConnectionStateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    get state() {
      return state;
    },
    connect,
    disconnect,
    isConnected,
    getDeviceInfo,
    getFeatures,
    verifyAddress,
    onStateChange,
  };
}

// Internal helpers

interface TrezorConnectType {
  getFeatures(): Promise<{ success: boolean; payload: any }>;
  ethereumGetAddress(params: {
    path: string;
    showOnTrezor?: boolean;
  }): Promise<{ success: boolean; payload: any }>;
  dispose(): void;
}

async function loadTrezorConnect(): Promise<TrezorConnectType> {
  return getTrezorConnect() as unknown as TrezorConnectType;
}
