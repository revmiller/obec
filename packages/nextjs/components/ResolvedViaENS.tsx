"use client";

import { useEffect, useState } from "react";
import { type Address, createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { COIN_TYPE_BASE_SEPOLIA } from "~~/lib/coin-types";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";

const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http(
    ALCHEMY_KEY
      ? `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : "https://eth-sepolia.g.alchemy.com/v2/cR4WnXePioePZ5fFrnSiR",
  ),
});

type Result = {
  loading: boolean;
  addr?: Address;
  addrBaseSepolia?: string;
  textFundedBy?: string;
  textMaintainer?: string;
  textAttestations?: string;
  error?: string;
  elapsed?: number;
};

/// Resolves an ENS name through the actual ENS+CCIP-Read flow, NOT through our registry directly.
/// Demonstrates that any wallet/explorer/dApp can read Hromada records via standard ENS infra.
///   viem → resolver on Sepolia → OffchainLookup → our gateway → Base Sepolia state → signed → verified
export function ResolvedViaENS({ name }: { name: string }) {
  const [r, setR] = useState<Result>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    (async () => {
      try {
        const [addr, addrBase, textFunded, textMaint, textAttest] = await Promise.all([
          sepoliaClient.getEnsAddress({ name }).catch(() => undefined),
          sepoliaClient.getEnsAddress({ name, coinType: COIN_TYPE_BASE_SEPOLIA }).catch(() => undefined),
          sepoliaClient.getEnsText({ name, key: "funded-by" }).catch(() => undefined),
          sepoliaClient.getEnsText({ name, key: "maintainer" }).catch(() => undefined),
          sepoliaClient.getEnsText({ name, key: "attestations" }).catch(() => undefined),
        ]);
        if (cancelled) return;
        setR({
          loading: false,
          addr: addr ?? undefined,
          addrBaseSepolia: addrBase as string | undefined,
          textFundedBy: textFunded ?? undefined,
          textMaintainer: textMaint ?? undefined,
          textAttestations: textAttest ?? undefined,
          elapsed: Date.now() - start,
        });
      } catch (e) {
        if (cancelled) return;
        setR({ loading: false, error: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <div className="bg-base-200 rounded-xl p-5 border border-secondary/40">
      <div className="text-xs uppercase tracking-wide opacity-60">Resolved via ENS + CCIP-Read</div>
      <p className="text-sm opacity-80 mt-1 max-w-2xl leading-relaxed">
        Same call path Etherscan, MetaMask, or any wallet uses. <span className="font-mono">viem</span> hits the
        resolver on Sepolia → resolver reverts with <span className="font-mono">OffchainLookup</span> → the browser
        follows the redirect to our gateway → the gateway queries Base Sepolia state → signs → returns. The resolver
        verifies the signature on-chain.
      </p>
      <p className="font-mono text-sm mt-2 break-all">{name}</p>

      {r.loading && <p className="text-sm opacity-60 mt-3">Resolving via Sepolia → gateway → Base Sepolia…</p>}
      {r.error && <p className="text-sm text-error mt-3 break-words">Error: {r.error}</p>}
      {!r.loading && !r.error && (
        <ul className="mt-3 space-y-1.5 text-sm">
          <Row label="getEnsAddress(name)" value={r.addr} />
          <Row label="getEnsAddress(name, coin: Base Sepolia)" value={r.addrBaseSepolia} />
          <Row label="getEnsText(name, 'funded-by')" value={r.textFundedBy} />
          <Row label="getEnsText(name, 'maintainer')" value={r.textMaintainer} />
          <Row label="getEnsText(name, 'attestations')" value={r.textAttestations} />
        </ul>
      )}

      {r.elapsed !== undefined && (
        <p className="text-xs opacity-50 mt-3">
          Round-trip: {r.elapsed}ms · Sepolia resolver → gateway signs → Base Sepolia returns
        </p>
      )}

      {!ALCHEMY_KEY && PROTOCOL_ROOT && (
        <p className="text-xs opacity-40 mt-2">
          Using shared Alchemy key (set <code>NEXT_PUBLIC_ALCHEMY_API_KEY</code> for production).
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | undefined }) {
  return (
    <li className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-1 sm:gap-3 sm:items-baseline">
      <span className="font-mono text-xs opacity-70">{label}</span>
      <span className="font-mono text-xs break-all">{value ?? "—"}</span>
    </li>
  );
}
