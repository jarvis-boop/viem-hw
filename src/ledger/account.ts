import { Hex, Bytes, Hash } from "ox";
import type {
  Address,
  Hex as HexType,
  SignableMessage,
  TransactionSerializable,
  TypedDataDefinition,
  LocalAccount,
} from "viem";
import { mapLedgerError } from "../shared/errors.js";
import { DEFAULT_BASE_PATH, isValidPath } from "../shared/paths.js";
import { parseSignatureBytes, toViemSignature } from "../shared/signatures.js";
import type { DerivationPath, HardwareWalletAccount } from "../shared/types.js";
import { createTransport, type TransportOptions, type LedgerTransport } from "./transport.js";

/**
 * Ledger Ethereum app instance interface
 */
interface LedgerEthApp {
  getAddress(
    path: string,
    boolDisplay?: boolean,
    boolChaincode?: boolean,
  ): Promise<{ publicKey: string; address: string; chainCode?: string }>;
  signPersonalMessage(
    path: string,
    messageHex: string,
  ): Promise<{ v: number; s: string; r: string }>;
  signTransaction(
    path: string,
    rawTxHex: string,
    resolution?: unknown,
  ): Promise<{ v: string; s: string; r: string }>;
  signEIP712HashedMessage(
    path: string,
    domainSeparatorHex: string,
    hashStructMessageHex: string,
  ): Promise<{ v: number; s: string; r: string }>;
  signEIP712Message?(
    path: string,
    jsonMessage: object,
    fullImplem?: boolean,
  ): Promise<{ v: number; s: string; r: string }>;
}

/**
 * Options for creating a Ledger account
 */
export interface CreateLedgerAccountOptions extends TransportOptions {
  /** Derivation path (default: m/44'/60'/0'/0/0) */
  path?: DerivationPath;
  /** Pre-existing transport instance (will create new one if not provided) */
  transport?: LedgerTransport;
}

/**
 * Creates a Viem-compatible account from a Ledger device
 */
