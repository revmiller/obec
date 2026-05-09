"use client";

import { useAccount } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

type Props = {
  proposalNode: `0x${string}`;
  attestationCount: bigint;
  attestationThreshold: bigint;
};

export function AttestButton({ proposalNode, attestationCount, attestationThreshold }: Props) {
  const { address } = useAccount();

  const { data: alreadyAttested } = useScaffoldReadContract({
    contractName: "CommitmentPool",
    functionName: "hasAttested",
    args: [proposalNode, address],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  const remaining = attestationThreshold > attestationCount ? attestationThreshold - attestationCount : 0n;

  if (!address) return <ConnectPrompt message="Connect a wallet to confirm completion." />;

  return (
    <NetworkGuard targetChainId={STATE_CHAIN_ID}>
      <div className="bg-base-200 rounded-xl p-5 space-y-3">
        <h3 className="font-semibold">Confirm work completed</h3>
        <p className="text-sm opacity-80">
          {attestationCount.toString()} of {attestationThreshold.toString()} confirmations.{" "}
          {remaining > 0n ? `${remaining} more needed to release the next milestone.` : "Threshold met."}
        </p>
        <button
          className="btn btn-primary btn-sm"
          disabled={isPending || alreadyAttested === true}
          onClick={() => writeContractAsync({ functionName: "attest", args: [proposalNode] })}
        >
          {alreadyAttested ? "Already confirmed" : isPending ? "Confirming…" : "Confirm completion"}
        </button>
      </div>
    </NetworkGuard>
  );
}
