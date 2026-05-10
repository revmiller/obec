"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "~~/components/obec";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

type Props = {
  neighborhoodId: `0x${string}`;
  admin: `0x${string}` | undefined;
};

export function NeighborhoodDescription({ neighborhoodId, admin }: Props) {
  const { address } = useAccount();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: description } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getText",
    args: [neighborhoodId, "description"],
  });

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "ObecRegistry",
  });

  useEffect(() => {
    if (typeof description === "string") setDraft(description);
  }, [description]);

  const isAdmin = address && admin && address.toLowerCase() === admin.toLowerCase();

  const onSave = async () => {
    await writeContractAsync({
      functionName: "setText",
      args: [neighborhoodId, "description", draft.trim()],
    });
    setEditing(false);
  };

  if (!editing) {
    if (typeof description === "string" && description) {
      return (
        <div className="mt-3" style={{ maxWidth: 620 }}>
          <p
            style={{
              fontSize: 18,
              color: "var(--ink-2)",
              lineHeight: 1.45,
              letterSpacing: "-0.005em",
              whiteSpace: "pre-wrap",
            }}
          >
            {description}
          </p>
          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-3)",
                background: "none",
                border: "none",
                padding: 0,
                marginTop: 8,
                cursor: "pointer",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              edit description
            </button>
          )}
        </div>
      );
    }
    if (isAdmin) {
      return (
        <button
          onClick={() => setEditing(true)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            marginTop: 12,
            fontSize: 14,
            color: "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          + Add a description for your neighborhood
        </button>
      );
    }
    return null;
  }

  return (
    <div className="mt-3" style={{ maxWidth: 620 }}>
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        rows={3}
        placeholder="What does this neighborhood do?"
        style={{
          width: "100%",
          padding: 10,
          border: "1px solid var(--hair)",
          borderRadius: 4,
          background: "var(--paper)",
          color: "var(--ink)",
          fontFamily: "var(--sans)",
          fontSize: 14,
          outline: "none",
          resize: "vertical",
        }}
      />
      <div className="flex gap-2 mt-2">
        <Button size="sm" disabled={isPending} onClick={onSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
