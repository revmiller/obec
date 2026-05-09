import { type Hex } from "viem";
import { handleCcipRequest } from "~~/lib/ccip-handler";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ sender: string; callData: string }> }) {
  // Lazy-loaded per-request so cold-started Vercel functions read the latest env.
  const privateKey = process.env.GATEWAY_PRIVATE_KEY as Hex | undefined;
  const resolverAddress = process.env.RESOLVER_ADDRESS as `0x${string}` | undefined;
  const registryAddress = process.env.REGISTRY_ADDRESS as `0x${string}` | undefined;
  const baseSepoliaRpcUrl =
    process.env.BASE_SEPOLIA_RPC_URL ||
    `https://base-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? ""}`;

  if (!privateKey || !resolverAddress || !registryAddress) {
    return Response.json({ error: "gateway not configured" }, { status: 500, headers: CORS_HEADERS });
  }

  const { callData } = await params;
  const callDataHex = (callData.startsWith("0x") ? callData : `0x${callData}`) as Hex;

  const result = await handleCcipRequest(
    { privateKey, resolverAddress, registryAddress, baseSepoliaRpcUrl, ttlSeconds: 60 },
    callDataHex,
  );

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: result.status, headers: CORS_HEADERS });
  }
  return Response.json({ data: result.data }, { headers: CORS_HEADERS });
}
