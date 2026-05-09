// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

import { HromadaRegistry } from "../contracts/HromadaRegistry.sol";
import { CommitmentPool } from "../contracts/CommitmentPool.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract CommitmentPoolTest is Test {
    HromadaRegistry registry;
    CommitmentPool pool;
    MockUSDC usdc;

    bytes32 constant ROOT = keccak256("hromada.eth-test-root");

    address admin    = makeAddr("admin");
    address jan      = makeAddr("jan-executor");
    address[] members;

    bytes32 neighborhoodId;

    uint256 constant TARGET   = 8_000 * 1e6; // 8000 USDC (6 decimals)
    uint256 constant PER_MBR  = 600  * 1e6;  // 600 USDC each
    uint256 constant MIN_MBRS = 14;
    uint64  constant WARRANTY = 60;          // 60s warranty for tests

    function setUp() public {
        usdc = new MockUSDC();

        vm.prank(admin);
        registry = new HromadaRegistry(ROOT);

        pool = new CommitmentPool(address(registry), address(usdc));
        vm.prank(admin);
        registry.setCommitmentPool(address(pool));

        vm.prank(admin);
        neighborhoodId = registry.createNeighborhood("prague", "vinohrady");

        // Seed 15 members, all funded with 600 USDC. Index 0 is the proposal creator.
        for (uint256 i = 0; i < 15; i++) {
            address m = address(uint160(0xA000 + i));
            members.push(m);
            usdc.mint(m, PER_MBR);
            vm.prank(m);
            usdc.approve(address(pool), type(uint256).max);
            vm.prank(m);
            registry.joinNeighborhood(neighborhoodId, _label(i));
        }
    }

    // -------- createProposal --------

    function test_createProposal_requiresMembership() public {
        address eve = address(0xEEEE);
        vm.prank(eve);
        vm.expectRevert(CommitmentPool.NotMember.selector);
        pool.createProposal(_baseParams());
    }

    function test_createProposal_pastDeadlineReverts() public {
        CommitmentPool.CreateParams memory p = _baseParams();
        p.deadline = uint64(block.timestamp); // not strictly future
        vm.prank(members[0]);
        vm.expectRevert(CommitmentPool.PastDeadline.selector);
        pool.createProposal(p);
    }

    // -------- commit / withdraw --------

    function test_commit_updatesState() public {
        bytes32 pid = _propose();
        vm.prank(members[0]);
        pool.commit(pid, PER_MBR);

        CommitmentPool.Proposal memory pr = pool.getProposal(pid);
        assertEq(pr.totalCommitted, PER_MBR);
        assertEq(pr.memberCount, 1);
        assertEq(pool.commitments(pid, members[0]), PER_MBR);
    }

    function test_commit_rejectsAfterDeadline() public {
        bytes32 pid = _propose();
        vm.warp(block.timestamp + 30 days + 1);
        vm.prank(members[0]);
        vm.expectRevert(CommitmentPool.PastDeadline.selector);
        pool.commit(pid, PER_MBR);
    }

    function test_withdraw_inActive() public {
        bytes32 pid = _propose();
        vm.prank(members[0]);
        pool.commit(pid, PER_MBR);

        uint256 balBefore = usdc.balanceOf(members[0]);
        vm.prank(members[0]);
        pool.withdraw(pid);
        assertEq(usdc.balanceOf(members[0]), balBefore + PER_MBR);
        assertEq(pool.commitments(pid, members[0]), 0);
    }

    function test_withdraw_revertsAfterFunded() public {
        bytes32 pid = _propose();
        _commitAll(pid);
        vm.prank(members[0]);
        vm.expectRevert(CommitmentPool.NotActive.selector);
        pool.withdraw(pid);
    }

    // -------- threshold transition --------

    function test_thresholdTransition_releasesMilestone0AndCreatesResource() public {
        bytes32 pid = _propose();

        uint256 janBefore = usdc.balanceOf(jan);
        _commitAll(pid);

        CommitmentPool.Proposal memory pr = pool.getProposal(pid);
        assertEq(uint8(pr.status), uint8(CommitmentPool.Status.Executing));
        assertTrue(pr.milestoneReleased[0]);
        // Milestone 0 = 30% of totalCommitted (not target — so surplus over target isn't stuck).
        assertEq(usdc.balanceOf(jan) - janBefore, (pr.totalCommitted * 30) / 100);

        // Resource subname should exist
        bytes32[] memory list = registry.getNeighborhoodResources(neighborhoodId);
        // Two: the proposal subname + the auto-created resource subname
        assertEq(list.length, 2);

        // The resource node should equal the second registered (proposal first, resource second)
        bytes32 resourceNode = pr.resourceNode;
        assertTrue(resourceNode != bytes32(0));
        assertEq(registry.getText(resourceNode, "funded-by"), "proposal-cargo-bikes");
        assertEq(registry.getText(resourceNode, "status"), "active");
        assertEq(registry.getText(resourceNode, "maintainer"), Strings.toHexString(jan));
    }

    // -------- expiry / refund --------

    function test_checkExpiry_flips() public {
        bytes32 pid = _propose();
        vm.prank(members[0]);
        pool.commit(pid, PER_MBR);
        vm.warp(block.timestamp + 30 days + 1);
        pool.checkExpiry(pid);
        assertEq(uint8(pool.status(pid)), uint8(CommitmentPool.Status.Expired));
    }

    function test_claimRefund_onlyAfterExpiry() public {
        bytes32 pid = _propose();
        vm.prank(members[0]);
        pool.commit(pid, PER_MBR);

        vm.prank(members[0]);
        vm.expectRevert(CommitmentPool.NotExpired.selector);
        pool.claimRefund(pid);

        vm.warp(block.timestamp + 30 days + 1);
        pool.checkExpiry(pid);

        uint256 balBefore = usdc.balanceOf(members[0]);
        vm.prank(members[0]);
        pool.claimRefund(pid);
        assertEq(usdc.balanceOf(members[0]) - balBefore, PER_MBR);
    }

    // -------- attestation & milestone 1 --------

    function test_attest_releasesMilestone1AtThreshold() public {
        bytes32 pid = _propose();
        _commitAll(pid);

        uint256 janBefore = usdc.balanceOf(jan);
        // Attestation threshold is 8 in our base params; need 8 attestations
        for (uint256 i = 0; i < 8; i++) {
            vm.prank(members[i]);
            pool.attest(pid);
        }

        CommitmentPool.Proposal memory pr = pool.getProposal(pid);
        assertTrue(pr.milestoneReleased[1]);
        assertEq(usdc.balanceOf(jan) - janBefore, (pr.totalCommitted * 50) / 100);

        // Attesters list is populated and the attestations text record anchors them
        // on the resource subname as a verifiable credential.
        address[] memory attesters = pool.getAttesters(pid);
        assertEq(attesters.length, 8);

        string memory expected = Strings.toHexString(members[0]);
        for (uint256 i = 1; i < 8; i++) {
            expected = string.concat(expected, ",", Strings.toHexString(members[i]));
        }
        assertEq(registry.getText(pr.resourceNode, "attestations"), expected);
    }

    function test_attest_doubleAttestReverts() public {
        bytes32 pid = _propose();
        _commitAll(pid);
        vm.prank(members[0]);
        pool.attest(pid);
        vm.prank(members[0]);
        vm.expectRevert(CommitmentPool.AlreadyAttested.selector);
        pool.attest(pid);
    }

    function test_attest_nonMemberReverts() public {
        bytes32 pid = _propose();
        _commitAll(pid);
        address eve = address(0xEEEE);
        vm.prank(eve);
        vm.expectRevert(CommitmentPool.NotMember.selector);
        pool.attest(pid);
    }

    // -------- warranty milestone --------

    function test_warrantyMilestone_releasesAfterPeriod() public {
        bytes32 pid = _propose();
        _commitAll(pid);
        for (uint256 i = 0; i < 8; i++) {
            vm.prank(members[i]);
            pool.attest(pid);
        }

        // Before warranty: revert
        vm.expectRevert(CommitmentPool.MilestoneNotReady.selector);
        pool.claimWarrantyMilestone(pid);

        vm.warp(block.timestamp + WARRANTY + 1);
        uint256 janBefore = usdc.balanceOf(jan);
        CommitmentPool.Proposal memory pr = pool.getProposal(pid);
        pool.claimWarrantyMilestone(pid);

        assertEq(usdc.balanceOf(jan) - janBefore, (pr.totalCommitted * 20) / 100);
        assertEq(uint8(pool.status(pid)), uint8(CommitmentPool.Status.Completed));
    }

    // -------- dispute --------

    function test_raiseDispute_byCommitter() public {
        bytes32 pid = _propose();
        _commitAll(pid);

        vm.prank(members[0]);
        pool.raiseDispute(pid);
        assertEq(uint8(pool.status(pid)), uint8(CommitmentPool.Status.Disputed));
    }

    function test_raiseDispute_nonCommitterReverts() public {
        bytes32 pid = _propose();
        _commitAll(pid);
        address eve = address(0xEEEE);
        vm.prank(eve);
        vm.expectRevert(CommitmentPool.NotMember.selector);
        pool.raiseDispute(pid);
    }

    // -------- helpers --------

    function _baseParams() internal view returns (CommitmentPool.CreateParams memory p) {
        p = CommitmentPool.CreateParams({
            neighborhoodId: neighborhoodId,
            label: "proposal-cargo-bikes",
            executor: jan,
            targetAmount: TARGET,
            minMembers: MIN_MBRS,
            deadline: uint64(block.timestamp + 30 days),
            warrantyDuration: WARRANTY,
            attestationThreshold: 8,
            resourceLabel: "cargo-bikes",
            resourceType: "mobility"
        });
    }

    function _propose() internal returns (bytes32 pid) {
        vm.prank(members[0]);
        pid = pool.createProposal(_baseParams());
    }

    function _commitAll(bytes32 pid) internal {
        for (uint256 i = 0; i < 15; i++) {
            if (pool.status(pid) != CommitmentPool.Status.Active) break;
            vm.prank(members[i]);
            pool.commit(pid, PER_MBR);
        }
    }

    function _label(uint256 i) internal pure returns (string memory) {
        if (i == 0) return "anna";
        if (i == 1) return "ben";
        if (i == 2) return "cyril";
        if (i == 3) return "dana";
        if (i == 4) return "eva";
        if (i == 5) return "filip";
        if (i == 6) return "gita";
        if (i == 7) return "hana";
        if (i == 8) return "ivo";
        if (i == 9) return "jana";
        if (i == 10) return "karel";
        if (i == 11) return "lucie";
        if (i == 12) return "marek";
        if (i == 13) return "nela";
        return "ondra";
    }
}
