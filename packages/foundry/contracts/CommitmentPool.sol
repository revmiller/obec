// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

interface IRegistry {
    function isMember(bytes32 neighborhoodId, address wallet) external view returns (bool);
    function neighborhoodAdmin(bytes32 neighborhoodId) external view returns (address);
    function registerResource(
        bytes32 neighborhoodId,
        string calldata label,
        string calldata resourceType,
        address fundedBy
    ) external returns (bytes32 resourceNode);
    function deactivateResource(bytes32 node) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;
    function setContenthash(bytes32 node, bytes calldata hash) external;
}

/// @title CommitmentPool
/// @notice Threshold-commit-execute-attest-release state machine for neighborhood proposals.
///         Settlement in USDC. One subname per project: registered at proposal creation,
///         deactivated on expiry so the dead row drops out of the neighborhood listing. The
///         pool's namehash slot remains tombstoned (Status.Expired); a retry needs a new label.
///         Status flips from "proposing" to "active" to "completed"/"expired" via text record.
contract CommitmentPool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IRegistry public immutable registry;
    IERC20   public immutable usdc;

    // 30/50/20 milestone split; basis points out of 10_000.
    uint16 public constant MILESTONE_0_BPS = 3_000;
    uint16 public constant MILESTONE_1_BPS = 5_000;
    uint16 public constant MILESTONE_2_BPS = 2_000;

    enum Status { None, Active, Executing, Completed, Expired, Disputed }

    struct Proposal {
        bytes32 neighborhoodId;
        string  label;                  // "cargo-bikes" — also the resource subname label
        address executor;
        uint256 targetAmount;
        uint256 minMembers;
        uint64  deadline;
        uint64  warrantyDuration;       // seconds; small for demo, 30 days default in production
        uint64  attestedAt;
        uint256 attestationThreshold;
        uint256 totalCommitted;
        uint256 memberCount;
        uint256 attestationCount;
        Status  status;
        bool[3] milestoneReleased;
    }

    mapping(bytes32 => Proposal) private _proposals;
    mapping(bytes32 => mapping(address => uint256)) public commitments;
    mapping(bytes32 => mapping(address => bool))    public hasAttested;
    mapping(bytes32 => address[]) private _attesters;

    event ProposalCreated(bytes32 indexed proposalNode, bytes32 indexed neighborhoodId, address executor);
    event Committed(bytes32 indexed proposalNode, address indexed member, uint256 amount, uint256 totalCommitted);
    event Withdrawn(bytes32 indexed proposalNode, address indexed member, uint256 amount);
    event ThresholdMet(bytes32 indexed proposalNode, uint256 totalCommitted, uint256 memberCount);
    event MilestoneReleased(bytes32 indexed proposalNode, uint8 indexed milestone, uint256 amount);
    event Attested(bytes32 indexed proposalNode, address indexed member, uint256 attestationCount);
    event Refunded(bytes32 indexed proposalNode, address indexed member, uint256 amount);
    event Expired(bytes32 indexed proposalNode);
    event Disputed(bytes32 indexed proposalNode, address indexed raiser);
    event DisputeResolved(bytes32 indexed proposalNode, bool refunded);

    error NotMember();
    error NotActive();
    error NotExpired();
    error PastDeadline();
    error AlreadyAttested();
    error MilestoneAlreadyReleased();
    error MilestoneNotReady();
    error AmountZero();
    error WrongStatus();
    error NotAdmin();
    error InvalidParams();

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

    function getAttesters(bytes32 node) external view returns (address[] memory) {
        return _attesters[node];
    }

    // -------------- createProposal --------------

    struct CreateParams {
        bytes32 neighborhoodId;
        string  label;                  // project name; becomes the ENS subname for the lifecycle
        address executor;
        uint256 targetAmount;
        uint256 minMembers;
        uint64  deadline;
        uint64  warrantyDuration;
        uint256 attestationThreshold;
        string  resourceType;           // "energy", "mobility", "tool", "space"
        string  description;            // free-form; written as text(node, "description") via the pool
    }

    function createProposal(CreateParams calldata p) external returns (bytes32 proposalNode) {
        if (!registry.isMember(p.neighborhoodId, msg.sender)) revert NotMember();
        if (p.deadline <= block.timestamp) revert PastDeadline();
        if (p.executor == address(0)) revert InvalidParams();
        if (p.targetAmount == 0) revert InvalidParams();
        if (p.minMembers == 0) revert InvalidParams();
        if (p.attestationThreshold == 0) revert InvalidParams();
        if (bytes(p.label).length == 0) revert InvalidParams();

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
        pr.status = Status.Active;

        // Register the project subname now; the same node serves as proposal and (post-funding) resource.
        registry.registerResource(p.neighborhoodId, p.label, p.resourceType, address(this));
        registry.setText(proposalNode, "status", "proposing");
        // Pool relays the description so a non-admin proposer (who isn't authorized on the
        // resource node directly) can still anchor it on the subname in one tx.
        if (bytes(p.description).length != 0) {
            registry.setText(proposalNode, "description", p.description);
        }

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
        uint256 commitment = commitments[proposalNode][msg.sender];
        if (commitment == 0) revert AmountZero();

        // Pro-rate by the unreleased fraction so the same path serves both natural pre-funding
        // expiry (no milestones released → full refund) and admin-resolved dispute refunds
        // (some milestones already paid the executor → committers split what's left).
        uint16 unreleasedBps = 10_000;
        if (pr.milestoneReleased[0]) unreleasedBps -= MILESTONE_0_BPS;
        if (pr.milestoneReleased[1]) unreleasedBps -= MILESTONE_1_BPS;
        if (pr.milestoneReleased[2]) unreleasedBps -= MILESTONE_2_BPS;
        uint256 amount = (commitment * unreleasedBps) / 10_000;

        commitments[proposalNode][msg.sender] = 0;
        if (amount > 0) usdc.safeTransfer(msg.sender, amount);
        emit Refunded(proposalNode, msg.sender, amount);
    }

    // -------------- expiry --------------

    function checkExpiry(bytes32 proposalNode) external {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Active) revert NotActive();
        if (block.timestamp < pr.deadline) revert PastDeadline(); // not yet expired

        pr.status = Status.Expired;

        registry.setText(proposalNode, "status", "expired");
        registry.deactivateResource(proposalNode);

        emit Expired(proposalNode);
    }

    // -------------- attestation & milestone release --------------

    function attest(bytes32 proposalNode) external nonReentrant {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Executing) revert WrongStatus();
        if (!registry.isMember(pr.neighborhoodId, msg.sender)) revert NotMember();
        if (hasAttested[proposalNode][msg.sender]) revert AlreadyAttested();

        hasAttested[proposalNode][msg.sender] = true;
        _attesters[proposalNode].push(msg.sender);
        pr.attestationCount += 1;
        emit Attested(proposalNode, msg.sender, pr.attestationCount);

        if (pr.attestationCount >= pr.attestationThreshold && !pr.milestoneReleased[1]) {
            // Anchor attesters as a verifiable credential on the project subname.
            registry.setText(proposalNode, "attestations", _formatAttesters(proposalNode));
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

        registry.setText(proposalNode, "status", "completed");
    }

    function raiseDispute(bytes32 proposalNode) external {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Executing) revert WrongStatus();
        if (commitments[proposalNode][msg.sender] == 0) revert NotMember();
        pr.status = Status.Disputed;

        registry.setText(proposalNode, "status", "disputed");

        emit Disputed(proposalNode, msg.sender);
    }

    /// @notice Neighborhood admin resolves a dispute. `refund=true` flips the proposal to
    ///         Expired so committers can claim their unreleased principal back; `refund=false`
    ///         resumes execution. Without this path a single committer's `raiseDispute` would
    ///         freeze pool funds permanently.
    function resolveDispute(bytes32 proposalNode, bool refund) external {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.status != Status.Disputed) revert WrongStatus();
        if (msg.sender != registry.neighborhoodAdmin(pr.neighborhoodId)) revert NotAdmin();

        if (refund) {
            pr.status = Status.Expired;
            registry.setText(proposalNode, "status", "expired");
            registry.deactivateResource(proposalNode);
        } else {
            pr.status = Status.Executing;
            registry.setText(proposalNode, "status", "active");
        }

        emit DisputeResolved(proposalNode, refund);
    }

    // -------------- internal --------------

    function _transitionToFunded(bytes32 proposalNode) internal {
        Proposal storage pr = _proposals[proposalNode];
        pr.status = Status.Executing; // first milestone fires immediately
        emit ThresholdMet(proposalNode, pr.totalCommitted, pr.memberCount);

        // Same subname registered at proposal creation; flip status and anchor maintainer.
        registry.setText(proposalNode, "status", "active");
        registry.setText(proposalNode, "maintainer", Strings.toHexString(pr.executor));

        _releaseMilestone(proposalNode, 0);
    }

    function _releaseMilestone(bytes32 proposalNode, uint8 idx) internal {
        Proposal storage pr = _proposals[proposalNode];
        if (pr.milestoneReleased[idx]) revert MilestoneAlreadyReleased();
        pr.milestoneReleased[idx] = true;

        // Milestones split totalCommitted (target is the threshold to trigger; all committed
        // funds flow to the executor over the three milestones). Avoids surplus dust.
        uint256 amount = (pr.totalCommitted * _milestoneBps(idx)) / 10_000;
        usdc.safeTransfer(pr.executor, amount);
        emit MilestoneReleased(proposalNode, idx, amount);
    }

    function _milestoneBps(uint8 idx) internal pure returns (uint16) {
        if (idx == 0) return MILESTONE_0_BPS;
        if (idx == 1) return MILESTONE_1_BPS;
        if (idx == 2) return MILESTONE_2_BPS;
        revert MilestoneNotReady();
    }

    function _formatAttesters(bytes32 proposalNode) internal view returns (string memory out) {
        address[] memory list = _attesters[proposalNode];
        for (uint256 i = 0; i < list.length; i++) {
            out = i == 0
                ? Strings.toHexString(list[i])
                : string.concat(out, ",", Strings.toHexString(list[i]));
        }
    }
}
