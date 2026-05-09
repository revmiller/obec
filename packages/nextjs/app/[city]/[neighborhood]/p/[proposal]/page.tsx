"use client";

import { use } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { namehash } from "viem/ens";
import { AttestButton } from "~~/components/AttestButton";
import { CommitForm } from "~~/components/CommitForm";
import { ENSName } from "~~/components/ENSName";
import { ExecutorPanel } from "~~/components/ExecutorPanel";
import { MyCommitment } from "~~/components/MyCommitment";
import { ResourceCard } from "~~/components/ResourceCard";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";
const USDC_DECIMALS = 6;

const STATUS_LABEL = ["None", "Active", "Executing", "Completed", "Expired", "Disputed"] as const;

type Params = { city: string; neighborhood: string; proposal: string };

export default function ProposalPage({ params }: { params: Promise<Params> }) {
  const { city, neighborhood, proposal } = use(params);
  const fullName = `${proposal}.${neighborhood}.${city}.${PROTOCOL_ROOT}`;
  const proposalNode = namehash(fullName);

  const { data: pr } = useScaffoldReadContract({
    contractName: "CommitmentPool",
    functionName: "getProposal",
    args: [proposalNode],
  });

  const { data: description } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getText",
    args: [proposalNode, "description"],
  });

  const { data: pool } = useDeployedContractInfo({ contractName: "CommitmentPool" });

  const loading = pr === undefined;
  const status = Number(pr?.status ?? 0);
  const exists = !loading && status !== 0;

  const target = pr?.targetAmount ?? 0n;
  const committed = pr?.totalCommitted ?? 0n;
  const progress = target > 0n ? Number((committed * 100n) / target) : 0;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-sm opacity-60">
        <Link href="/" className="hover:underline">
          home
        </Link>{" "}
        /{" "}
        <Link href={`/${city}`} className="hover:underline capitalize">
          {city}
        </Link>{" "}
        /{" "}
        <Link href={`/${city}/${neighborhood}`} className="hover:underline capitalize">
          {neighborhood}
        </Link>
      </div>

      <h1 className="text-3xl font-bold mt-2 capitalize">{proposal.replace(/-/g, " ")}</h1>
      <p className="font-mono text-sm opacity-70 mt-1">{fullName}</p>

      {loading ? (
        <div className="mt-10 opacity-50 text-sm">Loading…</div>
      ) : !exists ? (
        <div className="mt-10 p-6 bg-base-200 rounded-xl">
          <p className="text-lg">This proposal doesn&apos;t exist yet.</p>
          <p className="text-sm opacity-70 mt-2">A neighborhood member can create it from the neighborhood page.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 inline-block px-3 py-1 rounded-full text-xs font-semibold bg-base-300">
            {STATUS_LABEL[status] ?? "Unknown"}
          </div>

          {description && <p className="mt-4 text-base opacity-90 max-w-2xl whitespace-pre-wrap">{description}</p>}

          <section className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-base-200 rounded-xl p-5">
              <div className="text-sm opacity-70">Target</div>
              <div className="text-2xl font-semibold">{formatUnits(target, USDC_DECIMALS)} USDC</div>
              <div className="mt-3 text-sm opacity-70">Committed</div>
              <div className="text-lg">
                {formatUnits(committed, USDC_DECIMALS)} USDC <span className="opacity-60">({progress}%)</span>
              </div>
              <div className="mt-2 w-full h-2 rounded-full bg-base-300 overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <div className="mt-3 text-sm">
                Members:{" "}
                <span className="font-semibold">
                  {pr?.memberCount?.toString() ?? "0"} / {pr?.minMembers?.toString() ?? "0"}
                </span>
              </div>
            </div>

            <div className="bg-base-200 rounded-xl p-5">
              <div className="text-sm opacity-70">Executor</div>
              <div className="mt-1">
                <ENSName address={pr?.executor} />
              </div>
              <div className="mt-3 text-sm opacity-70">Deadline</div>
              <div className="text-sm">{pr ? new Date(Number(pr.deadline) * 1000).toLocaleString() : "—"}</div>
              <div className="mt-3 text-sm opacity-70">Warranty after release</div>
              <div className="text-sm">{pr ? `${pr.warrantyDuration?.toString()} seconds` : "—"}</div>
            </div>
          </section>

          <section className="mt-8 bg-base-200 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-2">Milestones</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Milestone label="On threshold (30%)" released={pr?.milestoneReleased?.[0] ?? false} />
              <Milestone label="On attestations (50%)" released={pr?.milestoneReleased?.[1] ?? false} />
              <Milestone label="Post-warranty (20%)" released={pr?.milestoneReleased?.[2] ?? false} />
            </div>
          </section>

          {pool?.address && status === 1 /* Active */ && (
            <section className="mt-8">
              <CommitForm proposalNode={proposalNode} poolAddress={pool.address} />
            </section>
          )}

          {pr && (
            <section className="mt-8">
              <MyCommitment proposalNode={proposalNode} status={status} deadline={pr.deadline} />
            </section>
          )}

          {status === 2 /* Executing */ && pr && (
            <section className="mt-8">
              <AttestButton
                proposalNode={proposalNode}
                attestationCount={pr.attestationCount}
                attestationThreshold={pr.attestationThreshold}
              />
            </section>
          )}

          {pr?.resourceNode && pr.resourceNode !== `0x${"0".repeat(64)}` && (
            <section className="mt-8">
              <ResourceCard resourceNode={pr.resourceNode as `0x${string}`} />
            </section>
          )}

          {pr && (status === 2 || status === 3) && (
            <section className="mt-8">
              <ExecutorPanel
                proposalNode={proposalNode}
                executor={pr.executor as `0x${string}`}
                milestoneReleased={pr.milestoneReleased}
                attestedAt={pr.attestedAt}
                warrantyDuration={pr.warrantyDuration}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Milestone({ label, released }: { label: string; released: boolean }) {
  return (
    <div className={`p-3 rounded-lg border ${released ? "border-primary bg-primary/10" : "border-base-300"}`}>
      <div className="text-xs opacity-70">{released ? "RELEASED" : "PENDING"}</div>
      <div className="mt-1">{label}</div>
    </div>
  );
}
