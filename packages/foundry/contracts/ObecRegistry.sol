// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { NameCoder } from "@ensdomains/ens-contracts/utils/NameCoder.sol";

/// @title ObecRegistry
/// @notice Stores neighborhoods, members, resources, and ENS-style text/contenthash records
///         keyed by ENS namehash. Used by ObecResolver (via CCIP-Read gateway) to resolve
///         subnames under ${PROTOCOL_ROOT}.
contract ObecRegistry {
    bytes32 public immutable PROTOCOL_ROOT_NAMEHASH;
    address public owner;
    address public commitmentPool;

    struct Neighborhood {
        string city;            // "prague"
        string name;            // "vinohrady"
        address admin;
        bool active;
    }

    struct Member {
        address wallet;
        bytes32 neighborhoodId;
        string label;           // just "anna"
        uint64 joinedAt;
        bool active;
    }

    struct Resource {
        bytes32 neighborhoodId;
        string label;           // "cargo-bikes"
        string resourceType;    // "energy", "mobility", "tool", "space"
        address fundedBy;       // pool address
        bool active;
    }

    mapping(bytes32 => Neighborhood) public neighborhoods;
    mapping(bytes32 => Member) public members;
    mapping(bytes32 => Resource) public resources;

    // node => labels stored leaf-first: ["anna", "vinohrady", "prague"]
    // Frontend appends ".${PROTOCOL_ROOT}" suffix when displaying.
    mapping(bytes32 => string[]) private _nodeLabels;

    mapping(address => bytes32) public addressToNode;

    mapping(bytes32 => mapping(string => string)) private _textRecords;
    mapping(bytes32 => bytes) private _contenthashes;

    mapping(bytes32 => bytes32[]) public neighborhoodMembers;
    mapping(bytes32 => bytes32[]) public neighborhoodResources;

    // 1-based index into neighborhoodResources[r.neighborhoodId]; 0 means "not present".
    // Tracked so deactivateResource is O(1) rather than scanning the array.
    //
    // Invariant: while resources[node].active is true, _resourceIndex[node] >= 1. Set together
    // in registerResource and cleared together in deactivateResource. Read sites that subtract 1
    // (currently only deactivateResource) rely on the active-check guard for underflow safety —
    // no separate idx != 0 check is needed.
    mapping(bytes32 => uint256) private _resourceIndex;

    event NeighborhoodCreated(bytes32 indexed neighborhoodId, string city, string name, address admin);
    event MemberJoined(bytes32 indexed neighborhoodId, bytes32 indexed memberNode, address wallet, string label);
    event ResourceRegistered(bytes32 indexed neighborhoodId, bytes32 indexed resourceNode, string label, string resourceType);
    event ResourceDeactivated(bytes32 indexed neighborhoodId, bytes32 indexed resourceNode);
    event TextSet(bytes32 indexed node, string key, string value);
    event ContenthashSet(bytes32 indexed node, bytes hash);
    event CommitmentPoolSet(address pool);

    error NotOwner();
    error NotPool();
    error PoolAlreadySet();
    error NeighborhoodNotFound();
    error ResourceNotActive();
    error AlreadyExists();
    error Unauthorized();

    constructor(bytes32 protocolRootNamehash) {
        PROTOCOL_ROOT_NAMEHASH = protocolRootNamehash;
        owner = msg.sender;
    }

    /// @notice Wires the CommitmentPool address. One-time setter callable by owner.
    function setCommitmentPool(address pool) external {
        if (msg.sender != owner) revert NotOwner();
        if (commitmentPool != address(0)) revert PoolAlreadySet();
        commitmentPool = pool;
        emit CommitmentPoolSet(pool);
    }

    // -------------- Neighborhood --------------

    function createNeighborhood(string calldata city, string calldata name) external returns (bytes32 neighborhoodId) {
        bytes32 cityNode = NameCoder.namehash(PROTOCOL_ROOT_NAMEHASH, keccak256(bytes(city)));
        neighborhoodId = NameCoder.namehash(cityNode, keccak256(bytes(name)));

        if (neighborhoods[neighborhoodId].active) revert AlreadyExists();

        neighborhoods[neighborhoodId] = Neighborhood({
            city: city,
            name: name,
            admin: msg.sender,
            active: true
        });

        string[] storage labels = _nodeLabels[neighborhoodId];
        labels.push(name);
        labels.push(city);

        emit NeighborhoodCreated(neighborhoodId, city, name, msg.sender);
    }

    // -------------- Member --------------

    function joinNeighborhood(bytes32 neighborhoodId, string calldata label) external returns (bytes32 memberNode) {
        Neighborhood memory n = neighborhoods[neighborhoodId];
        if (!n.active) revert NeighborhoodNotFound();
        if (addressToNode[msg.sender] != bytes32(0)) revert AlreadyExists();

        memberNode = NameCoder.namehash(neighborhoodId, keccak256(bytes(label)));
        if (members[memberNode].active) revert AlreadyExists();

        members[memberNode] = Member({
            wallet: msg.sender,
            neighborhoodId: neighborhoodId,
            label: label,
            joinedAt: uint64(block.timestamp),
            active: true
        });

        addressToNode[msg.sender] = memberNode;
        neighborhoodMembers[neighborhoodId].push(memberNode);

        string[] storage labels = _nodeLabels[memberNode];
        labels.push(label);
        labels.push(n.name);
        labels.push(n.city);

        emit MemberJoined(neighborhoodId, memberNode, msg.sender, label);
    }

    // -------------- Resource (Pool-only) --------------

    function registerResource(
        bytes32 neighborhoodId,
        string calldata label,
        string calldata resourceType,
        address fundedBy
    ) external returns (bytes32 resourceNode) {
        if (msg.sender != commitmentPool) revert NotPool();
        Neighborhood memory n = neighborhoods[neighborhoodId];
        if (!n.active) revert NeighborhoodNotFound();

        resourceNode = NameCoder.namehash(neighborhoodId, keccak256(bytes(label)));
        if (resources[resourceNode].active) revert AlreadyExists();

        resources[resourceNode] = Resource({
            neighborhoodId: neighborhoodId,
            label: label,
            resourceType: resourceType,
            fundedBy: fundedBy,
            active: true
        });

        bytes32[] storage list = neighborhoodResources[neighborhoodId];
        list.push(resourceNode);
        _resourceIndex[resourceNode] = list.length; // 1-based

        string[] storage labels = _nodeLabels[resourceNode];
        labels.push(label);
        labels.push(n.name);
        labels.push(n.city);

        emit ResourceRegistered(neighborhoodId, resourceNode, label, resourceType);
    }

    /// @notice Deactivate a resource so it drops out of the neighborhood listing. Pool-only;
    ///         called on expiry. The registry row goes inactive but the pool keeps the namehash
    ///         tombstoned in Status.Expired — a retry needs a new label.
    /// @dev O(1) via swap-and-pop guided by _resourceIndex (1-based).
    function deactivateResource(bytes32 node) external {
        if (msg.sender != commitmentPool) revert NotPool();
        Resource storage r = resources[node];
        if (!r.active) revert ResourceNotActive();

        bytes32 nbId = r.neighborhoodId;
        r.active = false;

        bytes32[] storage list = neighborhoodResources[nbId];
        uint256 idx = _resourceIndex[node] - 1; // safe: r.active implied a present index >= 1
        uint256 lastIdx = list.length - 1;

        if (idx != lastIdx) {
            bytes32 swapped = list[lastIdx];
            list[idx] = swapped;
            _resourceIndex[swapped] = idx + 1;
        }

        list.pop();
        delete _resourceIndex[node];

        emit ResourceDeactivated(nbId, node);
    }

    // -------------- Text & contenthash records --------------

    /// @notice Set a text record on a node. Member's own node, neighborhood admin, or pool may write.
    function setText(bytes32 node, string calldata key, string calldata value) external {
        if (!_canModify(node, msg.sender)) revert Unauthorized();
        _textRecords[node][key] = value;
        emit TextSet(node, key, value);
    }

    /// @notice Set ENS contenthash on a node (typically a project node pointing at IPFS).
    function setContenthash(bytes32 node, bytes calldata hash) external {
        if (!_canModify(node, msg.sender)) revert Unauthorized();
        _contenthashes[node] = hash;
        emit ContenthashSet(node, hash);
    }

    function _canModify(bytes32 node, address caller) internal view returns (bool) {
        // Pool grant comes first by design: the pool writes status/maintainer/attestations on
        // project nodes whose Resource row may be inactive (post-expiry tombstone) or whose
        // membership-derived permissions don't apply. Reordering the membership/ownership
        // checks ahead of this would re-gate writes the lifecycle relies on.
        if (caller == commitmentPool) return true;
        // Registry owner can write on the protocol root itself (e.g. text(obec.eth, "cities")
        // for federation discovery — frames the root as an ENS-native data structure).
        if (node == PROTOCOL_ROOT_NAMEHASH && caller == owner) return true;
        Member memory m = members[node];
        if (m.active) {
            if (m.wallet == caller) return true;
            if (neighborhoods[m.neighborhoodId].admin == caller) return true;
        }
        Resource memory r = resources[node];
        if (r.active) {
            if (neighborhoods[r.neighborhoodId].admin == caller) return true;
            if (r.fundedBy == caller) return true;
        }
        // Neighborhood admin can write on the neighborhood node itself
        if (neighborhoods[node].admin == caller && neighborhoods[node].active) return true;
        return false;
    }

    // -------------- Reads --------------

    function getText(bytes32 node, string calldata key) external view returns (string memory) {
        return _textRecords[node][key];
    }

    function getContenthash(bytes32 node) external view returns (bytes memory) {
        return _contenthashes[node];
    }

    function getNodeByAddress(address wallet) external view returns (bytes32) {
        return addressToNode[wallet];
    }

    /// @notice Returns labels leaf-first (e.g. ["anna","vinohrady","prague"]).
    ///         Caller appends the protocol-root suffix to display the full ENS name.
    function getNodeLabels(bytes32 node) external view returns (string[] memory) {
        return _nodeLabels[node];
    }

    function getNeighborhoodMembers(bytes32 neighborhoodId) external view returns (bytes32[] memory) {
        return neighborhoodMembers[neighborhoodId];
    }

    function getNeighborhoodResources(bytes32 neighborhoodId) external view returns (bytes32[] memory) {
        return neighborhoodResources[neighborhoodId];
    }

    function isMember(bytes32 neighborhoodId, address wallet) external view returns (bool) {
        bytes32 node = addressToNode[wallet];
        if (node == bytes32(0)) return false;
        Member memory m = members[node];
        return m.active && m.neighborhoodId == neighborhoodId;
    }

    /// @notice Returns the admin of a neighborhood (zero if unknown / inactive).
    function neighborhoodAdmin(bytes32 neighborhoodId) external view returns (address) {
        Neighborhood memory n = neighborhoods[neighborhoodId];
        return n.active ? n.admin : address(0);
    }
}
