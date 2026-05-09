"use client";

import Link from "next/link";
import type { NextPage } from "next";
import { MyMembership } from "~~/components/MyMembership";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";

// For v1, the home page is a directory of known neighborhoods. As the protocol
// scales, this would index from events / The Graph. For the demo it's hardcoded.
const SEEDED_NEIGHBORHOODS = [{ city: "prague", neighborhood: "vinohrady", country: "Czech Republic" }];

const Home: NextPage = () => {
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

      <section className="px-6 pb-6 max-w-4xl mx-auto w-full">
        <MyMembership />
      </section>

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
        </div>
      </section>
    </div>
  );
};

export default Home;
