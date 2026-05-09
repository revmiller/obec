// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { HromadaResolver } from "../contracts/HromadaResolver.sol";

/// @notice Deploys HromadaResolver to Sepolia with the gateway URL + signer.
///         Reads GATEWAY_URL + GATEWAY_SIGNER env vars.
contract DeployResolver is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner returns (HromadaResolver resolver) {
        string memory gatewayUrl = vm.envString("GATEWAY_URL");
        address signer = vm.envAddress("GATEWAY_SIGNER");

        string[] memory urls = new string[](1);
        urls[0] = gatewayUrl;

        resolver = new HromadaResolver(urls, signer);
        deployments.push(Deployment({ name: "HromadaResolver", addr: address(resolver) }));

        console.log("HromadaResolver deployed:", address(resolver));
        console.log("Gateway URL:", gatewayUrl);
        console.log("Signer:", signer);
        console.log("");
        console.log("Next: call ENS_REGISTRY.setResolver(namehash(${PROTOCOL_ROOT}), this)");
    }
}
