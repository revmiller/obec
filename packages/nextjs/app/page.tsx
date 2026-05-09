"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { NextPage } from "next";
import { MyMembership } from "~~/components/MyMembership";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";

// For v1, the home page is a directory of known neighborhoods. As the protocol
// scales, this would index from events / The Graph. For the demo it's hardcoded.
const SEEDED_NEIGHBORHOODS = [{ city: "prague", neighborhood: "vinohrady", country: "Czech Republic" }];

const Home: NextPage = () => {
  const router = useRouter();
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  const goCreate = () => {
    if (!city.trim() || !neighborhood.trim()) return;
    router.push(`/${city.trim().toLowerCase()}/${neighborhood.trim().toLowerCase()}`);
  };

  return (
    <div className="flex flex-col grow">
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h1 className="text-5xl font-bold tracking-tight">Hromada.</h1>
        <p className="mt-4 text-xl opacity-80 max-w-2xl">
          Neighbors pool funds for shared resources — solar, retrofits, tools — with auto-refund if not enough commit.
          Identity, credentials, and resource registry all live in ENS subnames.
        </p>
        <p className="mt-2 text-sm opacity-60">
          Protocol root: <code className="bg-base-300 px-1.5 py-0.5 rounded">{PROTOCOL_ROOT}</code>
        </p>
      </section>

      {/* How it works */}
      <section className="px-6 pb-12 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-semibold mb-6">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Step
            n={1}
            title="Propose"
            body="Any member posts a project — solar panels, building insulation, a shared tool — with a target amount, deadline, and minimum number of neighbors."
          />
          <Step
            n={2}
            title="Commit"
            body="Neighbors pledge USDC. Funds sit in escrow. If the target isn't reached by the deadline, everyone is automatically refunded."
          />
          <Step
            n={3}
            title="Execute"
            body="Threshold met → 30% releases to the contractor. Members confirm completion → 50% releases. After warranty → final 20%."
          />
        </div>
      </section>

      {/* Connected member callout */}
      <section className="px-6 pb-6 max-w-4xl mx-auto w-full">
        <MyMembership />
      </section>

      {/* Neighborhoods + create new */}
      <section className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <h2 className="text-2xl font-semibold mb-4">Neighborhoods</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SEEDED_NEIGHBORHOODS.map(n => (
            <Link
              key={`${n.city}/${n.neighborhood}`}
              href={`/${n.city}/${n.neighborhood}`}
              className="block p-5 rounded-xl bg-base-200 hover:bg-base-300 transition border border-base-300"
            >
              <div className="font-semibold capitalize">{n.neighborhood}</div>
              <div className="text-sm opacity-70 capitalize">
                {n.city} · {n.country}
              </div>
              <div className="text-xs opacity-50 mt-2 font-mono">
                {n.neighborhood}.{n.city}.{PROTOCOL_ROOT}
              </div>
            </Link>
          ))}

          <div className="p-5 rounded-xl bg-base-200 border border-dashed border-base-300">
            <div className="font-semibold">Start your own</div>
            <div className="text-sm opacity-70 mt-1">Spin up a new neighborhood. The first creator becomes admin.</div>
            <div className="mt-3 flex flex-col gap-2">
              <input
                type="text"
                placeholder="city (e.g. berlin)"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
              <input
                type="text"
                placeholder="neighborhood (e.g. kreuzberg)"
                value={neighborhood}
                onChange={e => setNeighborhood(e.target.value)}
                className="input input-bordered input-sm w-full"
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={goCreate}
                disabled={!city.trim() || !neighborhood.trim()}
              >
                Continue →
              </button>
              {city && neighborhood && (
                <div className="text-xs opacity-50 mt-1 font-mono">
                  {neighborhood.trim().toLowerCase()}.{city.trim().toLowerCase()}.{PROTOCOL_ROOT}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="p-5 rounded-xl bg-base-200 border border-base-300">
      <div className="text-3xl font-bold opacity-30">0{n}</div>
      <div className="font-semibold mt-2">{title}</div>
      <div className="text-sm opacity-70 mt-2 leading-relaxed">{body}</div>
    </div>
  );
}

export default Home;
