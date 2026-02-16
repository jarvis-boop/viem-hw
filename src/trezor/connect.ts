import { mapTrezorError, TransportError } from "../shared/errors.js";

/**
 * Trezor Connect instance interface (minimal subset we need)
 */
export interface TrezorConnect {
  init(settings: TrezorInitSettings): Promise<void>;
  getAddress(params: TrezorAddressParams): Promise<TrezorResponse<TrezorAddress>>;
  ethereumGetAddress(params: TrezorAddressParams): Promise<TrezorResponse<TrezorAddress>>;
  ethereumSignMessage(
    params: TrezorSignMessageParams,
  ): Promise<TrezorResponse<TrezorMessageSignature>>;
  ethereumSignTransaction(
    params: TrezorSignTransactionParams,
  ): Promise<TrezorResponse<TrezorTransactionSignature>>;
  ethereumSignTypedData(
    params: TrezorSignTypedDataParams,
  ): Promise<TrezorResponse<TrezorTypedDataSignature>>;
  dispose(): Promise<void>;
}

export interface TrezorInitSettings {
  manifest: {
    email: string;
    appUrl: string;
  };
  lazyLoad?: boolean;
  debug?: boolean;
}

export interface TrezorAddressParams {
  path: string;
  showOnTrezor?: boolean;
}

export interface TrezorSignMessageParams {
  path: string;
  message: string;
  hex?: boolean;
}

export interface TrezorSignTransactionParams {
  path: string;
  transaction: TrezorEthereumTransaction;
}

export interface TrezorEthereumTransaction {
  to: string;
  value: string;
  gasPrice?: string;
  gasLimit: string;
  nonce: string;
  data?: string;
  chainId: number;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface TrezorSignTypedDataParams {
  path: string;
  data: TrezorTypedData;
  metamask_v4_compat: boolean;
}

export interface TrezorTypedData {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
}

export interface TrezorResponse<T> {
  success: boolean;
  payload: T | TrezorError;
}

export interface TrezorError {
  error: string;
  code?: string;
}

export interface TrezorAddress {
  address: string;
  path: number[];
  serializedPath: string;
}

export interface TrezorMessageSignature {
  address: string;
  signature: string;
}

export interface TrezorTransactionSignature {
  v: string;
  r: string;
  s: string;
}

export interface TrezorTypedDataSignature {
  address: string;
  signature: string;
}

/**
 * Options for Trezor initialization
 */
export interface TrezorConnectOptions {
  /** Email for Trezor manifest (required by Trezor) */
  email?: string;
  /** App URL for Trezor manifest */
  appUrl?: string;
  /** Enable debug mode */
  debug?: boolean;
}

let trezorConnectInstance: TrezorConnect | null = null;
let isInitialized = false;

/**
 * Gets or initializes the Trezor Connect instance
 */
export async function getTrezorConnect(options: TrezorConnectOptions = {}): Promise<TrezorConnect> {
  if (trezorConnectInstance && isInitialized) {
    return trezorConnectInstance;
  }

  try {
    // Dynamic import to avoid bundling if not used
    const TrezorConnectModule = await import("@trezor/connect");
    const TrezorConnect = TrezorConnectModule.default as unknown as TrezorConnect;

    await TrezorConnect.init({
      manifest: {
        email: options.email ?? "developer@example.com",
        appUrl: options.appUrl ?? "https://example.com",
      },
      lazyLoad: true,
      debug: options.debug ?? false,
    });

    trezorConnectInstance = TrezorConnect;
    isInitialized = true;
    return TrezorConnect;
  } catch (error) {
    const err = error as { message?: string };
    if (err.message?.includes("cannot find module")) {
      throw new TransportError(
        "@trezor/connect is not installed. Install it with: npm install @trezor/connect",
      );
    }
    throw mapTrezorError(error);
  }
}

/**
 * Checks if a Trezor response is successful and extracts the payload
 */
export function unwrapTrezorResponse<T>(response: TrezorResponse<T>): T {
  if (!response.success) {
    const error = response.payload as TrezorError;
    throw mapTrezorError({ message: error.error, code: error.code });
  }
  return response.payload as T;
}

/**
 * Disposes of the Trezor Connect instance
 */
export async function disposeTrezorConnect(): Promise<void> {
  if (trezorConnectInstance) {
    await trezorConnectInstance.dispose();
    trezorConnectInstance = null;
    isInitialized = false;
  }
}
