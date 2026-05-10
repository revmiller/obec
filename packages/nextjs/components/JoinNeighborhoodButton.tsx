"use client";

import { useState } from "react";
import { parseAbi } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { Button } from "~~/components/obec";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const ZERO_NODE = `0x${"0".repeat(64)}` as const;
const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
// ENSIP-19 default reverse registrar on Base Sepolia. Setting the user's reverse
// name here makes Basescan display "<label>.<neighborhood>.<city>.<protocol-root>"
// instead of 0x… on this same wallet.
const L2_REVERSE_REGISTRAR = "0x00000BeEF055f7934784D6d81b6BC86665630dbA" as const;
const REVERSE_ABI = parseAbi(["function setName(string name) external returns (bytes32)"]);

export function JoinNeighborhoodButton({
  neighborhoodId,
  city,
  neighborhood,
}: {
  neighborhoodId: `0x${string}`;
  city: string;
  neighborhood: string;
}) {
  const { address } = useAccount();
  const [label, setLabel] = useState("");

  const { data: existingNode } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "ObecRegistry",
  });
  const { writeContractAsync: writeReverseAsync, isPending: isReversePending } = useWriteContract();

  if (!address) {
    return (
      <p className="mt-4" style={{ fontSize: 13, color: "var(--ink-3)" }}>
        Connect a wallet to join.
      </p>
    );
  }
  if (existingNode && existingNode !== ZERO_NODE) {
    return (
      <p className="mt-4" style={{ fontSize: 13, color: "var(--ink-3)" }}>
        You&apos;re already a member somewhere.
      </p>
    );
  }

  const handleJoin = async () => {
    await writeContractAsync({ functionName: "joinNeighborhood", args: [neighborhoodId, label] });
    // Best-effort ENSIP-19 reverse: a second tx so Basescan shows the full ENS
    // name for this wallet. Failure here is non-blocking — the user already
    // joined successfully.
    try {
      const fullName = `${label}.${neighborhood}.${city}.${PROTOCOL_ROOT}`;
      await writeReverseAsync({
        address: L2_REVERSE_REGISTRAR,
        abi: REVERSE_ABI,
        functionName: "setName",
        args: [fullName],
      });
    } catch {
      // ignore — reverse name is cosmetic
    }
  };

  return (
    <NetworkGuard targetChainId={STATE_CHAIN_ID}>
      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="your-name"
          value={label}
          onChange={e => setLabel(e.target.value.trim().toLowerCase())}
          className="mono"
          style={{
            fontSize: 13,
            padding: "9px 14px",
            border: "1px solid var(--hair)",
            borderRadius: 4,
            background: "var(--paper)",
            color: "var(--ink)",
            outline: "none",
            minWidth: 180,
          }}
        />
        <Button size="sm" disabled={isPending || isReversePending || !label} onClick={handleJoin} arrow>
          {isPending ? "Joining…" : isReversePending ? "Setting ENS name…" : "Join"}
        </Button>
      </div>
    </NetworkGuard>
  );
}
