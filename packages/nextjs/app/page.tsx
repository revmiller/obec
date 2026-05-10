"use client";

import { useState } from "react";
import type { NextPage } from "next";
import { type Hex, formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { CitiesIndex } from "~~/components/CitiesIndex";
import { GlobalWireFeed } from "~~/components/GlobalWireFeed";
import { LinkButton, SectionHead } from "~~/components/obec";
import { useDeployedContractInfo, useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const USDC_DECIMALS = 6;
const STATUS_ACTIVE = 1;
const STATUS_EXECUTING = 2;

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString()}`;
}

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What does obec do, exactly?",
    a: "Obec is an ENS-native protocol for neighborhood-scale commons. Neighbors pool USDC against a threshold; pools either ship or refund automatically. Every member, neighborhood, city and resource gets its own subname under obec.eth.",
  },
  {
    q: "How does the threshold-and-refund work?",
    a: "Each proposal sets a target USDC amount and a deadline. Funds sit in escrow. If the threshold is met by the deadline, 30% releases on funding, 50% on attested completion, and 20% after a warranty window. If not met, every backer can withdraw their stake — no execution.",
  },
  {
    q: "Why ENS subnames for every member and resource?",
    a: "Subnames are the addressable surface of the commons. A member's identity, a resource's records (image, location, treasury), and a neighborhood's roster all resolve through ENS — readable, portable, and verifiable from any wallet.",
  },
  {
    q: "Who holds the treasury?",
    a: "The CommitmentPool contract holds escrow until the state machine releases. Members attest milestones; an executor signs payouts. There is no admin escape hatch on funded pools.",
  },
  {
    q: "Can I start a neighborhood in my city?",
    a: "Yes. Anyone can open a neighborhood — the first creator becomes its admin. New cities federate by registering under obec.eth and seeding at least one neighborhood.",
  },
  {
    q: "How are milestones released?",
    a: "Milestone 0 (30%) releases atomically the moment a pool tips its threshold. Milestone 1 (50%) releases once the attestation quorum confirms completion. Milestone 2 (20%) releases after the warranty window with no active disputes.",
  },
];

const Home: NextPage = () => {
  const { data: rootNamehash } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "PROTOCOL_ROOT_NAMEHASH",
  });
  const { data: federatedCities } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getText",
    args: rootNamehash ? [rootNamehash, "cities"] : [undefined, undefined],
  });

  // Discover live cities + counts from registry events to drive the hero strip.
  const { data: createdEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "NeighborhoodCreated",
    fromBlock: undefined,
    watch: true,
  });
  const { data: joinedEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "MemberJoined",
    fromBlock: undefined,
    watch: true,
  });
  const { data: registeredEvents } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "ResourceRegistered",
    fromBlock: undefined,
    watch: true,
  });

  const liveCitySet = new Set<string>();
  if (createdEvents) {
    for (const e of createdEvents) {
      const c = (e.args as { city?: string } | undefined)?.city?.toLowerCase();
      if (c) liveCitySet.add(c);
    }
  }
  const totalMembers = joinedEvents?.length ?? 0;
  const firstCity = Array.from(liveCitySet)[0];
  const fallbackCity = (() => {
    if (typeof federatedCities === "string" && federatedCities.trim()) {
      return federatedCities.split(",")[0].trim().toLowerCase();
    }
    return "prague";
  })();
  const ctaCity = firstCity ?? fallbackCity;

  // Multicall every project resource to derive pooled USDC + active count
  // straight from contract state. Post-unification every registered resource
  // is a project pool, so no type filter needed.
  const proposalNodes: Hex[] =
    registeredEvents
      ?.map(e => (e.args as { resourceNode?: Hex } | undefined)?.resourceNode)
      .filter((n): n is Hex => !!n) ?? [];

  const { data: pool } = useDeployedContractInfo({
    contractName: "CommitmentPool",
    chainId: STATE_CHAIN_ID,
  });

  const { data: proposalTuples } = useReadContracts({
    contracts: proposalNodes.map(node => ({
      address: pool?.address,
      abi: pool?.abi,
      functionName: "getProposal",
      args: [node],
      chainId: STATE_CHAIN_ID,
    })) as any,
    query: { enabled: !!pool && proposalNodes.length > 0 },
  });

  let pooledRaw = 0n;
  let activePools = 0;
  if (proposalTuples) {
    for (const p of proposalTuples) {
      const prop = p.result as { totalCommitted?: bigint; status?: number | bigint } | undefined;
      if (!prop) continue;
      pooledRaw += prop.totalCommitted ?? 0n;
      const s = Number(prop.status ?? 0);
      if (s === STATUS_ACTIVE || s === STATUS_EXECUTING) activePools += 1;
    }
  }
  const pooledUsd = Number(formatUnits(pooledRaw, USDC_DECIMALS));

  return (
    <div className="flex flex-col grow">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_560px] gap-10 lg:gap-20 items-center px-6 sm:px-12 lg:px-24 py-20 lg:py-32">
        <div>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(72px, 13vw, 132px)",
              fontWeight: 400,
              letterSpacing: "-0.045em",
              lineHeight: 0.92,
              margin: 0,
              color: "var(--ink)",
            }}
          >
            obec
          </h1>
          <p
            className="mt-6 lg:mt-8"
            style={{
              fontSize: 22,
              lineHeight: 1.35,
              color: "var(--ink)",
              maxWidth: 440,
              fontWeight: 400,
              letterSpacing: "-0.01em",
            }}
          >
            A protocol for the things a block is too small for, and a city too large.
          </p>

          <div className="mt-10 lg:mt-14 flex gap-4 items-center flex-wrap">
            <LinkButton href={`/${ctaCity}`} size="lg" arrow>
              {firstCity ? "Browse neighborhoods" : `Open ${ctaCity}`}
            </LinkButton>
          </div>

          <div
            className="mt-12 grid grid-cols-2 gap-x-14 gap-y-1.5"
            style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 480 }}
          >
            <span>{fmtUsd(pooledUsd)} pooled</span>
            <span>
              {liveCitySet.size} {liveCitySet.size === 1 ? "city" : "cities"}
              {firstCity ? ` · ${firstCity}` : ""}
            </span>
            <span>{totalMembers} members</span>
            <span>
              {activePools} active {activePools === 1 ? "pool" : "pools"}
            </span>
            <span>No subscription</span>
            <span>Built on ENS · Base</span>
          </div>

          {federatedCities ? (
            <div className="mono mt-6" style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: 0 }}>
              text({PROTOCOL_ROOT}, &quot;cities&quot;) → {String(federatedCities)}
            </div>
          ) : null}
        </div>

        {/* Warm-glow visual */}
        <div className="relative h-[420px] lg:h-[520px]">
          <div className="glow absolute inset-0 flex items-center justify-center">
            <div className="text-center relative">
              <div
                className="serif"
                style={{
                  fontSize: "clamp(48px, 6vw, 78px)",
                  fontWeight: 400,
                  letterSpacing: "-0.04em",
                  color: "var(--ink)",
                  lineHeight: 0.95,
                }}
              >
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>cargo bikes</em>
                <br />
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>a tool library</em>
                <br />
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>a courtyard sauna</em>
              </div>
              <div className="mt-8" style={{ fontSize: 14, color: "var(--ink-3)" }}>
                things our wallets can&apos;t hold, alone
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="px-6 sm:px-12 lg:px-24 pb-24 lg:pb-28">
        <div className="mb-12">
          <SectionHead num="01" right={<span className="micro">{liveCitySet.size} live</span>}>
            Cities
          </SectionHead>
        </div>
        <CitiesIndex federated={typeof federatedCities === "string" ? federatedCities : undefined} />
      </section>

      {/* From the wire */}
      <section className="px-6 sm:px-12 lg:px-24 pb-24 lg:pb-28">
        <div className="mb-12">
          <SectionHead num="02" right={<span className="micro">live</span>}>
            From the wire
          </SectionHead>
        </div>
        <GlobalWireFeed limit={3} />
      </section>

      {/* FAQ */}
      <section className="px-6 sm:px-12 lg:px-24 pb-32 lg:pb-36 grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-10 lg:gap-20 items-start">
        <h2 className="serif" style={{ fontSize: 56, margin: 0, fontWeight: 400, letterSpacing: "-0.035em" }}>
          FAQ
        </h2>
        <div>
          {FAQ_ITEMS.map((item, i) => (
            <FaqRow key={i} q={item.q} a={item.a} />
          ))}
        </div>
      </section>
    </div>
  );
};

function FaqRow({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(v => !v)}
      className={`faq-row ${open ? "open" : ""}`}
      style={{
        background: "transparent",
        border: 0,
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
      }}
    >
      <span style={{ flex: 1 }}>
        <span style={{ display: "block" }}>{q}</span>
        {open && (
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-2)",
              marginTop: 14,
              marginBottom: 4,
              lineHeight: 1.5,
              maxWidth: 640,
            }}
          >
            {a}
          </p>
        )}
      </span>
      <span className="plus" aria-hidden>
        +
      </span>
    </button>
  );
}

export default Home;
