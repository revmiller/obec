// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { ObecResolver } from "../contracts/ObecResolver.sol";

/// @notice Deploys ObecResolver to Sepolia with the gateway URL + signer.
///         Reads GATEWAY_URL + GATEWAY_SIGNER env vars.
contract DeployResolver is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner returns (ObecResolver resolver) {
        string memory gatewayUrl = vm.envString("GATEWAY_URL");
        address signer = vm.envAddress("GATEWAY_SIGNER");

        string[] memory urls = new string[](1);
        urls[0] = gatewayUrl;

        resolver = new ObecResolver(urls, signer);
        deployments.push(Deployment({ name: "ObecResolver", addr: address(resolver) }));

        console.log("ObecResolver deployed:", address(resolver));
        console.log("Gateway URL:", gatewayUrl);
        console.log("Signer:", signer);
        console.log("");
        console.log("Next: call ENS_REGISTRY.setResolver(namehash(${PROTOCOL_ROOT}), this)");
    }
}
