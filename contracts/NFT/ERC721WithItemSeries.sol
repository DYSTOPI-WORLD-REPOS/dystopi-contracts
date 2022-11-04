// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "./base/ERC721WithBaseUriUpgradeable.sol";

contract ERC721WithItemSeries is
    Initializable,
    ERC721Upgradeable,
    ERC721BurnableUpgradeable,
    ERC721WithBaseUriUpgradeable,
    ERC2771Recipient,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    // can pause minting and transfers
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can mint new tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    // can configure items
    bytes32 public constant ITEM_ADMIN_ROLE = keccak256("ITEM_ADMIN_ROLE");

    struct ItemSeries {
        uint itemId;
        uint startingTokenId;
        uint editionSize;
        uint minted;
    }

    struct ItemSeriesIn {
        uint itemId;
        uint itemSeriesId;
        uint editionSize;
    }

    // itemId => itemSeriesId => ItemSeries
    mapping(uint => ItemSeries[]) public itemSeriesMap;
    // counter for auto-incremented ids
    uint public lastOccupiedTokenId;

    function initialize(
        string memory _name,
        string memory _symbol,
        address admin,
        address pauser,
        address minter,
        address itemAdmin,
        string memory baseURI_
    ) initializer public {
        __ERC721_init(_name, _symbol);
        __ERC721WithBaseUriUpgradeable_init(baseURI_);
        __Pausable_init();

        // can revoke and assign roles
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(ITEM_ADMIN_ROLE, itemAdmin);

        lastOccupiedTokenId = 0;
    }

    function mint(
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata amounts
    ) external onlyRole(MINTER_ROLE) {
        for (uint i = 0; i < itemIds.length; i++) {
            require(
                itemSeriesMap[itemIds[i]].length > itemSeriesIds[i],
                "ERC721WithItemSeries: itemSeriesId out of range"
            );
            ItemSeries storage currentItemSeries = itemSeriesMap[itemIds[i]][itemSeriesIds[i]];
            require(
                currentItemSeries.minted + amounts[i] <= currentItemSeries.editionSize,
                "ERC721WithItemSeries: Not enough tokens to mint from this series"
            );

            for (uint j = 0; j < amounts[i]; j++) {
                currentItemSeries.minted++;
                _safeMint(_msgSender(), currentItemSeries.minted);
            }
        }
    }

    function setupItemSeries(ItemSeriesIn[] calldata itemSeriesIn) external onlyRole(ITEM_ADMIN_ROLE) {
        for (uint i = 0; i < itemSeriesIn.length; i++) {
            ItemSeriesIn memory currentItemSeriesIn = itemSeriesIn[i];
            require(
                itemSeriesMap[currentItemSeriesIn.itemId].length + 1 == currentItemSeriesIn.itemSeriesId,
                "ERC721WithItemSeries: Item series ID mismatch"
            );

            lastOccupiedTokenId++;

            ItemSeries memory currentItemSeries;
            currentItemSeries.startingTokenId = lastOccupiedTokenId;
            currentItemSeries.editionSize = currentItemSeriesIn.editionSize;
            currentItemSeries.itemId = currentItemSeriesIn.itemId;

            itemSeriesMap[currentItemSeries.itemId].push(currentItemSeries);
        }
    }

    function setBaseURI(string memory baseURI_) external onlyRole(ITEM_ADMIN_ROLE) {
        _setBaseURI(baseURI_);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId)
    internal
    whenNotPaused
    override
    {
        super._beforeTokenTransfer(from, to, tokenId);
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

    function _baseURI()
    internal
    view
    override(ERC721Upgradeable, ERC721WithBaseUriUpgradeable)
    returns (string memory)
    {
        return ERC721WithBaseUriUpgradeable._baseURI();
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721Upgradeable, AccessControlUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
