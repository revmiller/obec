"use client";

import { useState } from "react";
import Link from "next/link";
import type { NextPage } from "next";
import { LinkButton, SectionHead } from "~~/components/obec";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

const SEEDED_CITIES: City[] = [
  {
    id: "prague",
    name: "Prague",
    status: "live",
    neighborhoods: 1,
    members: 15,
    pools: 6,
    tvl: 19100,
    blurb: "First neighborhood: Vinohrady. Three more in conversation across Karlín, Smíchov, Žižkov.",
    href: "/prague/vinohrady",
  },
  { id: "berlin", name: "Berlin", status: "pending" },
  { id: "lisbon", name: "Lisbon", status: "pending" },
];

const WIRE: WireItem[] = [
  {
    t: "4m",
    who: "tomas",
    verb: "committed 200 USDC to",
    what: "cargo-bikes",
    body: "Pool now at 38 of 50 backers. Threshold 91% reached; closes in three days.",
  },
  {
    t: "1h",
    who: "eliska",
    verb: "proposed",
    what: "community sauna · Korunní 32",
    body: "Twelve-household coalition. Seeking 6,000 USDC for the timber and stove. Twenty-day window.",
  },
  {
    t: "3h",
    who: "anna",
    verb: "released milestone 02 of",
    what: "repair-cafe",
    body: "Tools delivered, signed receipts on chain. Treasury releases 1,200 USDC of the remaining 1,800.",
  },
];

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

type City = {
  id: string;
  name: string;
  status: "live" | "pending";
  neighborhoods?: number;
  members?: number;
  pools?: number;
  tvl?: number;
  blurb?: string;
  href?: string;
};

type WireItem = { t: string; who: string; verb: string; what: string; body: string };

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

  const totalPooled = SEEDED_CITIES.reduce((acc, c) => acc + (c.tvl ?? 0), 0);
  const totalMembers = SEEDED_CITIES.reduce((acc, c) => acc + (c.members ?? 0), 0);
  const totalPools = SEEDED_CITIES.reduce((acc, c) => acc + (c.pools ?? 0), 0);
  const liveCities = SEEDED_CITIES.filter(c => c.status === "live");

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
            <LinkButton href="/prague/vinohrady" size="lg" arrow>
              Browse neighborhoods
            </LinkButton>
          </div>

          <div
            className="mt-12 grid grid-cols-2 gap-x-14 gap-y-1.5"
            style={{ fontSize: 14, color: "var(--ink-2)", maxWidth: 480 }}
          >
            <span>${totalPooled.toLocaleString()} pooled</span>
            <span>
              {liveCities.length} city · {liveCities[0]?.name ?? "—"}
            </span>
            <span>{totalMembers} members</span>
            <span>{totalPools} active pools</span>
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
          <SectionHead
            num="01"
            right={
              <span className="micro">
                {SEEDED_CITIES.length} federated · {liveCities.length} live
              </span>
            }
          >
            Cities
          </SectionHead>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
          {SEEDED_CITIES.map((c, i) => (
            <CityCard key={c.id} city={c} index={i} />
          ))}
        </div>
      </section>

      {/* From the wire */}
      <section className="px-6 sm:px-12 lg:px-24 pb-24 lg:pb-28">
        <div className="mb-12">
          <SectionHead num="02" right={<span className="micro">live</span>}>
            From the wire
          </SectionHead>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 lg:gap-14">
          {WIRE.map((a, i) => (
            <article key={i} style={{ borderTop: "1px solid var(--ink)", paddingTop: 18 }}>
              <div className="micro" style={{ fontSize: 11 }}>
                {a.t} ago&nbsp;·&nbsp;vinohrady.prague
              </div>
              <h4
                className="serif"
                style={{
                  fontSize: 22,
                  fontWeight: 400,
                  lineHeight: 1.25,
                  margin: "14px 0 0",
                  letterSpacing: "-0.015em",
                }}
              >
                {a.who}
                <span style={{ color: "var(--ink-3)", fontStyle: "italic" }}>&nbsp;{a.verb}&nbsp;</span>
                <em style={{ fontStyle: "italic" }}>{a.what}</em>
              </h4>
              <p style={{ fontSize: 14.5, color: "var(--ink-2)", marginTop: 14, lineHeight: 1.5 }}>{a.body}</p>
            </article>
          ))}
        </div>
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

function CityCard({ city: c, index: i }: { city: City; index: number }) {
  const live = c.status === "live";
  const inner = (
    <article style={{ position: "relative" }}>
      <div className="num-tag" style={{ marginBottom: 18, fontSize: 11, letterSpacing: "0.04em" }}>
        No.&nbsp;0{i + 1}
      </div>
      <h3
        className="serif"
        style={{ fontSize: 56, margin: 0, fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 0.95 }}
      >
        {c.name.toLowerCase()}
      </h3>
      <div className="ens mt-3.5" style={{ fontSize: 12 }}>
        <span className="ens-self">{c.id}</span>
        <span className="ens-dot">.</span>
        <span className="ens-tld">{PROTOCOL_ROOT}</span>
      </div>
      {live ? (
        <>
          <p style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 22, lineHeight: 1.45, maxWidth: 320 }}>
            {c.blurb}
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 32, fontSize: 13, color: "var(--ink-2)" }}>
            <span>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{c.neighborhoods}</span> hood
            </span>
            <span>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{c.members}</span> members
            </span>
            <span>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>${((c.tvl ?? 0) / 1000).toFixed(1)}k</span> pooled
            </span>
          </div>
          <div style={{ marginTop: 28 }}>
            <span
              style={{
                fontSize: 14,
                color: "var(--ink)",
                borderBottom: "1px solid var(--ink)",
                paddingBottom: 1,
              }}
            >
              Enter {c.name} →
            </span>
          </div>
        </>
      ) : (
        <>
          <p
            style={{
              fontSize: 15,
              color: "var(--ink-3)",
              marginTop: 22,
              lineHeight: 1.45,
              maxWidth: 320,
              fontStyle: "italic",
            }}
          >
            Awaiting first neighborhood.
          </p>
          <div style={{ marginTop: 28 }}>
            <span
              style={{
                fontSize: 13,
                color: "var(--ink-3)",
                borderBottom: "1px solid var(--hair)",
                paddingBottom: 1,
              }}
            >
              Claim {c.id}.{PROTOCOL_ROOT} →
            </span>
          </div>
        </>
      )}
    </article>
  );

  if (live && c.href) {
    return (
      <Link href={c.href} style={{ textDecoration: "none", color: "inherit" }}>
        {inner}
      </Link>
    );
  }
  return inner;
}

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
