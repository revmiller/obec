/**
 * Post-deploy smoke test: resolves Obec ENS names through the live CCIP-Read flow.
 * Confirms the Sepolia resolver, the Vercel gateway, and the Base Sepolia registry
 * are wired correctly end-to-end.
 *
 * Run:
 *   ALCHEMY_API_KEY=... yarn tsx scripts/smoke-test.ts
 *   ALCHEMY_API_KEY=... yarn tsx scripts/smoke-test.ts <name>
 *
 * Exit 0 on pass, 1 on any resolution failure.
 */
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

const PROTOCOL_ROOT = process.env.NEXT_PUBLIC_PROTOCOL_ROOT ?? "obec.eth";
const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? process.env.ALCHEMY_API_KEY ?? "cR4WnXePioePZ5fFrnSiR";
const COIN_TYPE_BASE_SEPOLIA = 2147568180n;

const client = createPublicClient({
  chain: sepolia,
  transport: http(`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`),
});

const NAMES =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        `vinohrady.prague.${PROTOCOL_ROOT}`,
        `anna.vinohrady.prague.${PROTOCOL_ROOT}`,
        `cargo-bikes.vinohrady.prague.${PROTOCOL_ROOT}`,
      ];

let failed = 0;

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`  ✓ ${label} (${ms}ms) → ${stringify(result)}`);
    return result;
  } catch (e) {
    failed++;
    console.log(`  ✗ ${label} → ${(e as Error).message}`);
    return undefined;
  }
}

function stringify(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(empty)";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

(async () => {
  console.log(`\n→ Smoke-testing CCIP-Read resolution of ${PROTOCOL_ROOT}\n`);

  // Federation discovery on the root itself
  console.log(`[${PROTOCOL_ROOT}]`);
  await timed(`getEnsText("cities")`, () => client.getEnsText({ name: PROTOCOL_ROOT, key: "cities" }));

  for (const name of NAMES) {
    console.log(`\n[${name}]`);
    await timed("getEnsAddress (default ETH coin)", () => client.getEnsAddress({ name }));
    await timed("getEnsAddress (Base Sepolia coin 2147568180)", () =>
      client.getEnsAddress({ name, coinType: COIN_TYPE_BASE_SEPOLIA }),
    );
    await timed(`getEnsText("description")`, () => client.getEnsText({ name, key: "description" }));
    await timed(`getEnsText("status")`, () => client.getEnsText({ name, key: "status" }));
    await timed(`getEnsText("maintainer")`, () => client.getEnsText({ name, key: "maintainer" }));
    await timed(`getEnsText("attestations")`, () => client.getEnsText({ name, key: "attestations" }));
  }

  console.log(`\n${failed === 0 ? "✓ all resolutions succeeded" : `✗ ${failed} failure(s)`}`);
  process.exit(failed === 0 ? 0 : 1);
})();
