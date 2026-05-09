import { type Hex, encodePacked, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/// Signs the CCIP-Read response per the ObecResolver verification scheme:
///   sigHash = keccak256(0x1900 || resolverAddress || expiry || keccak256(extraData) || keccak256(result))
export async function signGatewayResponse(args: {
  privateKey: Hex;
  resolverAddress: `0x${string}`;
  expiry: bigint;
  extraData: Hex;
  result: Hex;
}): Promise<Hex> {
  const { privateKey, resolverAddress, expiry, extraData, result } = args;

  const digest = keccak256(
    encodePacked(
      ["bytes2", "address", "uint64", "bytes32", "bytes32"],
      ["0x1900", resolverAddress, expiry, keccak256(extraData), keccak256(result)],
    ),
  );

  const account = privateKeyToAccount(privateKey);
  // Raw ECDSA over the 32-byte digest (matches OZ ECDSA.recover the contract uses).
  return account.sign({ hash: digest });
}
