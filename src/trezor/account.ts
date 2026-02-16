import { Hex, Bytes } from "ox";
import type {
  Address,
  Hex as HexType,
  SignableMessage,
  TransactionSerializable,
  TypedDataDefinition,
  LocalAccount,
} from "viem";
import { mapTrezorError } from "../shared/errors.js";
import { DEFAULT_BASE_PATH, isValidPath } from "../shared/paths.js";
import { parseSignatureBytes, toViemSignature } from "../shared/signatures.js";
import type { DerivationPath, HardwareWalletAccount } from "../shared/types.js";
import {
  getTrezorConnect,
  unwrapTrezorResponse,
  type TrezorConnectOptions,
  type TrezorEthereumTransaction,
} from "./connect.js";

/**
 * Options for creating a Trezor account
 */
export interface CreateTrezorAccountOptions extends TrezorConnectOptions {
  /** Derivation path (default: m/44'/60'/0'/0/0) */
  path?: DerivationPath;
}

/**
 * Creates a Viem-compatible account from a Trezor device
 */
export async function createTrezorAccount(
  options: CreateTrezorAccountOptions = {},
): Promise<HardwareWalletAccount> {
  const { path = `${DEFAULT_BASE_PATH}/0` as DerivationPath, ...connectOptions } = options;

  if (!isValidPath(path)) {
    throw mapTrezorError(new Error(`Invalid derivation path: ${path}`));
  }

  // Get Trezor Connect instance
  const trezor = await getTrezorConnect(connectOptions);

  // Get address from device
  let address: Address;
  try {
    const response = await trezor.ethereumGetAddress({
      path,
      showOnTrezor: false,
    });
    const result = unwrapTrezorResponse(response);
    address = result.address as Address;
  } catch (error) {
    throw mapTrezorError(error);
  }

  // Create the account object
  const account: HardwareWalletAccount = {
    address,
    path,
    type: "local",
    source: "custom",
    publicKey: "0x" as HexType, // Not used but required by type

    async signMessage({ message }: { message: SignableMessage }): Promise<HexType> {
      try {
        let messageStr: string;
        let isHex = false;

        if (typeof message === "string") {
          messageStr = message;
        } else if ("raw" in message) {
          const raw = message.raw;
          if (typeof raw === "string") {
            messageStr = raw;
            isHex = true;
          } else {
            messageStr = Hex.fromBytes(raw as Uint8Array);
            isHex = true;
          }
        } else {
          messageStr = Hex.fromBytes(message as Uint8Array);
          isHex = true;
        }

        const response = await trezor.ethereumSignMessage({
          path,
          message: isHex ? messageStr.slice(2) : messageStr,
          hex: isHex,
        });

        const result = unwrapTrezorResponse(response);

        // Trezor returns signature as hex string
        const sigHex = result.signature.startsWith("0x")
          ? result.signature
          : `0x${result.signature}`;

        // Parse the signature (65 bytes: r(32) + s(32) + v(1))
        const sigBytes = Bytes.fromHex(sigHex as HexType);
        const r = Hex.fromBytes(sigBytes.slice(0, 32)) as HexType;
        const s = Hex.fromBytes(sigBytes.slice(32, 64)) as HexType;
        const v = sigBytes[64];

        const components = parseSignatureBytes(r, s, v ?? 0);
        return toViemSignature(components);
      } catch (error) {
        throw mapTrezorError(error);
      }
    },

    async signTransaction(transaction: TransactionSerializable): Promise<HexType> {
      try {
        const trezorTx = formatTransactionForTrezor(transaction);

        const response = await trezor.ethereumSignTransaction({
          path,
          transaction: trezorTx,
        });

        const result = unwrapTrezorResponse(response);
        const components = parseSignatureBytes(
          `0x${result.r}` as HexType,
          `0x${result.s}` as HexType,
          parseInt(result.v, 16),
        );
        return toViemSignature(components);
      } catch (error) {
        throw mapTrezorError(error);
      }
    },

    // Use function cast to match Viem's complex generic signature
    signTypedData: async function (typedData: TypedDataDefinition): Promise<HexType> {
      try {
        const response = await trezor.ethereumSignTypedData({
          path,
          data: {
            types: typedData.types as unknown as Record<
              string,
              Array<{ name: string; type: string }>
            >,
            primaryType: typedData.primaryType as string,
            domain: typedData.domain as Record<string, unknown>,
            message: typedData.message as Record<string, unknown>,
          },
          metamask_v4_compat: true,
        });

        const result = unwrapTrezorResponse(response);

        // Parse signature
        const sigHex = result.signature.startsWith("0x")
          ? result.signature
          : `0x${result.signature}`;

        const sigBytes = Bytes.fromHex(sigHex as HexType);
        const r = Hex.fromBytes(sigBytes.slice(0, 32)) as HexType;
        const s = Hex.fromBytes(sigBytes.slice(32, 64)) as HexType;
        const v = sigBytes[64];

        const components = parseSignatureBytes(r, s, v ?? 0);
        return toViemSignature(components);
      } catch (error) {
        throw mapTrezorError(error);
      }
    } as LocalAccount["signTypedData"],
  };

  return account;
}

/**
 * Formats a Viem transaction for Trezor
 */
function formatTransactionForTrezor(tx: TransactionSerializable): TrezorEthereumTransaction {
  const { to, value, nonce, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, chainId } = tx;

  const chain = chainId ?? 1;

  const base: TrezorEthereumTransaction = {
    to: to ?? "",
    value: toHexString(value ?? 0n),
    gasLimit: toHexString(gas ?? 21000n),
    nonce: toHexString(nonce ?? 0),
    data: data ?? "0x",
    chainId: chain,
  };

  // EIP-1559 transaction
  if (maxFeePerGas !== undefined) {
    return {
      ...base,
      maxFeePerGas: toHexString(maxFeePerGas),
      maxPriorityFeePerGas: toHexString(maxPriorityFeePerGas ?? 0n),
    };
  }

  // Legacy transaction
  return {
    ...base,
    gasPrice: toHexString(gasPrice ?? 0n),
  };
}

/**
 * Converts a value to hex string format
 */
function toHexString(value: number | bigint): string {
  const bigValue = typeof value === "number" ? BigInt(value) : value;
  return Hex.fromNumber(bigValue);
}