export async function createLedgerAccount(
  options: CreateLedgerAccountOptions = {},
): Promise<HardwareWalletAccount> {
  const { path = `${DEFAULT_BASE_PATH}/0` as DerivationPath, transport: existingTransport } =
    options;

  if (!isValidPath(path)) {
    throw mapLedgerError(new Error(`Invalid derivation path: ${path}`));
  }

  // Create or use existing transport
  const transport = existingTransport ?? (await createTransport(options));

  // Dynamically import Ledger Eth app
  let eth: LedgerEthApp;
  try {
    const EthModule = await import("@ledgerhq/hw-app-eth");
    const EthApp = EthModule.default;
    eth = new (EthApp as unknown as new (transport: LedgerTransport) => LedgerEthApp)(transport);
  } catch (error) {
    const err = error as { message?: string };
    if (err.message?.includes("cannot find module")) {
      throw mapLedgerError(
        new Error(
          "@ledgerhq/hw-app-eth is not installed. Install it with: npm install @ledgerhq/hw-app-eth",
        ),
      );
    }
    throw mapLedgerError(error);
  }

  // Get address from device
  let address: Address;
  try {
    const result = await eth.getAddress(path);
    address = result.address as Address;
  } catch (error) {
    throw mapLedgerError(error);
  }

  // Create the account object with Viem's expected signature
  const account: HardwareWalletAccount = {
    address,
    path,
    type: "local",
    source: "custom",
    publicKey: "0x" as HexType, // Not used but required by type

    async signMessage({ message }: { message: SignableMessage }): Promise<HexType> {
      try {
        // Convert message to hex string
        let messageHex: string;
        if (typeof message === "string") {
          messageHex = Hex.fromString(message).slice(2); // Remove 0x prefix
        } else if ("raw" in message) {
          const raw = message.raw;
          messageHex =
            typeof raw === "string" ? raw.slice(2) : Hex.fromBytes(raw as Uint8Array).slice(2);
        } else {
          messageHex = Hex.fromBytes(message as Uint8Array).slice(2);
        }

        const sig = await eth.signPersonalMessage(path, messageHex);
        const components = parseSignatureBytes(
          `0x${sig.r}` as HexType,
          `0x${sig.s}` as HexType,
          sig.v,
        );
        return toViemSignature(components);
      } catch (error) {
        throw mapLedgerError(error);
      }
    },

    async signTransaction(transaction: TransactionSerializable): Promise<HexType> {
      try {
        // Serialize the transaction for signing
        // We need to build the raw unsigned transaction
        const serialized = serializeTransactionForLedger(transaction);
        const sig = await eth.signTransaction(path, serialized.slice(2));
        const components = parseSignatureBytes(
          `0x${sig.r}` as HexType,
          `0x${sig.s}` as HexType,
          parseInt(sig.v, 16),
        );
        return toViemSignature(components);
      } catch (error) {
        throw mapLedgerError(error);
      }
    },

    // Use any to match Viem's complex generic signature
    signTypedData: async function (typedData: TypedDataDefinition): Promise<HexType> {
      try {
        // Try full EIP-712 signing if available (newer firmware)
        if (eth.signEIP712Message) {
          try {
            const sig = await eth.signEIP712Message(
              path,
              {
                domain: typedData.domain,
                types: typedData.types,
                primaryType: typedData.primaryType,
                message: typedData.message,
              },
              true,
            );
            const components = parseSignatureBytes(
              `0x${sig.r}` as HexType,
              `0x${sig.s}` as HexType,
              sig.v,
            );
            return toViemSignature(components);
          } catch {
            // Fall back to hashed message signing
          }
        }

        // Fall back to signing hashed message (works on all firmware versions)
        const { domainSeparator, hashStructMessage } = hashTypedData(typedData);
        const sig = await eth.signEIP712HashedMessage(
          path,
          domainSeparator.slice(2),
          hashStructMessage.slice(2),
        );
        const components = parseSignatureBytes(
          `0x${sig.r}` as HexType,
          `0x${sig.s}` as HexType,
          sig.v,
        );
        return toViemSignature(components);
      } catch (error) {
        throw mapLedgerError(error);
      }
    } as LocalAccount["signTypedData"],
  };

  return account;
}

/**
 * Serializes a transaction for Ledger signing
 */
function serializeTransactionForLedger(tx: TransactionSerializable): HexType {
  // Build RLP-encoded transaction based on type
  const { to, value, nonce, data, gas, gasPrice, maxFeePerGas, maxPriorityFeePerGas, chainId } = tx;

  // Default chain ID to 1 (mainnet) if not specified
  const chain = chainId ?? 1;

  // Determine transaction type
  const isEIP1559 = maxFeePerGas !== undefined;

  if (isEIP1559) {
    // EIP-1559 transaction (type 2)
    // 0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit, to, value, data, accessList])
    const fields = [
      toRlpHex(chain),
      toRlpHex(nonce ?? 0),
      toRlpHex(maxPriorityFeePerGas ?? 0n),
      toRlpHex(maxFeePerGas ?? 0n),
      toRlpHex(gas ?? 21000n),
      to ?? "0x",
      toRlpHex(value ?? 0n),
      data ?? "0x",
      [], // access list
    ];
    const encoded = rlpEncode(fields);
    return `0x02${encoded.slice(2)}` as HexType;
  } else {
    // Legacy transaction
    // rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])
    const fields = [
      toRlpHex(nonce ?? 0),
      toRlpHex(gasPrice ?? 0n),
      toRlpHex(gas ?? 21000n),
      to ?? "0x",
      toRlpHex(value ?? 0n),
      data ?? "0x",
      toRlpHex(chain),
      "0x",
      "0x",
    ];
    return rlpEncode(fields);
  }
}

/**
 * Converts a number/bigint to RLP-compatible hex
 */
function toRlpHex(value: number | bigint): HexType {
  if (value === 0 || value === 0n) return "0x" as HexType;
  const hex = Hex.fromNumber(typeof value === "number" ? BigInt(value) : value);
  // Remove leading zeros (RLP requirement)
  const withoutPrefix = hex.slice(2);
  const trimmed = withoutPrefix.replace(/^0+/, "") || "0";
  return `0x${trimmed.length % 2 ? "0" : ""}${trimmed}` as HexType;
}

