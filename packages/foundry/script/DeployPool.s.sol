// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";
import { CommitmentPool } from "../contracts/CommitmentPool.sol";

/// @notice Deploys CommitmentPool, wires Registry → Pool.
///         Reads REGISTRY_ADDRESS + USDC_ADDRESS env vars.
contract DeployPool is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner returns (CommitmentPool pool) {
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");

        pool = new CommitmentPool(registryAddr, usdc);
        deployments.push(Deployment({ name: "CommitmentPool", addr: address(pool) }));

        // Owner of registry must be the deployer; set the pool address.
        HromadaRegistry(registryAddr).setCommitmentPool(address(pool));

        console.log("CommitmentPool deployed:", address(pool));
        console.log("Wired to Registry:", registryAddr);
    }
}
