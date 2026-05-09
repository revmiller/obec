"use client";

import { useAccount } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

export function CreateNeighborhoodButton({ city, neighborhood }: { city: string; neighborhood: string }) {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "HromadaRegistry",
  });

  if (!address) {
    return (
      <div className="mt-4">
        <ConnectPrompt message="Connect a wallet to create this neighborhood." />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <NetworkGuard targetChainId={84532}>
        <button
          className="btn btn-primary"
          disabled={isPending}
          onClick={() => writeContractAsync({ functionName: "createNeighborhood", args: [city, neighborhood] })}
        >
          {isPending ? "Creating…" : "Create this neighborhood"}
        </button>
      </NetworkGuard>
    </div>
  );
}
