"use client";

import { useState } from "react";
import { type Address, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

const ZERO_NODE = `0x${"0".repeat(64)}` as const;
const USDC_DECIMALS = 6;
const DEFAULT_WARRANTY_SECONDS = 60n; // tight for demo; production default would be 30 days

type Props = {
  neighborhoodId: `0x${string}`;
};

/// Member-only form to create a proposal. Shows a "create" affordance once the user has joined.
export function CreateProposalForm({ neighborhoodId }: Props) {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);

  const [label, setLabel] = useState("proposal-solar");
  const [executor, setExecutor] = useState<string>("");
  const [targetEur, setTargetEur] = useState("8000");
  const [minMembers, setMinMembers] = useState("14");
  const [attestationThreshold, setAttestationThreshold] = useState("8");
  const [deadlineDays, setDeadlineDays] = useState("30");
  const [resourceLabel, setResourceLabel] = useState("solar-array");
  const [resourceType, setResourceType] = useState("energy");

  const { data: connectedNode } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNodeByAddress",
    args: [address],
  });
  const isMember = connectedNode && connectedNode !== ZERO_NODE;

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "CommitmentPool",
  });

  if (!address || !isMember) return null;

  const submit = async () => {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(deadlineDays) * 86400);
    await writeContractAsync({
      functionName: "createProposal",
      args: [
        {
          neighborhoodId,
          label,
          executor: executor as Address,
          targetAmount: parseUnits(targetEur, USDC_DECIMALS),
          minMembers: BigInt(minMembers),
          deadline,
          warrantyDuration: DEFAULT_WARRANTY_SECONDS,
          attestationThreshold: BigInt(attestationThreshold),
          resourceLabel,
          resourceType,
        },
      ],
    });
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="btn btn-outline btn-sm mt-4" onClick={() => setOpen(true)}>
        Propose a project
      </button>
    );
  }

  return (
    <div className="mt-4 p-5 bg-base-200 rounded-xl space-y-3">
      <h3 className="font-semibold">New proposal</h3>
      <Field label="Label (becomes the subname)" value={label} onChange={setLabel} mono />
      <Field label="Executor address" value={executor} onChange={setExecutor} mono placeholder="0x…" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target (EUR ≈ USDC)" value={targetEur} onChange={setTargetEur} />
        <Field label="Min members" value={minMembers} onChange={setMinMembers} />
        <Field label="Attestations needed" value={attestationThreshold} onChange={setAttestationThreshold} />
        <Field label="Deadline (days from now)" value={deadlineDays} onChange={setDeadlineDays} />
        <Field label="Resource label" value={resourceLabel} onChange={setResourceLabel} mono />
        <Field label="Resource type" value={resourceType} onChange={setResourceType} />
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" disabled={isPending || !executor} onClick={submit}>
          {isPending ? "Creating…" : "Create proposal"}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
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
      <span className="text-xs opacity-70">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={`input input-bordered input-sm w-full mt-1 ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}
