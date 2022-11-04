// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";

contract ERC721WithBaseUriUpgradeable is ERC721Upgradeable {
    string public baseURI;

    function _setBaseURI(string memory baseURI_) internal virtual {
        baseURI = baseURI_;
    }

    function _baseURI() internal view override virtual returns (string memory) {
        return baseURI;
    }
}
