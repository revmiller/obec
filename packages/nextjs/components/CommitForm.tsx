"use client";

import { useState } from "react";
import { type Address, erc20Abi, maxUint256, parseUnits } from "viem";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
import { MintTestUSDC } from "~~/components/MintTestUSDC";
import { useDeployedContractInfo, useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;
const ZERO_NODE = `0x${"0".repeat(64)}` as const;

// Per-chain USDC address (Base Sepolia uses Circle's testnet USDC; localhost falls back to MockUSDC).
function usdcAddressForChain(chainId: number, mockAddress: Address | undefined): Address | undefined {
  if (chainId === 84532) return "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
  return mockAddress;
}

type Props = {
  proposalNode: `0x${string}`;
  poolAddress: Address;
  /// Required by Pool.commit (Active status, member, etc.). Caller decides whether to render.
  enabled?: boolean;
};

/// Two-step USDC commit: approve (if allowance < amount) → commit. Renders a plain-language
/// summary and the wallet handles the actual signing.
export function CommitForm({ proposalNode, poolAddress, enabled = true }: Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const [eurInput, setEurInput] = useState("530");

  const { data: mockUsdc } = useDeployedContractInfo({ contractName: "MockUSDC" });
  const usdcAddress = usdcAddressForChain(chainId, mockUsdc?.address as Address | undefined);

  const amount = (() => {
    try {
      return parseUnits(eurInput || "0", USDC_DECIMALS);
    } catch {
      return 0n;
    }
  })();

  const { data: connectedNode } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
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

  // approve (USDC ERC20)
  const { writeContract: approve, data: approveTxHash, isPending: approving } = useWriteContract();
  const { isLoading: approveConfirming } = useWaitForTransactionReceipt({ hash: approveTxHash });

  // commit (Pool)
  const { writeContractAsync: commit, isPending: committing } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  if (!address) return <ConnectPrompt message="Connect a wallet to commit funds." />;
  if (!isMember) return <p className="opacity-60 text-sm">Only neighborhood members can commit.</p>;
  if (!enabled) return null;
  if (!usdcAddress) return <p className="opacity-60 text-sm">USDC not configured for this chain.</p>;

  const onApprove = () =>
    approve({ address: usdcAddress, abi: erc20Abi, functionName: "approve", args: [poolAddress, maxUint256] });

  const onCommit = async () => {
    await commit({ functionName: "commit", args: [proposalNode, amount] });
  };

  return (
    <div className="bg-base-200 rounded-xl p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-semibold">Commit funds</h3>
        <MintTestUSDC />
      </div>

      <label className="block">
        <span className="text-xs opacity-70">Amount (EUR ≈ USDC)</span>
        <input
          type="number"
          value={eurInput}
          onChange={e => setEurInput(e.target.value)}
          className="input input-bordered input-sm w-full mt-1"
        />
      </label>

      {/* Anti-blind-signing: plain-language summary of what's about to happen */}
      <div className="text-sm bg-base-100 rounded-lg p-3 border border-base-300">
        <p>
          You&apos;re committing{" "}
          <strong>
            €{eurInput || 0} ({eurInput || 0} USDC)
          </strong>
          .
        </p>
        <p className="mt-1 opacity-80">
          If the proposal&apos;s target isn&apos;t reached by the deadline, you&apos;ll be{" "}
          <strong>automatically refunded</strong>.
        </p>
        {needsApproval && (
          <p className="mt-2 opacity-70 text-xs">Two transactions: (1) approve USDC, (2) commit funds.</p>
        )}
      </div>

      {needsApproval ? (
        <button
          className="btn btn-primary btn-sm w-full"
          disabled={approving || approveConfirming || amount === 0n}
          onClick={onApprove}
        >
          {approving || approveConfirming ? "Approving USDC…" : "1 — Approve USDC"}
        </button>
      ) : (
        <button className="btn btn-primary btn-sm w-full" disabled={committing || amount === 0n} onClick={onCommit}>
          {committing ? "Committing…" : `Commit €${eurInput || 0}`}
        </button>
      )}
    </div>
  );
}