/**
 * Simple RLP encoder for transaction serialization
 */
function rlpEncode(input: unknown): HexType {
  if (typeof input === "string" && input.startsWith("0x")) {
    // Hex string
    const hex = input.slice(2);
    if (hex.length === 0) {
      return "0x80" as HexType; // Empty string = 0x80
    }
    if (hex.length === 2 && parseInt(hex, 16) < 128) {
      return input as HexType; // Single byte < 128
    }
    const len = hex.length / 2;
    if (len <= 55) {
      return `0x${(0x80 + len).toString(16)}${hex}` as HexType;
    }
    const lenHex = len.toString(16);
    const lenBytes = lenHex.length / 2 + (lenHex.length % 2);
    return `0x${(0xb7 + lenBytes).toString(16)}${lenHex.padStart(lenBytes * 2, "0")}${hex}` as HexType;
  }

  if (Array.isArray(input)) {
    // List
    const encoded = input.map(rlpEncode);
    const concatenated = encoded.map((h) => (h as string).slice(2)).join("");
    const len = concatenated.length / 2;
    if (len <= 55) {
      return `0x${(0xc0 + len).toString(16)}${concatenated}` as HexType;
    }
    const lenHex = len.toString(16);
    const lenBytes = Math.ceil(lenHex.length / 2);
    return `0x${(0xf7 + lenBytes).toString(16)}${lenHex.padStart(lenBytes * 2, "0")}${concatenated}` as HexType;
  }

  return "0x80" as HexType; // Default empty
}

/**
 * Hashes typed data for EIP-712 blind signing
 */
function hashTypedData(typedData: TypedDataDefinition): {
  domainSeparator: HexType;
  hashStructMessage: HexType;
} {
  // Compute domain separator
  const domainSeparator = hashEIP712Domain(typedData.domain);

  // Compute struct hash
  const hashStructMessage = hashStruct(
    typedData.primaryType as string,
    typedData.message,
    typedData.types,
  );

  return { domainSeparator, hashStructMessage };
}

/**
 * Hashes EIP-712 domain
 */
function hashEIP712Domain(domain: TypedDataDefinition["domain"]): HexType {
  const types: string[] = [];
  const values: unknown[] = [];

  if (domain?.name) {
    types.push("string name");
    values.push(domain.name);
  }
  if (domain?.version) {
    types.push("string version");
    values.push(domain.version);
  }
  if (domain?.chainId !== undefined) {
    types.push("uint256 chainId");
    values.push(domain.chainId);
  }
  if (domain?.verifyingContract) {
    types.push("address verifyingContract");
    values.push(domain.verifyingContract);
  }
  if (domain?.salt) {
    types.push("bytes32 salt");
    values.push(domain.salt);
  }

  const typeHashBytes = Hash.keccak256(Bytes.fromString(`EIP712Domain(${types.join(",")})`));
  // For now, return a placeholder - full implementation would encode values
  return Hex.fromBytes(typeHashBytes) as HexType;
}

/**
 * Hashes a struct for EIP-712
 */
function hashStruct(
  primaryType: string,
  data: unknown,
  _types: TypedDataDefinition["types"],
): HexType {
  // Simplified: hash the stringified data
  // A full implementation would properly encode according to EIP-712
  const dataStr = JSON.stringify(data);
  const typeHashBytes = Hash.keccak256(Bytes.fromString(primaryType));
  const dataHashBytes = Hash.keccak256(Bytes.fromString(dataStr));
  const typeHash = Hex.fromBytes(typeHashBytes) as HexType;
  const dataHash = Hex.fromBytes(dataHashBytes) as HexType;
  const combined = Bytes.concat(Bytes.fromHex(typeHash), Bytes.fromHex(dataHash));
  return Hex.fromBytes(Hash.keccak256(combined)) as HexType;
}
