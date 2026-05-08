// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

interface IRegistry {
    function isMember(bytes32 neighborhoodId, address wallet) external view returns (bool);
    function registerResource(
        bytes32 neighborhoodId,
        string calldata label,
        string calldata resourceType,
        address fundedBy
    ) external returns (bytes32 resourceNode);
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function setContenthash(bytes32 node, bytes calldata hash) external;
}

/// @title CommitmentPool
/// @notice Threshold-commit-execute-attest-release state machine for neighborhood proposals.
///         Settlement in USDC. Auto-creates a resource subname on funding.
contract CommitmentPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRegistry public immutable registry;
    IERC20   public immutable usdc;

    // 30/50/20 milestone split; basis points out of 10_000.
    uint16 public constant MILESTONE_0_BPS = 3_000;
    uint16 public constant MILESTONE_1_BPS = 5_000;
    uint16 public constant MILESTONE_2_BPS = 2_000;

    enum Status { None, Active, Funded, Executing, Completed, Expired, Disputed }

    struct Proposal {
        bytes32 neighborhoodId;
        string  label;                  // "proposal-solar"
        address executor;
        uint256 targetAmount;
        uint256 minMembers;
        uint64  deadline;
        uint64  warrantyDuration;       // seconds; small for demo, 30 days default in production
        uint64  fundedAt;
        uint64  attestedAt;
        uint256 attestationThreshold;
        uint256 totalCommitted;
        uint256 memberCount;
        uint256 attestationCount;
        Status  status;
        // Auto-resource creation params:
        string  resourceLabel;          // "solar-array"
        string  resourceType;           // "energy"
        bytes32 resourceNode;           // populated on funding
        // Milestone tracking:
        bool[3] milestoneReleased;
    }

    mapping(bytes32 => Proposal) private _proposals;
    mapping(bytes32 => mapping(address => uint256)) public commitments;
    mapping(bytes32 => mapping(address => bool))    public hasAttested;

    event ProposalCreated(bytes32 indexed proposalNode, bytes32 indexed neighborhoodId, address executor);
    event Committed(bytes32 indexed proposalNode, address indexed member, uint256 amount, uint256 totalCommitted);
    event Withdrawn(bytes32 indexed proposalNode, address indexed member, uint256 amount);
    event ThresholdMet(bytes32 indexed proposalNode, uint256 totalCommitted, uint256 memberCount);
    event MilestoneReleased(bytes32 indexed proposalNode, uint8 indexed milestone, uint256 amount);
    event Attested(bytes32 indexed proposalNode, address indexed member, uint256 attestationCount);
    event Refunded(bytes32 indexed proposalNode, address indexed member, uint256 amount);
    event Expired(bytes32 indexed proposalNode);
    event Disputed(bytes32 indexed proposalNode, address indexed raiser);

    error NotMember();
    error NotActive();
    error NotFunded();
    error NotExpired();
    error PastDeadline();
    error AlreadyAttested();
    error MilestoneAlreadyReleased();
    error MilestoneNotReady();
    error AmountZero();
    error WrongStatus();

    constructor(address _registry, address _usdc) {
        registry = IRegistry(_registry);
        usdc = IERC20(_usdc);
    }

    // -------------- Read helpers --------------

    function getProposal(bytes32 node) external view returns (Proposal memory) {
        return _proposals[node];
    }

    function status(bytes32 node) external view returns (Status) {
        return _proposals[node].status;
    }

    // -------------- createProposal --------------

    struct CreateParams {
        bytes32 neighborhoodId;
        string  label;
        address executor;
        uint256 targetAmount;
        uint256 minMembers;
        uint64  deadline;
        uint64  warrantyDuration;
        uint256 attestationThreshold;
        string  resourceLabel;
        string  resourceType;
    }

    function createProposal(CreateParams calldata p) external returns (bytes32 proposalNode) {
        if (!registry.isMember(p.neighborhoodId, msg.sender)) revert NotMember();
        if (p.deadline <= block.timestamp) revert PastDeadline();

        proposalNode = NameCoder.namehash(p.neighborhoodId, keccak256(bytes(p.label)));
        if (_proposals[proposalNode].status != Status.None) revert WrongStatus();

        Proposal storage pr = _proposals[proposalNode];
        pr.neighborhoodId = p.neighborhoodId;
        pr.label = p.label;
        pr.executor = p.executor;
        pr.targetAmount = p.targetAmount;
        pr.minMembers = p.minMembers;
        pr.deadline = p.deadline;
        pr.warrantyDuration = p.warrantyDuration;
        pr.attestationThreshold = p.attestationThreshold;
        pr.resourceLabel = p.resourceLabel;
        pr.resourceType = p.resourceType;
        pr.status = Status.Active;

        // Register the proposal as a "proposal"-typed subname so the resolver can resolve it.
        registry.registerResource(p.neighborhoodId, p.label, "proposal", address(this));

        emit ProposalCreated(proposalNode, p.neighborhoodId, p.executor);
    }

    // -------------- commit / withdraw / claimRefund --------------

    function commit(bytes32 proposalNode, uint256 amount) external nonReentrant {
        if (amount == 0) revert AmountZero();
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Active) revert NotActive();
        if (block.timestamp >= pr.deadline) revert PastDeadline();
        if (!registry.isMember(pr.neighborhoodId, msg.sender)) revert NotMember();

        // Effect: pull USDC, update state
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (commitments[proposalNode][msg.sender] == 0) {
            pr.memberCount += 1;
        }
        commitments[proposalNode][msg.sender] += amount;
        pr.totalCommitted += amount;

        emit Committed(proposalNode, msg.sender, amount, pr.totalCommitted);

        // Threshold check
        if (pr.totalCommitted >= pr.targetAmount && pr.memberCount >= pr.minMembers) {
            _transitionToFunded(proposalNode);
        }
    }

    function withdraw(bytes32 proposalNode) external nonReentrant {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Active) revert NotActive();
        uint256 amount = commitments[proposalNode][msg.sender];
        if (amount == 0) revert AmountZero();

        commitments[proposalNode][msg.sender] = 0;
        pr.totalCommitted -= amount;
        pr.memberCount -= 1;

        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(proposalNode, msg.sender, amount);
    }

    function claimRefund(bytes32 proposalNode) external nonReentrant {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Expired) revert NotExpired();
        uint256 amount = commitments[proposalNode][msg.sender];
        if (amount == 0) revert AmountZero();

        commitments[proposalNode][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Refunded(proposalNode, msg.sender, amount);
    }

    // -------------- expiry --------------

    function checkExpiry(bytes32 proposalNode) external {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Active) revert NotActive();
        if (block.timestamp < pr.deadline) revert PastDeadline(); // not yet expired
        pr.status = Status.Expired;
        emit Expired(proposalNode);
    }

    // -------------- attestation & milestone release --------------

    function attest(bytes32 proposalNode) external nonReentrant {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Executing) revert WrongStatus();
        if (!registry.isMember(pr.neighborhoodId, msg.sender)) revert NotMember();
        if (hasAttested[proposalNode][msg.sender]) revert AlreadyAttested();

        hasAttested[proposalNode][msg.sender] = true;
        pr.attestationCount += 1;
        emit Attested(proposalNode, msg.sender, pr.attestationCount);

        if (pr.attestationCount >= pr.attestationThreshold && !pr.milestoneReleased[1]) {
            _releaseMilestone(proposalNode, 1);
            pr.attestedAt = uint64(block.timestamp);
        }
    }

    /// @notice Pull final 20% after the warranty window has elapsed since attestation.
    function claimWarrantyMilestone(bytes32 proposalNode) external nonReentrant {
        Proposal storage pr = _proposals[proposalNode];
        if (!pr.milestoneReleased[1]) revert MilestoneNotReady();
        if (pr.milestoneReleased[2]) revert MilestoneAlreadyReleased();
        if (block.timestamp < pr.attestedAt + pr.warrantyDuration) revert MilestoneNotReady();
        _releaseMilestone(proposalNode, 2);
        pr.status = Status.Completed;
    }

    function raiseDispute(bytes32 proposalNode) external {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Funded && pr.status != Status.Executing) revert WrongStatus();
        if (commitments[proposalNode][msg.sender] == 0) revert NotMember();
        pr.status = Status.Disputed;
        emit Disputed(proposalNode, msg.sender);
    }

    // -------------- internal --------------

    function _transitionToFunded(bytes32 proposalNode) internal {
        Proposal storage pr = _proposals[proposalNode];
        pr.status = Status.Executing; // skip past Funded sentinel; first milestone fires immediately
        pr.fundedAt = uint64(block.timestamp);
        emit ThresholdMet(proposalNode, pr.totalCommitted, pr.memberCount);

        // Auto-create the resource subname.
        bytes32 resourceNode = registry.registerResource(
            pr.neighborhoodId,
            pr.resourceLabel,
            pr.resourceType,
            address(this)
        );
        pr.resourceNode = resourceNode;
        registry.setText(resourceNode, "funded-by", pr.label);
        registry.setText(resourceNode, "status", "active");

        _releaseMilestone(proposalNode, 0);
    }

    function _releaseMilestone(bytes32 proposalNode, uint8 idx) internal {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.milestoneReleased[idx]) revert MilestoneAlreadyReleased();
        pr.milestoneReleased[idx] = true;

        uint256 amount = (pr.targetAmount * _milestoneBps(idx)) / 10_000;
        usdc.safeTransfer(pr.executor, amount);
        emit MilestoneReleased(proposalNode, idx, amount);
    }

    function _milestoneBps(uint8 idx) internal pure returns (uint16) {
        if (idx == 0) return MILESTONE_0_BPS;
        if (idx == 1) return MILESTONE_1_BPS;
        if (idx == 2) return MILESTONE_2_BPS;
        revert MilestoneNotReady();
    }
}
