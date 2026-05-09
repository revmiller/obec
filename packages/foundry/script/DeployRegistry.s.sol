// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";

/// @notice Deploys HromadaRegistry. Reads PROTOCOL_ROOT env var (e.g. "hromada.eth")
///         and derives the namehash for the constructor.
contract DeployRegistry is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner returns (HromadaRegistry registry) {
        string memory protocolRoot = vm.envOr("PROTOCOL_ROOT", string("hromada.eth"));
        bytes memory dns = NameCoder.encode(protocolRoot);
        bytes32 rootNamehash = NameCoder.namehash(dns, 0);

        registry = new HromadaRegistry(rootNamehash);
        deployments.push(Deployment({ name: "HromadaRegistry", addr: address(registry) }));

        console.log("HromadaRegistry deployed:", address(registry));
        console.log("PROTOCOL_ROOT:", protocolRoot);
        console.logBytes32(rootNamehash);
    }
}
