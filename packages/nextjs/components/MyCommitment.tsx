"use client";

import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;

type Props = {
  proposalNode: `0x${string}`;
  status: number;
  deadline: bigint;
};

const STATUS_ACTIVE = 1;
const STATUS_EXPIRED = 4;

/// Renders the connected member's commitment + the right action button (Withdraw / ClaimRefund / CheckExpiry).
export function MyCommitment({ proposalNode, status, deadline }: Props) {
  const { address } = useAccount();

  const { data: amount } = useScaffoldReadContract({
    contractName: "CommitmentPool",
    functionName: "commitments",
    args: [proposalNode, address],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  if (!address) return null;
  const amt = amount ?? 0n;
  if (amt === 0n) return null;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadlinePassed = now >= deadline;
  const canWithdraw = status === STATUS_ACTIVE && !deadlinePassed;
  const canClaimRefund = status === STATUS_EXPIRED;
  const needsExpiryCall = status === STATUS_ACTIVE && deadlinePassed;

  const onWithdraw = () => writeContractAsync({ functionName: "withdraw", args: [proposalNode] });
  const onClaimRefund = () => writeContractAsync({ functionName: "claimRefund", args: [proposalNode] });
  const onCheckExpiry = () => writeContractAsync({ functionName: "checkExpiry", args: [proposalNode] });

  return (
    <div className="bg-base-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold">Your stake</h3>
      <p className="text-sm">
        You&apos;ve committed <strong>${formatUnits(amt, USDC_DECIMALS)} USDC</strong>.
      </p>

      {canWithdraw && (
        <button className="btn btn-outline btn-sm" disabled={isPending} onClick={onWithdraw}>
          {isPending ? "Withdrawing…" : "Withdraw"}
        </button>
      )}

      {canClaimRefund && (
        <button className="btn btn-primary btn-sm" disabled={isPending} onClick={onClaimRefund}>
          {isPending ? "Refunding…" : "Claim refund"}
        </button>
      )}

      {needsExpiryCall && (
        <div className="space-y-1">
          <p className="text-sm opacity-70">Deadline passed without funding. Anyone can mark this expired.</p>
          <button className="btn btn-outline btn-sm" disabled={isPending} onClick={onCheckExpiry}>
            {isPending ? "Marking expired…" : "Mark expired"}
          </button>
        </div>
      )}
    </div>
  );
}
