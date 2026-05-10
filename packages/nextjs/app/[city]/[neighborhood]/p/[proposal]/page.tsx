"use client";

import { use } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { namehash } from "viem/ens";
import { AttestButton } from "~~/components/AttestButton";
import { CommitForm } from "~~/components/CommitForm";
import { ExecutorPanel } from "~~/components/ExecutorPanel";
import { MyCommitment } from "~~/components/MyCommitment";
import { ResourceCard } from "~~/components/ResourceCard";
import { ShareButton } from "~~/components/ShareButton";
import { ENSName, NamehashChip, Pill, SectionHead } from "~~/components/obec";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const USDC_DECIMALS = 6;

const STATUS_LABEL = ["None", "Active", "Executing", "Completed", "Expired", "Disputed"] as const;
type StatusKey = (typeof STATUS_LABEL)[number];

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
    contractName: "ObecRegistry",
    functionName: "getText",
    args: [proposalNode, "description"],
  });

  const { data: pool } = useDeployedContractInfo({ contractName: "CommitmentPool" });

  const loading = pr === undefined;
  const status = Number(pr?.status ?? 0);
  const exists = !loading && status !== 0;
  const statusKey: StatusKey = (STATUS_LABEL[status] as StatusKey) ?? "None";

  const target = pr?.targetAmount ?? 0n;
  const committed = pr?.totalCommitted ?? 0n;
  const targetUsd = Number(formatUnits(target, USDC_DECIMALS));
  const committedUsd = Number(formatUnits(committed, USDC_DECIMALS));
  const progress = target > 0n ? Number((committed * 100n) / target) : 0;

  const memberCount = Number(pr?.memberCount ?? 0n);
  const minMembers = Number(pr?.minMembers ?? 0n);
  const membersNeeded = Math.max(0, minMembers - memberCount);

  const deadlineSec = Number(pr?.deadline ?? 0n);
  const nowSec = Math.floor(Date.now() / 1000);
  const secsUntilDeadline = deadlineSec - nowSec;
  const deadlineLabel = formatDeadline(secsUntilDeadline);

  const isFundraising = status === 1;
  const isExecuting = status === 2;

  return (
    <div className="flex flex-col grow">
      {/* Breadcrumb */}
      <div className="px-6 sm:px-12 lg:px-14 pt-8">
        <div className="ens flex items-center gap-2 flex-wrap" style={{ fontSize: 12 }}>
          <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            home
          </Link>
          <span className="ens-dot">/</span>
          <Link href={`/${city}/${neighborhood}`} style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            {neighborhood}
          </Link>
          <span className="ens-dot">/</span>
          <span className="ens-self">{proposal}</span>
        </div>
      </div>

      {/* Masthead */}
      <section className="px-6 sm:px-12 lg:px-14 pt-10 pb-10">
        <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="micro mb-3" style={{ fontSize: 11 }}>
              {isFundraising ? "Open proposal" : exists ? STATUS_LABEL[status] : "—"}
            </div>
            <h1
              className="serif"
              style={{
                fontSize: "clamp(48px, 8vw, 88px)",
                fontWeight: 400,
                letterSpacing: "-0.035em",
                lineHeight: 0.95,
                margin: 0,
                textTransform: "lowercase",
              }}
            >
              {proposal.replace(/-/g, " ")}
            </h1>
            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              <span className="ens" style={{ fontSize: 12 }}>
                <span className="ens-self">{proposal}</span>
                <span className="ens-parent">
                  .{neighborhood}.{city}
                </span>
                <span className="ens-dot">.</span>
                {PROTOCOL_ROOT.split(".").map((part, i, arr) => (
                  <span key={i}>
                    <span className={i === arr.length - 1 ? "ens-tld" : "ens-parent"}>{part}</span>
                    {i < arr.length - 1 && <span className="ens-dot">.</span>}
                  </span>
                ))}
              </span>
              <span style={{ width: 1, height: 12, background: "var(--hair)" }} />
              <NamehashChip name={fullName} />
            </div>
          </div>
          {exists && <ShareButton label="Share" />}
        </div>

        {exists && (
          <div className="mt-6">
            {statusKey === "Active" && (
              <Pill tone="terracotta" dot>
                fundraising · {deadlineLabel}
              </Pill>
            )}
            {statusKey === "Executing" && (
              <Pill tone="moss" dot>
                executing
              </Pill>
            )}
            {statusKey === "Completed" && (
              <Pill tone="moss" dot>
                completed
              </Pill>
            )}
            {statusKey === "Expired" && <Pill>expired</Pill>}
            {statusKey === "Disputed" && (
              <Pill tone="terracotta" dot>
                disputed
              </Pill>
            )}
          </div>
        )}
      </section>

      {loading ? (
        <div className="px-6 sm:px-12 lg:px-14 pb-16" style={{ color: "var(--ink-3)", fontSize: 14 }}>
          Loading…
        </div>
      ) : !exists ? (
        <section
          className="mx-6 sm:mx-12 lg:mx-14 mb-20 p-8 max-w-2xl"
          style={{ border: "1px solid var(--hair)", borderRadius: 4 }}
        >
          <p style={{ fontSize: 17, color: "var(--ink-2)", margin: 0 }}>This proposal doesn&apos;t exist yet.</p>
          <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8, marginBottom: 0 }}>
            A neighborhood member can create it from the neighborhood page.
          </p>
        </section>
      ) : (
        <>
          {/* Two-column: narrative + commit */}
          <section className="px-6 sm:px-12 lg:px-14 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10 lg:gap-16 items-start">
            <div>
              {description && (
                <p
                  className="serif"
                  style={{
                    fontSize: 19,
                    color: "var(--ink-2)",
                    lineHeight: 1.55,
                    letterSpacing: "-0.005em",
                    maxWidth: 620,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {description}
                </p>
              )}

              {/* Stats grid */}
              <div className="mt-10 grid grid-cols-2 gap-y-6 gap-x-10" style={{ maxWidth: 620 }}>
                <Stat label="Pool target">
                  <span className="serif num" style={{ fontSize: 28, fontWeight: 400 }}>
                    ${targetUsd.toLocaleString()}
                  </span>
                </Stat>
                <Stat label={isFundraising ? `${progress}% committed` : "Committed"}>
                  <span className="serif num" style={{ fontSize: 28, fontWeight: 400 }}>
                    ${committedUsd.toLocaleString()}
                  </span>
                </Stat>
                <Stat label="Members">
                  <span className="serif num" style={{ fontSize: 28, fontWeight: 400 }}>
                    {memberCount} <span style={{ color: "var(--ink-3)", fontSize: 16 }}>/ {minMembers}</span>
                  </span>
                  {membersNeeded > 0 && (
                    <span style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, display: "block" }}>
                      {membersNeeded} more to minimum
                    </span>
                  )}
                </Stat>
                <Stat label="Deadline">
                  <span className="serif num" style={{ fontSize: 28, fontWeight: 400 }}>
                    {deadlineLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4, display: "block" }}>
                    {pr ? new Date(deadlineSec * 1000).toLocaleString() : "—"}
                  </span>
                </Stat>
                <Stat label="Executor">
                  <ENSName address={pr?.executor as `0x${string}` | undefined} size="md" />
                </Stat>
                <Stat label="Warranty">
                  <span style={{ fontSize: 14 }}>
                    {pr?.warrantyDuration ? `${pr.warrantyDuration.toString()} seconds` : "—"}
                  </span>
                </Stat>
              </div>

              {/* Milestones */}
              <div className="mt-14">
                <SectionHead num="01">Milestones</SectionHead>
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Milestone
                    label="On threshold"
                    pct={30}
                    released={pr?.milestoneReleased?.[0] ?? false}
                    note="Released the moment threshold tips."
                  />
                  <Milestone
                    label="On attestations"
                    pct={50}
                    released={pr?.milestoneReleased?.[1] ?? false}
                    note="Released after attestation quorum."
                  />
                  <Milestone
                    label="Post-warranty"
                    pct={20}
                    released={pr?.milestoneReleased?.[2] ?? false}
                    note="Released after warranty window."
                  />
                </div>
              </div>

              {pr && (
                <div className="mt-12">
                  <MyCommitment proposalNode={proposalNode} status={status} deadline={pr.deadline} />
                </div>
              )}

              {isExecuting && pr && (
                <div className="mt-12">
                  <AttestButton
                    proposalNode={proposalNode}
                    attestationCount={pr.attestationCount}
                    attestationThreshold={pr.attestationThreshold}
                  />
                </div>
              )}

              {pr && status !== 4 && (
                <div className="mt-12">
                  <SectionHead num="02">ENS records</SectionHead>
                  <div className="mt-6">
                    <ResourceCard projectNode={proposalNode} />
                  </div>
                </div>
              )}

              {pr && (status === 2 || status === 3) && (
                <div className="mt-12">
                  <ExecutorPanel
                    proposalNode={proposalNode}
                    executor={pr.executor as `0x${string}`}
                    milestoneReleased={pr.milestoneReleased}
                    attestedAt={pr.attestedAt}
                    warrantyDuration={pr.warrantyDuration}
                  />
                </div>
              )}
            </div>

            {/* Sticky commit panel */}
            {pool?.address && isFundraising && (
              <aside className="lg:sticky lg:top-8">
                <CommitForm
                  proposalNode={proposalNode}
                  poolAddress={pool.address}
                  target={target}
                  committed={committed}
                />
              </aside>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="micro" style={{ fontSize: 11, marginBottom: 6 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Milestone({ label, pct, released, note }: { label: string; pct: number; released: boolean; note: string }) {
  return (
    <div
      style={{
        padding: 18,
        border: "1px solid var(--hair)",
        borderRadius: 4,
        background: released ? "var(--paper-2)" : "var(--paper)",
      }}
    >
      <div className="flex items-baseline justify-between">
        <span className="micro" style={{ fontSize: 11 }}>
          {released ? "released" : "pending"}
        </span>
        <span className="num-tag" style={{ fontSize: 11 }}>
          {pct}%
        </span>
      </div>
      <div className="serif mt-2" style={{ fontSize: 18, fontWeight: 400, letterSpacing: "-0.015em" }}>
        {label}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6, marginBottom: 0, lineHeight: 1.45 }}>{note}</p>
    </div>
  );
}

function formatDeadline(secs: number): string {
  if (secs <= 0) return "passed";
  const days = Math.floor(secs / 86400);
  if (days >= 2) return `${days} days`;
  const hours = Math.floor(secs / 3600);
  if (hours >= 2) return `${hours} hours`;
  const minutes = Math.floor(secs / 60);
  if (minutes >= 1) return `${minutes} minutes`;
  return `${secs} seconds`;
}
