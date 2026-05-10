"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";

type CityRow = {
  city: string;
  neighborhoodCount: number;
  firstNeighborhood?: string;
};

/**
 * Cities are discovered from `NeighborhoodCreated` events. Counts and "first"
 * names are derived live — no seeded data. The `federatedCities` text record
 * (set by the registry owner) can list cities that haven't yet seeded a hood;
 * those render as pending.
 */
export function CitiesIndex({ federated }: { federated?: string }) {
  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "ObecRegistry",
    eventName: "NeighborhoodCreated",
    fromBlock: undefined,
    watch: true,
  });

  const cities = useMemo<CityRow[]>(() => {
    const counts = new Map<string, { count: number; first?: string; firstBlock: bigint }>();
    if (events) {
      for (const e of events) {
        const args = (e.args ?? {}) as { city?: string; name?: string };
        const c = args.city?.toLowerCase();
        if (!c) continue;
        const existing = counts.get(c) ?? { count: 0, first: undefined, firstBlock: 2n ** 256n - 1n };
        existing.count += 1;
        const block = BigInt(e.blockNumber ?? 0);
        if (block < existing.firstBlock) {
          existing.firstBlock = block;
          existing.first = args.name;
        }
        counts.set(c, existing);
      }
    }

    // Pull in pending cities from the federated text record, if any.
    if (federated) {
      for (const raw of federated.split(",")) {
        const c = raw.trim().toLowerCase();
        if (c && !counts.has(c)) counts.set(c, { count: 0, first: undefined, firstBlock: 0n });
      }
    }

    return Array.from(counts.entries())
      .map(([city, v]) => ({
        city,
        neighborhoodCount: v.count,
        firstNeighborhood: v.first,
      }))
      .sort((a, b) => b.neighborhoodCount - a.neighborhoodCount || a.city.localeCompare(b.city));
  }, [events, federated]);

  if (isLoading && cities.length === 0) {
    return <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Loading registry…</p>;
  }
  if (cities.length === 0) {
    return (
      <p style={{ color: "var(--ink-3)", fontSize: 14, fontStyle: "italic" }}>
        No cities have opened yet. The registry is empty — be the first to seed one.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
      {cities.map((c, i) => (
        <CityCard key={c.city} city={c} index={i} />
      ))}
    </div>
  );
}

function CityCard({ city, index }: { city: CityRow; index: number }) {
  const live = city.neighborhoodCount > 0;
  const inner = (
    <article style={{ position: "relative" }}>
      <div className="num-tag" style={{ marginBottom: 18, fontSize: 11, letterSpacing: "0.04em" }}>
        No.&nbsp;0{index + 1}
      </div>
      <h3
        className="serif"
        style={{ fontSize: 56, margin: 0, fontWeight: 400, letterSpacing: "-0.035em", lineHeight: 0.95 }}
      >
        {city.city}
      </h3>
      <div className="ens mt-3.5" style={{ fontSize: 12 }}>
        <span className="ens-self">{city.city}</span>
        <span className="ens-dot">.</span>
        <span className="ens-tld">{PROTOCOL_ROOT}</span>
      </div>
      {live ? (
        <>
          <p style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 22, lineHeight: 1.45, maxWidth: 320 }}>
            {city.firstNeighborhood
              ? `First neighborhood: ${city.firstNeighborhood}.`
              : "Federated; awaiting first neighborhood."}
          </p>
          <div style={{ marginTop: 28, display: "flex", gap: 32, fontSize: 13, color: "var(--ink-2)" }}>
            <span>
              <span style={{ color: "var(--ink)", fontWeight: 500 }}>{city.neighborhoodCount}</span>{" "}
              {city.neighborhoodCount === 1 ? "hood" : "hoods"}
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
              Enter {city.city} →
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
              Open {city.city} →
            </span>
          </div>
        </>
      )}
    </article>
  );

  return (
    <Link href={`/${city.city}`} style={{ textDecoration: "none", color: "inherit" }}>
      {inner}
    </Link>
  );
}
