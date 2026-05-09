"use client";

import { useAccount } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
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
    <button
      className="btn btn-primary mt-4"
      disabled={isPending}
      onClick={() => writeContractAsync({ functionName: "createNeighborhood", args: [city, neighborhood] })}
    >
      {isPending ? "Creating…" : "Create this neighborhood"}
    </button>
  );
}
