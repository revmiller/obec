// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";
import { CommitmentPool } from "../contracts/CommitmentPool.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

/// @notice One-shot deploy: Registry + Pool wired. On localhost (anvil) deploys a MockUSDC;
///         on testnets reads USDC_ADDRESS from env.
contract DeployScript is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        // 1. Registry
        string memory protocolRoot = vm.envOr("PROTOCOL_ROOT", string("hromada.eth"));
        bytes memory dns = NameCoder.encode(protocolRoot);
        bytes32 rootNamehash = NameCoder.namehash(dns, 0);

        HromadaRegistry registry = new HromadaRegistry(rootNamehash);
        deployments.push(Deployment({ name: "HromadaRegistry", addr: address(registry) }));
        console.log("HromadaRegistry:", address(registry));

        // 2. USDC (mock on localhost, real on testnets)
        address usdc;
        if (block.chainid == 31337) {
            MockUSDC mock = new MockUSDC();
            usdc = address(mock);
            deployments.push(Deployment({ name: "MockUSDC", addr: usdc }));
            console.log("MockUSDC (anvil-only):", usdc);
        } else {
            usdc = vm.envAddress("USDC_ADDRESS");
            console.log("USDC (testnet):", usdc);
        }

        // 3. Pool
        CommitmentPool pool = new CommitmentPool(address(registry), usdc);
        deployments.push(Deployment({ name: "CommitmentPool", addr: address(pool) }));
        registry.setCommitmentPool(address(pool));
        console.log("CommitmentPool:", address(pool));
    }
}
