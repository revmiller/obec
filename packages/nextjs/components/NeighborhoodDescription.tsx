"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

type Props = {
  neighborhoodId: `0x${string}`;
  admin: `0x${string}` | undefined;
};

/// Admin-editable, public-readable description of the neighborhood.
/// Stored as a `description` text record on the neighborhood's node.
export function NeighborhoodDescription({ neighborhoodId, admin }: Props) {
  const { address } = useAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: description } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getText",
    args: [neighborhoodId, "description"],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "HromadaRegistry",
  });

  useEffect(() => {
    if (description !== undefined) setDraft(description);
  }, [description]);

  const isAdmin = address && admin && address.toLowerCase() === admin.toLowerCase();

  const onSave = async () => {
    await writeContractAsync({
      functionName: "setText",
      args: [neighborhoodId, "description", draft.trim()],
    });
    setEditing(false);
  };

  // Read-only render
  if (!editing) {
    if (description) {
      return (
        <div className="mt-3 max-w-2xl">
          <p className="text-base opacity-90 whitespace-pre-wrap">{description}</p>
          {isAdmin && (
            <button onClick={() => setEditing(true)} className="text-xs opacity-50 hover:opacity-80 mt-1">
              edit description
            </button>
          )}
        </div>
      );
    }
    if (isAdmin) {
      return (
        <button onClick={() => setEditing(true)} className="mt-3 text-sm opacity-70 hover:opacity-100 hover:underline">
          + Add a description for your neighborhood
        </button>
      );
    }
    return null;
  }

  // Editing render (admin only — guarded by isAdmin gate above)
  return (
    <div className="mt-3 max-w-2xl space-y-2">
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        placeholder="What does this neighborhood do? (e.g. 15 households cooperating on shared cargo bikes, retrofits, and tools.)"
        className="textarea textarea-bordered textarea-sm w-full"
      />
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
