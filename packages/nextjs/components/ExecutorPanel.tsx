"use client";

import { useAccount } from "wagmi";
import { ENSName } from "~~/components/ENSName";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

type Props = {
  proposalNode: `0x${string}`;
  executor: `0x${string}` | undefined;
  milestoneReleased: readonly [boolean, boolean, boolean];
  attestedAt: bigint;
  warrantyDuration: bigint;
};

/// Visible when the connected wallet is the executor. Shows past + claimable milestones.
export function ExecutorPanel({ proposalNode, executor, milestoneReleased, attestedAt, warrantyDuration }: Props) {
  const { address } = useAccount();
  const isExecutor = address && executor && address.toLowerCase() === executor.toLowerCase();

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  if (!isExecutor) return null;

  const now = BigInt(Math.floor(Date.now() / 1000));
  const warrantyReady = milestoneReleased[1] && now >= attestedAt + warrantyDuration;
  const warrantyEta = milestoneReleased[1] && !warrantyReady ? Number(attestedAt + warrantyDuration - now) : 0;

  return (
    <div className="bg-base-200 rounded-xl p-5 space-y-3">
      <h3 className="font-semibold">Executor panel</h3>
      <p className="text-sm opacity-70">
        You are <ENSName address={executor} />.
      </p>

      <ul className="text-sm space-y-1">
        <li>Milestone 0 (30%): {milestoneReleased[0] ? <span className="opacity-60">released</span> : "pending"}</li>
        <li>Milestone 1 (50%): {milestoneReleased[1] ? <span className="opacity-60">released</span> : "pending"}</li>
        <li>
          Milestone 2 (20%):{" "}
          {milestoneReleased[2] ? (
            <span className="opacity-60">released</span>
          ) : warrantyReady ? (
            <span className="font-semibold">claimable</span>
          ) : milestoneReleased[1] ? (
            <span className="opacity-60">warranty in {warrantyEta}s</span>
          ) : (
            "pending"
          )}
        </li>
      </ul>

      {warrantyReady && !milestoneReleased[2] && (
        <button
          className="btn btn-primary btn-sm"
          disabled={isPending}
          onClick={() => writeContractAsync({ functionName: "claimWarrantyMilestone", args: [proposalNode] })}
        >
          {isPending ? "Claiming…" : "Claim warranty milestone"}
        </button>
      )}
    </div>
  );
}
