// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SignatureVerification {
    using ECDSA for bytes32;

    address internal _signer;

    function _createMessageHash(bytes32 hash) internal pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                hash
            )
        );
    }

    function _verify(bytes32 messageHash, bytes memory signature) internal view returns (bool) {
        return _signer == ECDSA.recover(messageHash, signature);
    }

    function _setSigner(address signer_) internal {
        _signer = signer_;
    }

    function getSigner() external view returns (address) {
        return _signer;
    }
}
