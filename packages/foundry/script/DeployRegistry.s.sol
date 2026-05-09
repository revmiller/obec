// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

import { ObecRegistry } from "../contracts/ObecRegistry.sol";

/// @notice Deploys ObecRegistry. Reads PROTOCOL_ROOT env var (e.g. "obec.eth")
///         and derives the namehash for the constructor.
contract DeployRegistry is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner returns (ObecRegistry registry) {
        string memory protocolRoot = vm.envOr("PROTOCOL_ROOT", string("obec.eth"));
        bytes memory dns = NameCoder.encode(protocolRoot);
        bytes32 rootNamehash = NameCoder.namehash(dns, 0);

        registry = new ObecRegistry(rootNamehash);
        deployments.push(Deployment({ name: "ObecRegistry", addr: address(registry) }));

        console.log("ObecRegistry deployed:", address(registry));
        console.log("PROTOCOL_ROOT:", protocolRoot);
        console.logBytes32(rootNamehash);
    }
}
