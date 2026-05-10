"use client";

import { useState } from "react";
import { type Address, erc20Abi, formatUnits, maxUint256, parseUnits } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
import { MintTestUSDC } from "~~/components/MintTestUSDC";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const USDC_DECIMALS = 6;
const ZERO_NODE = `0x${"0".repeat(64)}` as const;

type Props = {
  proposalNode: `0x${string}`;
  poolAddress: Address;
  /// Total target in USDC base units — drives the slider max & threshold-flip styling.
  target?: bigint;
  /// Already-committed in base units — slider tops up from here.
  committed?: bigint;
  enabled?: boolean;
};

/// Two-step USDC commit: approve (if allowance < amount) → commit.
/// The panel turns terracotta the moment your input would tip the pool past threshold —
/// signaling that this commit is the atomic moment subname creation + M0 release happen.
export function CommitForm({ proposalNode, poolAddress, target = 0n, committed = 0n, enabled = true }: Props) {
  const { address } = useAccount();

  const targetUsd = target > 0n ? Number(formatUnits(target, USDC_DECIMALS)) : 0;
  const committedUsd = committed > 0n ? Number(formatUnits(committed, USDC_DECIMALS)) : 0;
  const remainingUsd = Math.max(0, targetUsd - committedUsd);
  const defaultUsd = Math.min(530, remainingUsd > 0 ? remainingUsd : 530);

  const [usdInput, setUsdInput] = useState(String(defaultUsd));
  const numericInput = Number(usdInput) || 0;
  const wouldTipThreshold = targetUsd > 0 && committedUsd + numericInput >= targetUsd;

  const { data: mockUsdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const usdcAddress = mockUsdc?.address as Address | undefined;

  const amount = (() => {
    try {
      return parseUnits(usdInput || "0", USDC_DECIMALS);
    } catch {
      return 0n;
    }
  })();

  const { data: connectedNode } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });
  const isMember = connectedNode && connectedNode !== ZERO_NODE;

  const { data: allowance } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && usdcAddress ? [address, poolAddress] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  });

  const needsApproval = (allowance ?? 0n) < amount;

  const { writeContract: approve, data: approveTxHash, isPending: approving } = useWriteContract();
  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  const { writeContractAsync: commit, isPending: committing } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  if (!address) return <ConnectPrompt message="Connect a wallet to commit funds." />;
  if (!isMember) return <p style={{ color: "var(--ink-3)", fontSize: 13 }}>Only neighborhood members can commit.</p>;
  if (!enabled) return null;
  if (!usdcAddress) return <p style={{ color: "var(--ink-3)", fontSize: 13 }}>USDC not configured for this chain.</p>;

  const onApprove = () =>
    approve({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [poolAddress, maxUint256] });

  const onCommit = async () => {
    await commit({ functionName: "commit", args: [proposalNode, amount] });
  };

  const sliderMax = Math.max(remainingUsd, 50);

  return (
    <NetworkGuard targetChainId={STATE_CHAIN_ID}>
      <div
        className="space-y-4"
        style={{
          background: "var(--paper)",
          border: wouldTipThreshold ? "1px solid var(--terracotta)" : "1px solid var(--hair)",
          padding: 22,
          transition: "border-color 200ms ease",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>
            Commit USDC
          </h3>
          <MintTestUSDC />
        </div>

        <div>
          <label className="micro" style={{ fontSize: 11 }}>
            Amount
          </label>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="serif" style={{ fontSize: 36, fontWeight: 400, letterSpacing: "-0.02em" }}>
              ${numericInput.toLocaleString()}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
              USDC
            </span>
          </div>
          {targetUsd > 0 && (
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={10}
              value={numericInput}
              onChange={e => setUsdInput(e.target.value)}
              className="w-full mt-3"
              style={{
                accentColor: wouldTipThreshold ? "var(--terracotta)" : "var(--ink)",
              }}
            />
          )}
          <input
            type="number"
            value={usdInput}
            onChange={e => setUsdInput(e.target.value)}
            className="mono mt-2"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--hair)",
              borderRadius: 4,
              background: "var(--paper)",
              color: "var(--ink)",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            background: wouldTipThreshold ? "var(--terracotta-bg)" : "var(--paper-2)",
            border: "1px solid var(--hair)",
            padding: 14,
            fontSize: 13.5,
            color: "var(--ink-2)",
            lineHeight: 1.55,
          }}
        >
          {wouldTipThreshold ? (
            <>
              <p style={{ margin: 0 }}>
                <strong>This commit tips the threshold.</strong>
              </p>
              <p style={{ margin: "8px 0 0 0", color: "var(--ink-3)" }}>
                The atomic moment: subname is created, member &amp; resource records are written, milestone&nbsp;0 (30%)
                releases to the executor — all in one transaction.
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                You&apos;re committing <strong>${numericInput.toLocaleString()} USDC</strong>.
              </p>
              <p style={{ margin: "8px 0 0 0", color: "var(--ink-3)" }}>
                If the target isn&apos;t reached by the deadline, every commitment is automatically refunded.
              </p>
              {needsApproval && (
                <p
                  className="mono"
                  style={{ margin: "10px 0 0 0", fontSize: 11, color: "var(--ink-4)", letterSpacing: 0 }}
                >
                  two txs: (1) approve usdc, (2) commit funds
                </p>
              )}
            </>
          )}
        </div>

        {needsApproval ? (
          <button
            className="obec-btn"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={approving || approveConfirming || amount === 0n}
            onClick={onApprove}
          >
            {approving || approveConfirming ? "Approving USDC…" : "1 — Approve USDC"}
            <span className="arrow">→</span>
          </button>
        ) : (
          <button
            className="obec-btn"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={committing || amount === 0n}
            onClick={onCommit}
          >
            {committing ? "Committing…" : `Commit $${numericInput.toLocaleString()}`}
            <span className="arrow">→</span>
          </button>
        )}
      </div>
    </NetworkGuard>
  );
}
