"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useReadContracts } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { STATE_CHAIN_ID } from "~~/lib/coin-types";

const USDC_DECIMALS = 6;

// Mirror of Solidity `enum Status { None, Active, Executing, Completed, Expired, Disputed }`.
const STATUS_ACTIVE = 1;
const STATUS_EXECUTING = 2;

type Aggregates = {
  pooledUsd: number;
  activeDriveCount: number;
  proposalCount: number;
  resourceCount: number;
  isLoading: boolean;
};

/**
 * Aggregate onchain stats for a neighborhood:
 *  - pooledUsd       — sum of `totalCommitted` across every proposal (USDC, human units)
 *  - activeDriveCount — proposals currently in Active or Executing status
 *  - proposalCount    — proposals registered (Active+Executing+Completed+Expired+Disputed)
 *  - resourceCount    — total registry entries (proposals + funded resources)
 *
 * Uses multicall via `useReadContracts` so a neighborhood with 30 resources
 * costs 2 RPC round-trips, not 60.
 */
export function useNeighborhoodAggregates(neighborhoodId: `0x${string}` | undefined): Aggregates {
  const { data: registry } = useDeployedContractInfo({
    contractName: "ObecRegistry",
    chainId: STATE_CHAIN_ID,
  });
  const { data: pool } = useDeployedContractInfo({
    contractName: "CommitmentPool",
    chainId: STATE_CHAIN_ID,
  });

  const { data: resourceNodes, isPending: nodesPending } = useScaffoldReadContract({
    contractName: "ObecRegistry",
    functionName: "getNeighborhoodResources",
    args: [neighborhoodId],
  });

  const nodes = useMemo(
    () => (Array.isArray(resourceNodes) ? (resourceNodes as `0x${string}`[]) : []),
    [resourceNodes],
  );

  // Step 1: batch-read each `resources(node)` to find which are proposals.
  const { data: resourceTuples, isPending: resourcesPending } = useReadContracts({
    contracts: nodes.map(node => ({
      address: registry?.address,
      abi: registry?.abi,
      functionName: "resources",
      args: [node],
      chainId: STATE_CHAIN_ID,
    })) as any,
    query: { enabled: !!registry && nodes.length > 0 },
  });

  const proposalNodes = useMemo(() => {
    if (!resourceTuples) return [] as `0x${string}`[];
    const out: `0x${string}`[] = [];
    resourceTuples.forEach((res, i) => {
      const tuple = res.result as readonly unknown[] | undefined;
      if (!tuple) return;
      const type = tuple[2] as string;
      const active = tuple[4] as boolean;
      if (active && type === "proposal") out.push(nodes[i]);
    });
    return out;
  }, [resourceTuples, nodes]);

  // Step 2: batch-read each `getProposal(node)` for the proposal subset.
  const { data: proposals, isPending: proposalsPending } = useReadContracts({
    contracts: proposalNodes.map(node => ({
      address: pool?.address,
      abi: pool?.abi,
      functionName: "getProposal",
      args: [node],
      chainId: STATE_CHAIN_ID,
    })) as any,
    query: { enabled: !!pool && proposalNodes.length > 0 },
  });

  return useMemo(() => {
    let pooledRaw = 0n;
    let activeDriveCount = 0;
    if (proposals) {
      for (const p of proposals) {
        const proposal = p.result as { totalCommitted?: bigint; status?: number | bigint } | undefined;
        if (!proposal) continue;
        pooledRaw += proposal.totalCommitted ?? 0n;
        const status = Number(proposal.status ?? 0);
        if (status === STATUS_ACTIVE || status === STATUS_EXECUTING) activeDriveCount += 1;
      }
    }
    return {
      pooledUsd: pooledRaw > 0n ? Number(formatUnits(pooledRaw, USDC_DECIMALS)) : 0,
      activeDriveCount,
      proposalCount: proposalNodes.length,
      resourceCount: nodes.length,
      isLoading:
        nodesPending || (nodes.length > 0 && resourcesPending) || (proposalNodes.length > 0 && proposalsPending),
    };
  }, [proposals, proposalNodes, nodes, nodesPending, resourcesPending, proposalsPending]);
}
