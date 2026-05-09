// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

import { ObecRegistry } from "../contracts/ObecRegistry.sol";
import { CommitmentPool } from "../contracts/CommitmentPool.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";

/// @notice Deploys Registry + MockUSDC + Pool, wired together.
contract DeployScript is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // Registry
        string memory protocolRoot = vm.envOr("PROTOCOL_ROOT", string("obec.eth"));
        bytes32 rootNamehash = NameCoder.namehash(NameCoder.encode(protocolRoot), 0);
        ObecRegistry registry = new ObecRegistry(rootNamehash);
        deployments.push(Deployment({ name: "ObecRegistry", addr: address(registry) }));
        console.log("ObecRegistry:", address(registry));

        // MockUSDC — same on every chain so demo wallets can mint freely.
        MockUSDC usdc = new MockUSDC();
        deployments.push(Deployment({ name: "MockUSDC", addr: address(usdc) }));
        console.log("MockUSDC:", address(usdc));

        // Pool
        CommitmentPool pool = new CommitmentPool(address(registry), address(usdc));
        deployments.push(Deployment({ name: "CommitmentPool", addr: address(pool) }));
        registry.setCommitmentPool(address(pool));
        console.log("CommitmentPool:", address(pool));
    }
}
