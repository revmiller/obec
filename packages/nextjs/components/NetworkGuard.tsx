"use client";

import type { ReactNode } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";

const CHAIN_LABEL: Record<number, string> = {
  84532: "Base Sepolia",
  11155111: "Sepolia",
  31337: "localhost",
};

/// Renders a "switch network" prompt when the connected wallet is on a different chain
/// than the action requires. Used at commit/join/attest sites that target Base Sepolia.
export function NetworkGuard({ targetChainId, children }: { targetChainId: number; children: ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  // Pass through if not connected (the action site renders its own ConnectPrompt),
  // already on target chain, or on local anvil (dev workflow).
  if (!isConnected || chainId === targetChainId || chainId === 31337) return <>{children}</>;

  const targetLabel = CHAIN_LABEL[targetChainId] ?? `chain ${targetChainId}`;
  const currentLabel = CHAIN_LABEL[chainId] ?? `chain ${chainId}`;

  return (
    <div className="bg-warning/10 border border-warning/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
      <p className="text-sm">
        Your wallet is on <strong>{currentLabel}</strong>. This action runs on <strong>{targetLabel}</strong>.
      </p>
      <button
        className="btn btn-warning btn-sm"
        disabled={isPending}
        onClick={() => switchChain({ chainId: targetChainId })}
      >
        {isPending ? "Switching…" : `Switch to ${targetLabel}`}
      </button>
    </div>
  );
}
