"use client";

import { use } from "react";
import Link from "next/link";
import { namehash } from "viem/ens";
import { CreateNeighborhoodButton } from "~~/components/CreateNeighborhoodButton";
import { CreateProposalForm } from "~~/components/CreateProposalForm";
import { JoinNeighborhoodButton } from "~~/components/JoinNeighborhoodButton";
import { MemberRow } from "~~/components/MemberRow";
import { NeighborhoodDescription } from "~~/components/NeighborhoodDescription";
import { ResourceRow } from "~~/components/ResourceRow";
import { ENSName, NamehashChip, SectionHead } from "~~/components/obec";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

type Params = { city: string; neighborhood: string };

export default function NeighborhoodPage({ params }: { params: Promise<Params> }) {
  const { city, neighborhood } = use(params);
  const fullName = `${neighborhood}.${city}.${PROTOCOL_ROOT}`;
  const neighborhoodId = namehash(fullName);

  const { data: hood } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "neighborhoods",
    args: [neighborhoodId],
  });

  const { data: memberNodes } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNeighborhoodMembers",
    args: [neighborhoodId],
  });

  const { data: resourceNodes } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNeighborhoodResources",
    args: [neighborhoodId],
  });

  const exists = hood && Array.isArray(hood) && hood[3] === true;
  const admin = exists ? (hood[2] as `0x${string}`) : undefined;
  const memberCount = Array.isArray(memberNodes) ? memberNodes.length : 0;
  const resourceCount = Array.isArray(resourceNodes) ? resourceNodes.length : 0;

  return (
    <div className="flex flex-col grow">
      {/* Breadcrumb */}
      <div className="px-6 sm:px-12 lg:px-14 pt-8">
        <div className="ens flex items-center gap-2" style={{ fontSize: 12 }}>
          <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            home
          </Link>
          <span className="ens-dot">/</span>
          <span style={{ color: "var(--ink-3)", textTransform: "lowercase" }}>{city}</span>
          <span className="ens-dot">/</span>
          <span className="ens-self">{neighborhood}</span>
        </div>
      </div>

      {/* Masthead */}
      <section className="px-6 sm:px-12 lg:px-14 pt-12 lg:pt-20 pb-12 lg:pb-16 relative">
        <div className="glow inline-block" style={{ padding: "20px 40px", margin: "-20px -40px" }}>
          <div className="micro" style={{ marginBottom: 20 }}>
            Neighborhood register&nbsp;·&nbsp;
            <span style={{ color: "var(--ink)" }}>{exists ? "active" : "not yet created"}</span>
          </div>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(72px, 14vw, 156px)",
              margin: 0,
              fontWeight: 400,
              letterSpacing: "-0.04em",
              lineHeight: 0.9,
              color: "var(--ink)",
              textTransform: "lowercase",
            }}
          >
            {neighborhood}
            <span style={{ color: "var(--terracotta)" }}>.</span>
          </h1>
        </div>
        <div className="mt-6 flex items-baseline gap-4 flex-wrap">
          <span className="ens" style={{ fontSize: 13 }}>
            <span className="ens-self">{neighborhood}</span>
            <span className="ens-dot">.</span>
            <span className="ens-parent">{city}</span>
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

        {!exists ? (
          <div className="mt-10 p-6 max-w-xl" style={{ border: "1px solid var(--hair)", borderRadius: 4 }}>
            <p style={{ fontSize: 17, color: "var(--ink-2)", margin: 0 }}>This neighborhood doesn&apos;t exist yet.</p>
            <p style={{ fontSize: 14, color: "var(--ink-3)", marginTop: 8, marginBottom: 0 }}>
              Anyone can create it onchain. The first creator becomes admin.
            </p>
            <CreateNeighborhoodButton city={city} neighborhood={neighborhood} />
          </div>
        ) : (
          <>
            <div className="mt-6" style={{ fontSize: 13, color: "var(--ink-3)" }}>
              admin&nbsp;·&nbsp;
              <ENSName address={admin} size="sm" />
            </div>
            <NeighborhoodDescription neighborhoodId={neighborhoodId} admin={admin} />
            <JoinNeighborhoodButton neighborhoodId={neighborhoodId} city={city} neighborhood={neighborhood} />
          </>
        )}
      </section>

      {exists && (
        <>
          {/* Stats band */}
          <section
            className="grid grid-cols-2 lg:grid-cols-4"
            style={{ borderTop: "1px solid var(--hair)", borderBottom: "1px solid var(--hair)" }}
          >
            {[
              { n: String(memberCount), l: "members", sub: "subnames issued" },
              { n: String(resourceCount), l: "pools", sub: "across this neighborhood" },
              { n: "—", l: "pooled", sub: "across treasury & milestones" },
              { n: "—", l: "active drives", sub: "fundraising right now" },
            ].map((s, i, arr) => (
              <div
                key={s.l}
                style={{
                  padding: "28px 32px",
                  borderRight: i < arr.length - 1 ? "1px solid var(--hair)" : "none",
                }}
              >
                <div
                  className="serif num"
                  style={{ fontSize: 42, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em" }}
                >
                  {s.n}
                </div>
                <div className="micro" style={{ marginTop: 10, fontSize: 11 }}>
                  {s.l}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 6 }}>{s.sub}</div>
              </div>
            ))}
          </section>

          {/* The commons */}
          <section className="px-6 sm:px-12 lg:px-14 pt-16 pb-20">
            <SectionHead
              num="03"
              right={
                <span className="micro">
                  {resourceCount} {resourceCount === 1 ? "pool" : "pools"}
                </span>
              }
            >
              The commons
            </SectionHead>
            <div className="mt-9">
              {!resourceNodes || resourceCount === 0 ? (
                <p className="mt-6" style={{ color: "var(--ink-3)", fontSize: 14 }}>
                  No proposals yet.
                </p>
              ) : (
                resourceNodes.map((node, i) => (
                  <ResourceRow
                    key={node}
                    node={node as `0x${string}`}
                    city={city}
                    neighborhood={neighborhood}
                    index={i}
                  />
                ))
              )}
            </div>
            <CreateProposalForm neighborhoodId={neighborhoodId} city={city} neighborhood={neighborhood} />
          </section>

          {/* Members + Wire */}
          <section className="px-6 sm:px-12 lg:px-14 pb-24 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-20">
            <div>
              <SectionHead num="04" right={<span className="micro">{memberCount} subnames</span>}>
                Members
              </SectionHead>
              <div className="arena-index mt-5">
                {!memberNodes || memberCount === 0 ? (
                  <p style={{ color: "var(--ink-3)", fontSize: 14, gridColumn: "1 / -1" }}>No members yet.</p>
                ) : (
                  memberNodes.map(node => <MemberRow key={node} node={node as `0x${string}`} />)
                )}
              </div>
            </div>

            <div>
              <SectionHead num="05" right={<span className="micro">live</span>}>
                Wire
              </SectionHead>
              <div className="mt-5">
                <div
                  style={{
                    padding: "14px 0",
                    borderTop: "1px solid var(--ink)",
                    fontSize: 13,
                    color: "var(--ink-3)",
                  }}
                >
                  Wire feed will populate from on-chain events once the indexer is wired.
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
