// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { IExtendedResolver } from "@ensdomains/ens-contracts/resolvers/profiles/IExtendedResolver.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ObecResolver
/// @notice ENS wildcard + CCIP-Read resolver. Defers all queries to a signed gateway response.
///         Designed to be set as the resolver for ${PROTOCOL_ROOT} on Sepolia ENS.
contract ObecResolver is IExtendedResolver, ERC165 {
    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    error SignatureExpired();
    error UnauthorizedSigner();
    error NotOwner();

    address public owner;
    string[] public gatewayUrls;
    mapping(address => bool) public isSigner;

    event GatewayUrlsSet(string[] urls);
    event SignerSet(address signer, bool allowed);
    event OwnerTransferred(address previousOwner, address newOwner);

    constructor(string[] memory _urls, address _signer) {
        owner = msg.sender;
        for (uint256 i = 0; i < _urls.length; i++) {
            gatewayUrls.push(_urls[i]);
        }
        isSigner[_signer] = true;
        emit GatewayUrlsSet(_urls);
        emit SignerSet(_signer, true);
    }

    // -------- admin --------

    function setGatewayUrls(string[] calldata urls) external onlyOwner {
        delete gatewayUrls;
        for (uint256 i = 0; i < urls.length; i++) {
            gatewayUrls.push(urls[i]);
        }
        emit GatewayUrlsSet(urls);
    }

    function setSigner(address signer, bool allowed) external onlyOwner {
        isSigner[signer] = allowed;
        emit SignerSet(signer, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // -------- ENSIP-10 / EIP-3668 --------

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IExtendedResolver).interfaceId
            || super.supportsInterface(interfaceId);
    }

    /// @notice Always reverts with OffchainLookup; client follows the gateway URL to fetch a signed result.
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory) {
        bytes memory callData = abi.encode(name, data);
        revert OffchainLookup(
            address(this),
            gatewayUrls,
            callData,
            this.resolveWithProof.selector,
            callData
        );
    }

    /// @notice Verifies the gateway's signed response and returns the result.
    /// @dev Signature scheme:
    ///      sigHash = keccak256(0x1900 || verifierAddress || expiry || keccak256(extraData) || keccak256(result))
    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (bytes memory result, uint64 expiry, bytes memory sig) = abi.decode(response, (bytes, uint64, bytes));
        if (block.timestamp >= expiry) revert SignatureExpired();

        bytes32 sigHash = keccak256(abi.encodePacked(
            hex"1900",
            address(this),
            expiry,
            keccak256(extraData),
            keccak256(result)
        ));

        address signer = ECDSA.recover(sigHash, sig);
        if (!isSigner[signer]) revert UnauthorizedSigner();

        return result;
    }
}
