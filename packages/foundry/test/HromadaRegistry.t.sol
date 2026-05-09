// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";

contract HromadaRegistryTest is Test {
    HromadaRegistry registry;

    bytes32 constant ROOT = keccak256("hromada.eth-test-root");

    address admin   = makeAddr("admin");
    address anna    = makeAddr("anna");
    address jan     = makeAddr("jan");
    address eve     = makeAddr("eve");
    address pool    = makeAddr("pool");

    function setUp() public {
        vm.prank(admin);
        registry = new HromadaRegistry(ROOT);

        vm.prank(admin);
        registry.setCommitmentPool(pool);
    }

    // -------- setCommitmentPool --------

    function test_setCommitmentPool_onlyOwnerOnce() public {
        HromadaRegistry r = new HromadaRegistry(ROOT);

        vm.prank(eve);
        vm.expectRevert(HromadaRegistry.NotOwner.selector);
        r.setCommitmentPool(pool);

        r.setCommitmentPool(pool);
        assertEq(r.commitmentPool(), pool);

        vm.expectRevert(HromadaRegistry.PoolAlreadySet.selector);
        r.setCommitmentPool(address(0xdead));
    }

    // -------- createNeighborhood --------

    function test_createNeighborhood_records() public {
        vm.prank(admin);
        bytes32 id = registry.createNeighborhood("prague", "vinohrady");

        bytes32 expected = NameCoder.namehash(
            NameCoder.namehash(ROOT, keccak256(bytes("prague"))),
            keccak256(bytes("vinohrady"))
        );
        assertEq(id, expected);

        (string memory city, string memory name, address a, bool active) = registry.neighborhoods(id);
        assertEq(city, "prague");
        assertEq(name, "vinohrady");
        assertEq(a, admin);
        assertTrue(active);
    }

    function test_createNeighborhood_duplicateReverts() public {
        vm.prank(admin);
        registry.createNeighborhood("prague", "vinohrady");
        vm.prank(admin);
        vm.expectRevert(HromadaRegistry.AlreadyExists.selector);
        registry.createNeighborhood("prague", "vinohrady");
    }

    // -------- joinNeighborhood --------

    function test_joinNeighborhood_storesReverseAndLabels() public {
        bytes32 id = _seedNeighborhood();

        vm.prank(anna);
        bytes32 memberNode = registry.joinNeighborhood(id, "anna");

        assertEq(registry.getNodeByAddress(anna), memberNode);
        assertTrue(registry.isMember(id, anna));

        string[] memory labels = registry.getNodeLabels(memberNode);
        assertEq(labels.length, 3);
        assertEq(labels[0], "anna");
        assertEq(labels[1], "vinohrady");
        assertEq(labels[2], "prague");

        bytes32[] memory list = registry.getNeighborhoodMembers(id);
        assertEq(list.length, 1);
        assertEq(list[0], memberNode);
    }

    function test_joinNeighborhood_nonExistentReverts() public {
        bytes32 fake = keccak256("nope");
        vm.prank(anna);
        vm.expectRevert(HromadaRegistry.NeighborhoodNotFound.selector);
        registry.joinNeighborhood(fake, "anna");
    }

    function test_joinNeighborhood_onePerWalletReverts() public {
        bytes32 id = _seedNeighborhood();
        vm.prank(anna);
        registry.joinNeighborhood(id, "anna");
        vm.prank(anna);
        vm.expectRevert(HromadaRegistry.AlreadyExists.selector);
        registry.joinNeighborhood(id, "anna2");
    }

    // -------- registerResource --------

    function test_registerResource_onlyPool() public {
        bytes32 id = _seedNeighborhood();

        vm.prank(eve);
        vm.expectRevert(HromadaRegistry.NotPool.selector);
        registry.registerResource(id, "solar-array", "energy", pool);

        vm.prank(pool);
        bytes32 resourceNode = registry.registerResource(id, "solar-array", "energy", pool);

        bytes32[] memory list = registry.getNeighborhoodResources(id);
        assertEq(list.length, 1);
        assertEq(list[0], resourceNode);

        string[] memory labels = registry.getNodeLabels(resourceNode);
        assertEq(labels[0], "solar-array");
        assertEq(labels[1], "vinohrady");
        assertEq(labels[2], "prague");
    }

    // -------- setText / getText auth --------

    function test_setText_memberCanSetOwn() public {
        (bytes32 id, bytes32 annaNode) = _seedNeighborhoodWithAnna();
        id; // silence unused
        vm.prank(anna);
        registry.setText(annaNode, "credential.electrician", "yes");
        assertEq(registry.getText(annaNode, "credential.electrician"), "yes");
    }

    function test_setText_strangerReverts() public {
        (, bytes32 annaNode) = _seedNeighborhoodWithAnna();
        vm.prank(eve);
        vm.expectRevert(HromadaRegistry.Unauthorized.selector);
        registry.setText(annaNode, "credential.electrician", "yes");
    }

    function test_setText_adminCanOverride() public {
        (, bytes32 annaNode) = _seedNeighborhoodWithAnna();
        vm.prank(admin);
        registry.setText(annaNode, "credential.electrician", "verified");
        assertEq(registry.getText(annaNode, "credential.electrician"), "verified");
    }

    function test_setText_poolAlwaysAllowed() public {
        (, bytes32 annaNode) = _seedNeighborhoodWithAnna();
        vm.prank(pool);
        registry.setText(annaNode, "funded-by", "proposal-solar");
        assertEq(registry.getText(annaNode, "funded-by"), "proposal-solar");
    }

    // -------- setContenthash --------

    function test_setContenthash_byPool() public {
        bytes32 id = _seedNeighborhood();
        vm.prank(pool);
        bytes32 resourceNode = registry.registerResource(id, "solar-array", "energy", pool);

        bytes memory hash = hex"e30101701220000000000000000000000000000000000000000000000000000000000000beef";
        vm.prank(pool);
        registry.setContenthash(resourceNode, hash);
        assertEq(registry.getContenthash(resourceNode), hash);
    }

    function test_setContenthash_strangerReverts() public {
        bytes32 id = _seedNeighborhood();
        vm.prank(pool);
        bytes32 resourceNode = registry.registerResource(id, "solar-array", "energy", pool);

        vm.prank(eve);
        vm.expectRevert(HromadaRegistry.Unauthorized.selector);
        registry.setContenthash(resourceNode, hex"00");
    }

    // -------- helpers --------

    function _seedNeighborhood() internal returns (bytes32 id) {
        vm.prank(admin);
        id = registry.createNeighborhood("prague", "vinohrady");
    }

    function _seedNeighborhoodWithAnna() internal returns (bytes32 id, bytes32 annaNode) {
        id = _seedNeighborhood();
        vm.prank(anna);
        annaNode = registry.joinNeighborhood(id, "anna");
    }
}
