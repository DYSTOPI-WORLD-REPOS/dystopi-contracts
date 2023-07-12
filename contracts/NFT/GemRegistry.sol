// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "./interfaces/IInGameItems.sol";

contract GemRegistry is Initializable, AccessControlUpgradeable, PausableUpgradeable, ERC2771Recipient {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant GEM_ADMIN_ROLE = keccak256("GEM_ADMIN_ROLE");

    IInGameItems public inGameItems;

    uint[] internal _gemItemTypes;
    // gemItemType => itemType => isCompatible
    mapping(uint => mapping(uint => bool)) internal _gemCompatibilityMap;
    // gemItemType => compatible itemTypes
    mapping(uint => uint[]) internal _gemCompatibilityList;
    // tokenId => gemTokenId
    mapping(uint => uint[]) internal _insertedGems;

    event GemInserted(uint indexed tokenId, uint indexed gemTokenId);

    event GemItemTypeUpdated(uint indexed gemItemType, uint[] compatibleItemTypes);

    function initialize(address admin, address gemAdmin, address pauser, address inGameItemsAddress, address trustedForwarder_) public initializer {
        __AccessControl_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GEM_ADMIN_ROLE, gemAdmin);
        _grantRole(PAUSER_ROLE, pauser);

        _setTrustedForwarder(trustedForwarder_);

        inGameItems = IInGameItems(inGameItemsAddress);
    }

    function insertGem(
        uint tokenId,
        uint itemId,
        uint itemSeriesId,
        uint gemTokenId,
        uint gemItemId,
        uint gemItemSeriesId
    ) external whenNotPaused {
        ERC721Burnable inGameItemsERC721 = ERC721Burnable(address(inGameItems));

        require(_isApprovedOrOwner(_msgSender(), tokenId), "GemRegistry: caller is not owner of token");
        require(_isApprovedOrOwner(_msgSender(), gemTokenId), "GemRegistry: caller is not owner of gem token");

        IInGameItems.ItemSeriesOut memory itemSeries = inGameItems.getItemSeries(itemId, itemSeriesId);
        IInGameItems.ItemSeriesOut memory gemItemSeries = inGameItems.getItemSeries(gemItemId, gemItemSeriesId);

        require(
            tokenId >= itemSeries.startingTokenId && tokenId < itemSeries.startingTokenId + itemSeries.editionSize,
            "GemRegistry: tokenId is not in item series"
        );
        require(
            gemTokenId >= gemItemSeries.startingTokenId && gemTokenId < gemItemSeries.startingTokenId + gemItemSeries.editionSize,
            "GemRegistry: gemTokenId is not in gem item series"
        );
        require(
            _gemCompatibilityMap[gemItemSeries.itemType][itemSeries.itemType],
            "GemRegistry: gem is not compatible with item"
        );
        require(itemSeries.slots > _insertedGems[tokenId].length, "GemRegistry: item has no free slots");

        _insertedGems[tokenId].push(gemTokenId);
        inGameItemsERC721.burn(gemTokenId);

        emit GemInserted(tokenId, gemTokenId);
    }

    function setupGemItemType(uint _gemItemType, uint[] memory compatibleItemTypes) public onlyRole(GEM_ADMIN_ROLE) {
        require(compatibleItemTypes.length > 0, "GemRegistry: compatibleItemTypes must have length > 0");

        if (_gemCompatibilityList[_gemItemType].length == 0) {
            _gemItemTypes.push(_gemItemType);
        } else {
            for (uint i = 0; i < _gemCompatibilityList[_gemItemType].length; i++) {
                _gemCompatibilityMap[_gemItemType][_gemCompatibilityList[_gemItemType][i]] = false;
            }
            delete _gemCompatibilityList[_gemItemType];
        }
        for (uint i = 0; i < compatibleItemTypes.length; i++) {
            _gemCompatibilityMap[_gemItemType][compatibleItemTypes[i]] = true;
            _gemCompatibilityList[_gemItemType].push(compatibleItemTypes[i]);
        }
        emit GemItemTypeUpdated(_gemItemType, compatibleItemTypes);
    }

    function removeGemItemType(uint _gemItemType) public onlyRole(GEM_ADMIN_ROLE) {
        require(_gemCompatibilityList[_gemItemType].length > 0, "GemRegistry: gemItemType is not set");

        for (uint i = 0; i < _gemCompatibilityList[_gemItemType].length; i++) {
            _gemCompatibilityMap[_gemItemType][_gemCompatibilityList[_gemItemType][i]] = false;
        }
        delete _gemCompatibilityList[_gemItemType];
        for (uint i = 0; i < _gemItemTypes.length; i++) {
            if (_gemItemTypes[i] == _gemItemType) {
                _gemItemTypes[i] = _gemItemTypes[_gemItemTypes.length - 1];
                _gemItemTypes.pop();
                break;
            }
        }
        emit GemItemTypeUpdated(_gemItemType, new uint[](0));
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setTrustedForwarder(address forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(forwarder);
    }

    function setInGameItems(address inGameItemsAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        inGameItems = IInGameItems(inGameItemsAddress);
    }

    function gemItemTypes() public view returns (uint[] memory) {
        return _gemItemTypes;
    }

    function gemItemType(uint index) public view returns (uint) {
        return _gemItemTypes[index];
    }

    function gemCompatibilityMap(uint _gemItemType, uint itemType) public view returns (bool) {
        return _gemCompatibilityMap[_gemItemType][itemType];
    }

    function gemCompatibilityList(uint _gemItemType) public view returns (uint[] memory) {
        return _gemCompatibilityList[_gemItemType];
    }

    function gemCompatibilityByIndex(uint _gemItemType, uint index) public view returns (uint) {
        return _gemCompatibilityList[_gemItemType][index];
    }

    function insertedGems(uint tokenId) public view returns (uint[] memory) {
        return _insertedGems[tokenId];
    }

    function insertedGem(uint tokenId, uint index) public view returns (uint) {
        return _insertedGems[tokenId][index];
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        ERC721Burnable inGameItemsERC721 = ERC721Burnable(address(inGameItems));
        address owner = inGameItemsERC721.ownerOf(tokenId);
        return spender == owner || inGameItemsERC721.getApproved(tokenId) == spender || inGameItemsERC721.isApprovedForAll(owner, spender);
    }

    function _msgSender()
    internal
    view
    override(ContextUpgradeable, ERC2771Recipient)
    returns (address)
    {
        return ERC2771Recipient._msgSender();
    }

    function _msgData()
    internal
    view
    override(ContextUpgradeable, ERC2771Recipient)
    returns (bytes calldata)
    {
        return ERC2771Recipient._msgData();
    }
}
