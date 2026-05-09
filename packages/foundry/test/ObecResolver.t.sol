// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import { Test } from "forge-std/Test.sol";
import { ObecResolver } from "../contracts/ObecResolver.sol";

contract ObecResolverTest is Test {
    ObecResolver resolver;

    uint256 signerKey = 0xA11CE;
    address signer    = vm.addr(signerKey);
    address eve       = makeAddr("eve");

    function setUp() public {
        string[] memory urls = new string[](1);
        urls[0] = "https://obec.vercel.app/api/ccip/{sender}/{data}";
        resolver = new ObecResolver(urls, signer);
    }

    function test_supportsInterface_extendedResolver() public view {
        assertTrue(resolver.supportsInterface(0x9061b923)); // IExtendedResolver
        assertTrue(resolver.supportsInterface(0x01ffc9a7)); // ERC165
        assertFalse(resolver.supportsInterface(0xdeadbeef));
    }

    function test_resolve_revertsWithOffchainLookup() public {
        bytes memory name = bytes("anna.vinohrady.prague.obec.eth");
        bytes memory data = abi.encodeWithSignature("addr(bytes32)", bytes32(uint256(0x1234)));

        // Expect OffchainLookup revert; selector is keccak256("OffchainLookup(address,string[],bytes,bytes4,bytes)")
        vm.expectRevert();
        resolver.resolve(name, data);
    }

    function test_resolveWithProof_acceptsValidSignature() public view {
        bytes memory result = abi.encode(address(0xBEEF));
        uint64 expiry = uint64(block.timestamp + 60);
        bytes memory extraData = abi.encode(bytes("name"), bytes("data"));

        bytes memory sig = _sign(result, expiry, extraData);
        bytes memory response = abi.encode(result, expiry, sig);

        bytes memory got = resolver.resolveWithProof(response, extraData);
        assertEq(keccak256(got), keccak256(result));
    }

    function test_resolveWithProof_rejectsExpired() public {
        bytes memory result = abi.encode(address(0xBEEF));
        uint64 expiry = uint64(block.timestamp);  // already past
        bytes memory extraData = abi.encode(bytes("name"), bytes("data"));
        bytes memory sig = _sign(result, expiry, extraData);
        bytes memory response = abi.encode(result, expiry, sig);

        vm.expectRevert(ObecResolver.SignatureExpired.selector);
        resolver.resolveWithProof(response, extraData);
    }

    function test_resolveWithProof_rejectsBadSigner() public {
        bytes memory result = abi.encode(address(0xBEEF));
        uint64 expiry = uint64(block.timestamp + 60);
        bytes memory extraData = abi.encode(bytes("name"), bytes("data"));

        // Sign with a key that's not authorized
        uint256 evilKey = 0xBADBAD;
        bytes32 sigHash = _digest(result, expiry, extraData);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(evilKey, sigHash);
        bytes memory sig = abi.encodePacked(r, s, v);
        bytes memory response = abi.encode(result, expiry, sig);

        vm.expectRevert(ObecResolver.UnauthorizedSigner.selector);
        resolver.resolveWithProof(response, extraData);
    }

    function test_setSigner_onlyOwner() public {
        vm.prank(eve);
        vm.expectRevert(ObecResolver.NotOwner.selector);
        resolver.setSigner(eve, true);

        resolver.setSigner(eve, true);
        assertTrue(resolver.isSigner(eve));
    }

    function test_setGatewayUrls_onlyOwner() public {
        string[] memory urls = new string[](1);
        urls[0] = "https://different.example/{sender}/{data}";

        vm.prank(eve);
        vm.expectRevert(ObecResolver.NotOwner.selector);
        resolver.setGatewayUrls(urls);

        resolver.setGatewayUrls(urls);
        assertEq(resolver.gatewayUrls(0), urls[0]);
    }

    // -------- helpers --------

    function _digest(bytes memory result, uint64 expiry, bytes memory extraData) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            hex"1900",
            address(resolver),
            expiry,
            keccak256(extraData),
            keccak256(result)
        ));
    }

    function _sign(bytes memory result, uint64 expiry, bytes memory extraData) internal view returns (bytes memory) {
        bytes32 d = _digest(result, expiry, extraData);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, d);
        return abi.encodePacked(r, s, v);
    }
}
