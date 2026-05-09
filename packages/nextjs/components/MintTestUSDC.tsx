"use client";

import { erc20Abi, parseUnits } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

const USDC_DECIMALS = 6;
const MINT_AMOUNT = parseUnits("10000", USDC_DECIMALS); // €10k worth

/// Mints MockUSDC to the connected wallet. Available on any chain where MockUSDC is deployed.
export function MintTestUSDC() {
  const { address } = useAccount();
  const { data: mockUsdc } = useDeployedContractInfo({ contractName: "MockUSDC" });

  const { data: balance, refetch } = useReadContract({
    address: mockUsdc?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!mockUsdc?.address },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  if (!address || !mockUsdc?.address) return null;
  if (balance && balance > 0n) return null; // user already has some

  const onMint = async () => {
    await writeContractAsync({
      address: mockUsdc.address,
      abi: [
        {
          type: "function",
          name: "mint",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ],
      functionName: "mint",
      args: [address, MINT_AMOUNT],
    });
    refetch();
  };

  return (
    <div className="text-xs opacity-70">
      No USDC?{" "}
      <button onClick={onMint} disabled={isPending} className="underline hover:opacity-100">
        {isPending ? "Minting…" : "Mint €10,000 test USDC"}
      </button>
    </div>
  );
}
