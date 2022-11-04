// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract ERC721WithBaseUriUpgradeable is Initializable, ERC721Upgradeable {
    string public baseURI;

    function __ERC721WithBaseUriUpgradeable_init(string memory baseURI_) internal onlyInitializing {
        __ERC721WithBaseUriUpgradeable_init_unchained(baseURI_);
    }

    function __ERC721WithBaseUriUpgradeable_init_unchained(string memory baseURI_) internal onlyInitializing {
        _setBaseURI(baseURI_);
    }

    function _setBaseURI(string memory baseURI_) internal virtual {
        baseURI = baseURI_;
    }

    function _baseURI() internal view override virtual returns (string memory) {
        return baseURI;
    }
}
