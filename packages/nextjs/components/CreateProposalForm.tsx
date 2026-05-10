"use client";

import { useEffect, useState } from "react";
import { type Address, namehash, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

const ZERO_NODE = `0x${"0".repeat(64)}` as const;
const USDC_DECIMALS = 6;
const DEFAULT_WARRANTY_SECONDS = 60n; // tight for demo; production default would be 30 days

type Props = {
  neighborhoodId: `0x${string}`;
  city: string;
  neighborhood: string;
};

/// Member-only form to create a proposal. Shows a "create" affordance once the user has joined.
export function CreateProposalForm({ neighborhoodId, city, neighborhood }: Props) {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);

  const [label, setLabel] = useState("");
  const [executor, setExecutor] = useState<string>("");
  const [description, setDescription] = useState("");
  // Default executor to the connected wallet so solo testing skips manual paste.
  useEffect(() => {
    if (address && !executor) setExecutor(address);
  }, [address, executor]);
  const [targetUsd, setTargetUsd] = useState("");
  const [minMembers, setMinMembers] = useState("");
  const [attestationThreshold, setAttestationThreshold] = useState("");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [resourceType, setResourceType] = useState("");

  const { data: connectedNode } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });
  const isMember = connectedNode && connectedNode !== ZERO_NODE;

  const { writeContractAsync: createProposal, isPending } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });
  const { writeContractAsync: setText } = useScaffoldWriteContract({
    contractName: "ObecRegistry",
  });

  if (!address || !isMember) return null;

  const submit = async () => {
    // Trim + lowercase: label becomes part of the ENS subname namehash, so any whitespace
    // or case difference breaks subsequent reads (the URL `/p/<label>` won't round-trip).
    const labelClean = label.trim().toLowerCase();
    const typeClean = resourceType.trim().toLowerCase();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);
    await createProposal({
      functionName: "createProposal",
      args: [
        {
          neighborhoodId,
          label: labelClean,
          executor: executor as Address,
          targetAmount: parseUnits(targetUsd, USDC_DECIMALS),
          minMembers: BigInt(minMembers),
          deadline,
          warrantyDuration: DEFAULT_WARRANTY_SECONDS,
          attestationThreshold: BigInt(attestationThreshold),
          resourceType: typeClean,
        },
      ],
    });
    if (description.trim()) {
      const proposalNode = namehash(`${labelClean}.${neighborhood}.${city}.${PROTOCOL_ROOT}`);
      await setText({
        functionName: "setText",
        args: [proposalNode, "description", description.trim()],
      });
    }
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="obec-btn ghost sm mt-4" onClick={() => setOpen(true)}>
        Propose a project <span className="arrow">→</span>
      </button>
    );
  }

  return (
    <NetworkGuard targetChainId={STATE_CHAIN_ID}>
      <div
        className="mt-4 p-6 space-y-3"
        style={{ border: "1px solid var(--hair)", borderRadius: 4, background: "var(--paper)" }}
      >
        <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, letterSpacing: "-0.02em", margin: 0 }}>
          New proposal
        </h3>
        <Field
          label="Label (becomes the subname)"
          value={label}
          onChange={v => setLabel(v.trim().toLowerCase().replace(/\s+/g, "-"))}
          mono
          placeholder="e.g. cargo-bikes"
        />
        <Field label="Executor address" value={executor} onChange={setExecutor} mono placeholder="0x…" />
        <label className="block">
          <span className="micro" style={{ fontSize: 11 }}>
            Description (saved as `description` text record)
          </span>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="What is this pool for? Who benefits, what gets bought, how does it run?"
            className="block w-full mt-2"
            style={{
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
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Target (USD ≈ USDC)" value={targetUsd} onChange={setTargetUsd} placeholder="e.g. 5000" />
          <Field label="Min members" value={minMembers} onChange={setMinMembers} placeholder="e.g. 10" />
          <Field
            label="Attestations needed"
            value={attestationThreshold}
            onChange={setAttestationThreshold}
            placeholder="e.g. 5"
          />
          <Field label="Deadline (days from now)" value={deadlineDays} onChange={setDeadlineDays} />
          <Field
            label="Project type"
            value={resourceType}
            onChange={v => setResourceType(v.trim().toLowerCase())}
            placeholder="e.g. mobility, tool, space, energy"
          />
        </div>
        <div className="flex gap-2">
          <button
            className="obec-btn sm"
            disabled={
              isPending ||
              !executor ||
              !label.trim() ||
              !targetUsd ||
              !minMembers ||
              !attestationThreshold ||
              !resourceType.trim()
            }
            onClick={submit}
          >
            {isPending ? "Creating…" : "Create proposal"} <span className="arrow">→</span>
          </button>
          <button className="obec-btn ghost sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </NetworkGuard>
  );
}

function Field({
  label,
  value,
  onChange,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="micro" style={{ fontSize: 11 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`block w-full mt-2 ${mono ? "mono" : ""}`}
        style={{
          padding: "9px 12px",
          border: "1px solid var(--hair)",
          borderRadius: 4,
          background: "var(--paper)",
          color: "var(--ink)",
          fontSize: 13,
          outline: "none",
        }}
      />
    </label>
  );
}
