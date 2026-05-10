"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { ConnectPrompt } from "~~/components/ConnectPrompt";
import { NetworkGuard } from "~~/components/NetworkGuard";
import { Button, NamehashChip, SectionHead } from "~~/components/obec";
import { useScaffoldEventHistory, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

const LABEL_RE = /^[a-z0-9-]+$/;

type Params = { city: string };

export default function CityPage({ params }: { params: Promise<Params> }) {
  const { city } = use(params);
  const cityFull = `${city}.${PROTOCOL_ROOT}`;

  const { data: createdEvents, isLoading: eventsLoading } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "NeighborhoodCreated",
    fromBlock: undefined,
    watch: true,
  });

  const neighborhoods = useMemo(() => {
    if (!createdEvents) return [] as { id: `0x${string}`; name: string; admin: `0x${string}` }[];
    const out: { id: `0x${string}`; name: string; admin: `0x${string}`; blockNumber: bigint }[] = [];
    const seen = new Set<string>();
    for (const e of createdEvents) {
      const args = (e.args ?? {}) as {
        city?: string;
        name?: string;
        admin?: `0x${string}`;
        neighborhoodId?: `0x${string}`;
      };
      if (!args.city || args.city.toLowerCase() !== city.toLowerCase()) continue;
      if (!args.neighborhoodId || seen.has(args.neighborhoodId)) continue;
      seen.add(args.neighborhoodId);
      out.push({
        id: args.neighborhoodId,
        name: args.name ?? "(unknown)",
        admin: args.admin ?? "0x0000000000000000000000000000000000000000",
        blockNumber: BigInt(e.blockNumber ?? 0),
      });
    }
    out.sort((a, b) => (b.blockNumber > a.blockNumber ? 1 : -1));
    return out;
  }, [createdEvents, city]);

  return (
    <div className="flex flex-col grow">
      {/* Breadcrumb */}
      <div className="px-6 sm:px-12 lg:px-14 pt-8">
        <div className="ens flex items-center gap-2" style={{ fontSize: 12 }}>
          <Link href="/" style={{ color: "var(--ink-3)", textDecoration: "none" }}>
            home
          </Link>
          <span className="ens-dot">/</span>
          <span className="ens-self">{city}</span>
        </div>
      </div>

      {/* Masthead */}
      <section className="px-6 sm:px-12 lg:px-14 pt-12 lg:pt-20 pb-12 lg:pb-16 relative">
        <div className="glow inline-block" style={{ padding: "20px 40px", margin: "-20px -40px" }}>
          <div className="micro" style={{ marginBottom: 20 }}>
            City&nbsp;·&nbsp;
            <span style={{ color: "var(--ink)" }}>
              {eventsLoading
                ? "checking…"
                : `${neighborhoods.length} neighborhood${neighborhoods.length === 1 ? "" : "s"}`}
            </span>
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
            {city}
            <span style={{ color: "var(--terracotta)" }}>.</span>
          </h1>
        </div>
        <div className="mt-6 flex items-baseline gap-4 flex-wrap">
          <span className="ens" style={{ fontSize: 13 }}>
            <span className="ens-self">{city}</span>
            <span className="ens-dot">.</span>
            {PROTOCOL_ROOT.split(".").map((part, i, arr) => (
              <span key={i}>
                <span className={i === arr.length - 1 ? "ens-tld" : "ens-parent"}>{part}</span>
                {i < arr.length - 1 && <span className="ens-dot">.</span>}
              </span>
            ))}
          </span>
          <span style={{ width: 1, height: 12, background: "var(--hair)" }} />
          <NamehashChip name={cityFull} />
        </div>
      </section>

      {/* Existing neighborhoods */}
      <section className="px-6 sm:px-12 lg:px-14 pb-12">
        <SectionHead num="01" right={<span className="micro">{neighborhoods.length} live</span>}>
          Neighborhoods
        </SectionHead>
        <div className="mt-9">
          {eventsLoading && neighborhoods.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Loading registry…</p>
          ) : neighborhoods.length === 0 ? (
            <p style={{ color: "var(--ink-3)", fontSize: 14 }}>No neighborhoods yet in {city}. Be the first.</p>
          ) : (
            neighborhoods.map((n, i) => (
              <Link
                key={n.id}
                href={`/${city}/${n.name}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                <article
                  className="grid items-center gap-6 grid-cols-[40px_1fr_120px]"
                  style={{
                    padding: "26px 0",
                    borderTop: i === 0 ? "1px solid var(--ink)" : "1px solid var(--hair)",
                  }}
                >
                  <div className="num-tag" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    0{i + 1}
                  </div>
                  <div>
                    <h3
                      className="serif"
                      style={{ fontSize: 32, margin: 0, fontWeight: 400, letterSpacing: "-0.025em", lineHeight: 1.05 }}
                    >
                      {n.name}
                    </h3>
                    <div className="ens mt-2" style={{ fontSize: 11 }}>
                      <span className="ens-self">{n.name}</span>
                      <span className="ens-parent">.{city}.</span>
                      {PROTOCOL_ROOT.split(".").map((part, idx, arr) => (
                        <span key={idx}>
                          <span className={idx === arr.length - 1 ? "ens-tld" : "ens-parent"}>{part}</span>
                          {idx < arr.length - 1 && <span className="ens-dot">.</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        borderBottom: "1px solid var(--ink)",
                        paddingBottom: 1,
                      }}
                    >
                      Enter →
                    </span>
                  </div>
                </article>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Create new */}
      <section className="px-6 sm:px-12 lg:px-14 pb-24">
        <SectionHead num="02" right={<span className="micro">open</span>}>
          Open a new neighborhood
        </SectionHead>
        <div className="mt-9 max-w-xl">
          <CreateInline city={city} existingNames={new Set(neighborhoods.map(n => n.name))} />
        </div>
      </section>
    </div>
  );
}

function CreateInline({ city, existingNames }: { city: string; existingNames: Set<string> }) {
  const { address } = useAccount();
  const [label, setLabel] = useState("");
  const { writeContractAsync, isPending } = useScaffoldWriteContract({ contractName: "ObecRegistry" });

  const trimmed = label.trim().toLowerCase();
  const valid = trimmed.length >= 2 && trimmed.length <= 32 && LABEL_RE.test(trimmed);
  const taken = valid && existingNames.has(trimmed);
  const fullName = trimmed ? `${trimmed}.${city}.${PROTOCOL_ROOT}` : `<label>.${city}.${PROTOCOL_ROOT}`;

  if (!address) {
    return <ConnectPrompt message="Connect a wallet to open a neighborhood." />;
  }

  return (
    <div style={{ border: "1px solid var(--hair)", borderRadius: 4, padding: 24 }}>
      <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>
        Anyone can open a neighborhood under {city}. The first creator becomes admin.
      </p>
      <label className="mt-4 block">
        <span className="micro" style={{ display: "block", marginBottom: 6, fontSize: 11 }}>
          Neighborhood label
        </span>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. vinohrady"
          spellCheck={false}
          autoComplete="off"
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--hair)",
            background: "var(--paper)",
            fontSize: 16,
            color: "var(--ink)",
            outline: "none",
          }}
        />
      </label>
      <div className="ens mt-3" style={{ fontSize: 11, color: "var(--ink-3)" }}>
        will resolve as {fullName}
      </div>
      {trimmed && !valid && (
        <p style={{ color: "var(--terracotta)", fontSize: 13, marginTop: 10 }}>
          Use 2–32 lowercase letters, digits, or hyphens.
        </p>
      )}
      {taken && (
        <p style={{ color: "var(--terracotta)", fontSize: 13, marginTop: 10 }}>That name is already taken in {city}.</p>
      )}
      <div className="mt-5">
        <NetworkGuard targetChainId={STATE_CHAIN_ID}>
          <Button
            disabled={!valid || taken || isPending}
            arrow
            onClick={() =>
              writeContractAsync({
                functionName: "createNeighborhood",
                args: [city, trimmed],
              })
            }
          >
            {isPending ? "Creating…" : "Create neighborhood"}
          </Button>
        </NetworkGuard>
      </div>
    </div>
  );
}
