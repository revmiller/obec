// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Script, console } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";
import { CommitmentPool } from "../contracts/CommitmentPool.sol";
import { MockUSDC } from "../contracts/MockUSDC.sol";

interface IL2ReverseRegistrar {
    function setName(string calldata name) external returns (bytes32);
}

/// @notice Demo seed for Vinohrady. Reads contract addresses from env (set after Deploy.s.sol).
///         Funds 15 ephemeral keys derived from DEMO_MNEMONIC, has them join + commit + attest,
///         and registers ENSIP-19 reverse names so Basescan shows e.g. anna.vinohrady.prague.hromada.eth.

contract Seed is Script {
    string constant CITY = "prague";
    string constant NEIGHBORHOOD = "vinohrady";
    string constant PROPOSAL_LABEL = "proposal-cargobikes";
    string constant RESOURCE_LABEL = "cargo-bikes";
    string constant RESOURCE_TYPE = "mobility";

    uint256 constant TARGET_USDC = 8_000 * 1e6; // $8,000
    uint256 constant PER_MEMBER  = 600  * 1e6; // $600
    uint256 constant FUND_PER_MEMBER = 0.0008 ether; // gas budget per ephemeral on Base Sepolia
    uint256 constant MIN_MEMBERS = 14;
    uint256 constant ATTESTATION_THRESHOLD = 8;
    uint64  constant WARRANTY_SECONDS = 60;

    // ENS L2ReverseRegistrar on Base Sepolia (ensdomains/ens-contracts staging deployments)
    address constant L2_REVERSE_REGISTRAR = 0x00000BeEF055f7934784D6d81b6BC86665630dbA;

    function run() external {
        address registryAddr = vm.envAddress("REGISTRY_ADDRESS");
        address poolAddr     = vm.envAddress("COMMITMENT_POOL_ADDRESS");
        address usdcAddr     = vm.envAddress("MOCK_USDC_ADDRESS");
        string memory protocolRoot = vm.envOr("PROTOCOL_ROOT", string("hromada.eth"));

        // Deterministic ephemeral keys so the same wallets show up across reseeds.
        string memory mnemonic = vm.envOr(
            "DEMO_MNEMONIC",
            string("test test test test test test test test test test test junk")
        );

        HromadaRegistry registry = HromadaRegistry(registryAddr);
        CommitmentPool  pool     = CommitmentPool(poolAddr);
        MockUSDC        usdc     = MockUSDC(usdcAddr);

        string[15] memory labels = _labels();

        // -------- Phase 1: deployer creates the neighborhood + seeds federation cities --------
        vm.startBroadcast();
        // Federation discovery: register the city list on the protocol root itself so external
        // indexers can crawl the namespace via a single getText call on hromada.eth.
        registry.setText(registry.PROTOCOL_ROOT_NAMEHASH(), "cities", CITY);
        bytes32 nbId = registry.createNeighborhood(CITY, NEIGHBORHOOD);
        registry.setText(
            nbId,
            "description",
            "15 households in Vinohrady cooperating on shared resources: bikes, retrofits, tools, energy."
        );
        vm.stopBroadcast();
        console.log("nbId:", vm.toString(nbId));

        // -------- Phase 2: fund + join 15 ephemerals --------
        uint256[15] memory pks;
        address[15] memory wallets;
        for (uint32 i = 0; i < 15; i++) {
            uint256 pk = vm.deriveKey(mnemonic, i);
            address wallet = vm.addr(pk);
            pks[i] = pk;
            wallets[i] = wallet;

            vm.startBroadcast();
            payable(wallet).transfer(FUND_PER_MEMBER);
            usdc.mint(wallet, PER_MEMBER * 2);
            vm.stopBroadcast();

            vm.startBroadcast(pk);
            registry.joinNeighborhood(nbId, labels[i]);
            // ENSIP-19 reverse: set the wallet's primary name so Basescan/explorers
            // display "anna.vinohrady.prague.hromada.eth" instead of 0x...
            string memory fullName = string.concat(
                labels[i], ".", NEIGHBORHOOD, ".", CITY, ".", protocolRoot
            );
            IL2ReverseRegistrar(L2_REVERSE_REGISTRAR).setName(fullName);
            vm.stopBroadcast();
        }
        console.log("Seeded 15 members + reverse names");

        // -------- Phase 3: anna creates the proposal --------
        vm.startBroadcast(pks[0]);
        bytes32 proposalNode = pool.createProposal(
            CommitmentPool.CreateParams({
                neighborhoodId: nbId,
                label: PROPOSAL_LABEL,
                executor: wallets[10], // karel as executor / contractor
                targetAmount: TARGET_USDC,
                minMembers: MIN_MEMBERS,
                deadline: uint64(block.timestamp + 30 days),
                warrantyDuration: WARRANTY_SECONDS,
                attestationThreshold: ATTESTATION_THRESHOLD,
                resourceLabel: RESOURCE_LABEL,
                resourceType: RESOURCE_TYPE
            })
        );
        // Description on the proposal subname
        registry.setText(
            proposalNode,
            "description",
            "Two e-cargo bikes for our building. 14 households share unlimited access via key cabinet "
            "+ booking calendar. Replaces ~80% of family car trips for groceries, school runs, and "
            "hardware store hauls. Maintenance contract with local bike shop included for warranty."
        );
        vm.stopBroadcast();
        console.log("proposalNode:", vm.toString(proposalNode));

        // -------- Phase 4: 14 members commit (hits threshold; auto-fires milestone 0) --------
        for (uint32 i = 0; i < 14; i++) {
            vm.startBroadcast(pks[i]);
            IERC20(usdcAddr).approve(poolAddr, type(uint256).max);
            pool.commit(proposalNode, PER_MEMBER);
            vm.stopBroadcast();
        }
        console.log("14 commits posted; milestone 0 fired");

        // -------- Phase 5: 8 attestations (fires milestone 1 + writes attestations record) --------
        for (uint32 i = 0; i < ATTESTATION_THRESHOLD; i++) {
            vm.startBroadcast(pks[i]);
            pool.attest(proposalNode);
            vm.stopBroadcast();
        }
        console.log("8 attestations posted; milestone 1 fired");

        // -------- Phase 6: pin a placeholder IPFS contenthash on the resource subname --------
        // Production would upload the cargo bike booking guide + maintenance schedule to IPFS.
        // Format: ENSIP-7 contenthash (e3 = ipfs-ns, dag-pb cidv1, sha-256, 32-byte digest).
        CommitmentPool.Proposal memory pr = pool.getProposal(proposalNode);
        vm.startBroadcast();
        registry.setContenthash(
            pr.resourceNode,
            hex"e30101701220cafebabecafebabecafebabecafebabecafebabecafebabecafebabecafebabe"
        );
        vm.stopBroadcast();
        console.log("Resource contenthash pinned");

        console.log("Demo seed complete.");
    }

    function _labels() internal pure returns (string[15] memory l) {
        l[0]  = "anna";   l[1]  = "ben";    l[2]  = "cyril";
        l[3]  = "dana";   l[4]  = "eva";    l[5]  = "filip";
        l[6]  = "gita";   l[7]  = "hana";   l[8]  = "ivo";
        l[9]  = "jana";   l[10] = "karel";  l[11] = "lucie";
        l[12] = "marek";  l[13] = "nela";   l[14] = "ondra";
    }
}
