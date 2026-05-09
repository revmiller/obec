"use client";

import { use } from "react";
import Link from "next/link";
import { namehash } from "viem/ens";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "hromada.eth";

type Params = { city: string; neighborhood: string };

export default function NeighborhoodPage({ params }: { params: Promise<Params> }) {
  const { city, neighborhood } = use(params);
  const fullName = `${neighborhood}.${city}.${PROTOCOL_ROOT}`;
  const neighborhoodId = namehash(fullName);

  const { data: hood } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "neighborhoods",
    args: [neighborhoodId],
  });

  const { data: memberNodes } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNeighborhoodMembers",
    args: [neighborhoodId],
  });

  const { data: resourceNodes } = useScaffoldReadContract({
    contractName: "HromadaRegistry",
    functionName: "getNeighborhoodResources",
    args: [neighborhoodId],
  });

  const exists = hood && hood[3] === true; // Neighborhood.active

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-sm opacity-60">
        <Link href="/" className="hover:underline">
          home
        </Link>{" "}
        / <span className="capitalize">{city}</span>
      </div>

      <h1 className="text-4xl font-bold mt-2 capitalize">{neighborhood}</h1>
      <p className="font-mono text-sm opacity-70 mt-1">{fullName}</p>

      {!exists ? (
        <div className="mt-10 p-6 bg-base-200 rounded-xl">
          <p className="text-lg">This neighborhood doesn&apos;t exist yet.</p>
          <p className="text-sm opacity-70 mt-2">Anyone can create it onchain. The first creator becomes admin.</p>
        </div>
      ) : (
        <>
          <div className="mt-2 text-sm opacity-70">
            Admin: <span className="font-mono">{hood?.[2]}</span>
          </div>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-3">
              Members <span className="opacity-60 text-base">({memberNodes?.length ?? 0})</span>
            </h2>
            {!memberNodes || memberNodes.length === 0 ? (
              <p className="opacity-60 text-sm">No members yet.</p>
            ) : (
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {memberNodes.map(node => (
                  <li key={node} className="font-mono text-xs opacity-70 truncate">
                    {node}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-semibold mb-3">
              Proposals & Resources <span className="opacity-60 text-base">({resourceNodes?.length ?? 0})</span>
            </h2>
            {!resourceNodes || resourceNodes.length === 0 ? (
              <p className="opacity-60 text-sm">No proposals yet.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2">
                {resourceNodes.map(node => (
                  <li key={node} className="font-mono text-xs opacity-70 truncate">
                    {node}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
