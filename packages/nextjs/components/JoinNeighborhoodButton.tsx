"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const ZERO_NODE = `0x${"0".repeat(64)}` as const;

export function JoinNeighborhoodButton({ neighborhoodId }: { neighborhoodId: `0x${string}` }) {
  const { address } = useAccount();
  const [label, setLabel] = useState("");

  const { data: existingNode } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "HromadaRegistry",
  });

  if (!address) {
    return <p className="mt-4 text-sm opacity-60">Connect a wallet to join.</p>;
  }
  if (existingNode && existingNode !== ZERO_NODE) {
    return <p className="mt-4 text-sm opacity-60">You&apos;re already a member somewhere.</p>;
  }

  return (
    <NetworkGuard targetChainId={STATE_CHAIN_ID}>
      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="your-name"
          value={label}
          onChange={e => setLabel(e.target.value.trim().toLowerCase())}
          className="input input-bordered input-sm"
        />
        <button
          className="btn btn-primary btn-sm"
          disabled={isPending || !label}
          onClick={() => writeContractAsync({ functionName: "joinNeighborhood", args: [neighborhoodId, label] })}
        >
          {isPending ? "Joining…" : "Join"}
        </button>
      </div>
    </NetworkGuard>
  );
}
