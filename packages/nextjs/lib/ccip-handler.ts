import { signGatewayResponse } from "./ccip-signer";
import { COIN_TYPE_BASE_SEPOLIA, COIN_TYPE_ETH } from "./coin-types";
import { cacheGet, cacheSet } from "./rpc-cache";
import {
  type Hex,
  createPublicClient,
  decodeAbiParameters,
  decodeFunctionData,
  encodeAbiParameters,
  http,
  parseAbi,
} from "viem";
import { baseSepolia } from "viem/chains";

/// ENS resolver function ABIs the gateway can answer.
const RESOLVER_FUNCTIONS = parseAbi([
  "function addr(bytes32 node) view returns (address)",
  "function addr(bytes32 node, uint256 coinType) view returns (bytes)",
  "function text(bytes32 node, string key) view returns (string)",
  "function contenthash(bytes32 node) view returns (bytes)",
]);

/// ObecRegistry surface used by the gateway.
const REGISTRY_ABI = parseAbi([
  "function members(bytes32 node) view returns (address wallet, bytes32 neighborhoodId, string label, uint64 joinedAt, bool active)",
  "function resources(bytes32 node) view returns (bytes32 neighborhoodId, string label, string resourceType, address fundedBy, bool active)",
  "function neighborhoods(bytes32 node) view returns (string city, string name, address admin, bool active)",
  "function getText(bytes32 node, string key) view returns (string)",
  "function getContenthash(bytes32 node) view returns (bytes)",
]);

export type HandlerConfig = {
  privateKey: Hex;
  resolverAddress: `0x${string}`;
  registryAddress: `0x${string}`;
  baseSepoliaRpcUrl: string;
  ttlSeconds?: number;
};

export type HandlerResult = { data: Hex } | { error: string; status: number };

/// Decodes the EIP-3668 callData (which the resolver encoded as `abi.encode(name, data)`)
/// and returns a signed response payload the resolver's `resolveWithProof` can verify.
export async function handleCcipRequest(config: HandlerConfig, callDataHex: Hex): Promise<HandlerResult> {
  const ttl = BigInt(config.ttlSeconds ?? 60);
  let dnsName: Hex;
  let resolverCall: Hex;
  try {
    [dnsName, resolverCall] = decodeAbiParameters([{ type: "bytes" }, { type: "bytes" }], callDataHex) as [Hex, Hex];
  } catch (e) {
    return { error: `bad callData: ${(e as Error).message}`, status: 400 };
  }

  // Cache by resolverCall (function + args). Result is independent of dnsName/sender;
  // signature is recomputed each request with a fresh expiry.
  const cacheKey = resolverCall.toLowerCase();
  let resultBytes: Hex;
  const cached = cacheGet(cacheKey);
  if (cached) {
    resultBytes = cached as Hex;
  } else {
    try {
      resultBytes = await resolveOne(config, resolverCall);
    } catch (e) {
      return { error: `resolve failed: ${(e as Error).message}`, status: 502 };
    }
    cacheSet(cacheKey, resultBytes);
  }

  // Sign + encode response: (bytes result, uint64 expiry, bytes signature)
  const expiry = BigInt(Math.floor(Date.now() / 1000)) + ttl;
  const sig = await signGatewayResponse({
    privateKey: config.privateKey,
    resolverAddress: config.resolverAddress,
    expiry,
    extraData: callDataHex,
    result: resultBytes,
  });

  const payload = encodeAbiParameters(
    [{ type: "bytes" }, { type: "uint64" }, { type: "bytes" }],
    [resultBytes, expiry, sig],
  );

  // Suppress unused warning until we surface dnsName in logs/cache keys.
  void dnsName;

  return { data: payload };
}

async function resolveOne(config: HandlerConfig, resolverCall: Hex): Promise<Hex> {
  const decoded = decodeFunctionData({ abi: RESOLVER_FUNCTIONS, data: resolverCall });

  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(config.baseSepoliaRpcUrl),
  });

  switch (decoded.functionName) {
    case "addr": {
      const node = decoded.args[0] as Hex;
      // Two function signatures share the "addr" name:
      //   - addr(bytes32) → returns address (legacy, ETH only)
      //   - addr(bytes32, uint256 coinType) → returns bytes (ENSIP-9 multi-coin)
      // viem's decoder collapses both into functionName "addr"; distinguish by args.length
      // so we honor the strict ENSIP-9 return type per docs.ens.domains/ensip/9.
      const isLegacy = decoded.args.length === 1;

      // Look up member first; fall back to resource (proposals are also resources with type "proposal").
      const member = await client.readContract({
        address: config.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "members",
        args: [node],
      });
      const memberWallet = member[0] as `0x${string}`;
      const memberActive = member[4] as boolean;

      let target: `0x${string}` = "0x0000000000000000000000000000000000000000";
      if (memberActive && memberWallet !== "0x0000000000000000000000000000000000000000") {
        target = memberWallet;
      } else {
        const resource = await client.readContract({
          address: config.registryAddress,
          abi: REGISTRY_ABI,
          functionName: "resources",
          args: [node],
        });
        const fundedBy = resource[3] as `0x${string}`;
        const active = resource[4] as boolean;
        if (active && fundedBy !== "0x0000000000000000000000000000000000000000") {
          target = fundedBy;
        }
      }

      if (isLegacy) {
        // addr(bytes32) — strict legacy, returns address.
        return encodeAbiParameters([{ type: "address" }], [target]);
      }

      // ENSIP-9 addr(bytes32, uint256 coinType) — returns bytes (raw chain-specific address).
      const coinType = decoded.args[1] as bigint;
      if (coinType === COIN_TYPE_ETH || coinType === COIN_TYPE_BASE_SEPOLIA) {
        return encodeAbiParameters([{ type: "bytes" }], [target]);
      }
      // Unsupported coin types: return empty bytes per ENSIP-9 ("address not set").
      return encodeAbiParameters([{ type: "bytes" }], ["0x" as Hex]);
    }

    case "text": {
      const node = decoded.args[0] as Hex;
      const key = decoded.args[1] as string;
      const value = await client.readContract({
        address: config.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "getText",
        args: [node, key],
      });
      return encodeAbiParameters([{ type: "string" }], [value]);
    }

    case "contenthash": {
      const node = decoded.args[0] as Hex;
      const value = await client.readContract({
        address: config.registryAddress,
        abi: REGISTRY_ABI,
        functionName: "getContenthash",
        args: [node],
      });
      return encodeAbiParameters([{ type: "bytes" }], [value]);
    }

    default:
      throw new Error(`unsupported resolver function selector`);
  }
}
