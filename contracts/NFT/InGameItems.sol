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
import "./interfaces/IInGameItems.sol";

contract InGameItems is
    IInGameItems,
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

    // items
    mapping(uint => Item) public items;
    // itemId => itemSeriesId => ItemSeries
    mapping(uint => ItemSeries[]) public itemSeriesMap;
    // counter for auto-incremented ids
    uint public lastOccupiedTokenId;

    event ItemSeriesAdded(
        uint indexed itemId,
        uint indexed itemSeriesId,
        uint startingTokenId,
        uint editionSize
    );

    function initialize(
        string memory _name,
        string memory _symbol,
        address admin,
        address pauser,
        address minter,
        address itemAdmin,
        address trustedForwarder_,
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

        _setTrustedForwarder(trustedForwarder_);

        lastOccupiedTokenId = 0;
    }

    function mint(
        address to,
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata qtys
    ) external override onlyRole(MINTER_ROLE) {
        require(
            itemIds.length == itemSeriesIds.length && itemIds.length == qtys.length,
                "InGameItems: Array length mismatch"
        );
        for (uint i = 0; i < itemIds.length; i++) {
            require(items[itemIds[i]].itemId != 0, "InGameItems: Item does not exist");
            ItemSeries storage currentItemSeries = itemSeriesMap[itemIds[i]][itemSeriesIds[i]];
            require(
                currentItemSeries.minted + qtys[i] <= currentItemSeries.editionSize,
                "InGameItems: Not enough tokens to mint from this series"
            );

            for (uint j = 0; j < qtys[i]; j++) {
                uint tokenId = currentItemSeries.startingTokenId + currentItemSeries.minted;
                currentItemSeries.minted++;
                _safeMint(to, tokenId);
            }
        }
    }

    function setupItems(Item[] calldata itemsIn) external onlyRole(ITEM_ADMIN_ROLE) {
        for (uint i = 0; i < itemsIn.length; i++) {
            Item memory item = itemsIn[i];
            require(item.itemId > 0, "InGameItems: Item id must be greater than 0");
            require(item.itemType > 0, "InGameItems: Item type must be greater than 0");
            items[item.itemId] = item;
        }
    }

    function setupItemSeries(ItemSeriesIn[] calldata itemSeriesIn) external onlyRole(ITEM_ADMIN_ROLE) {
        for (uint i = 0; i < itemSeriesIn.length; i++) {
            ItemSeriesIn memory currentItemSeriesIn = itemSeriesIn[i];
            // cannot have itemId that's 0
            require(
                currentItemSeriesIn.itemId > 0,
                "InGameItems: Item id must be greater than 0"
            );
            // cannot add a series for an item that doesn't exist
            require(
                items[currentItemSeriesIn.itemId].itemId != 0,
                "InGameItems: Item does not exist"
            );
            // can only add the next series
            require(
                itemSeriesMap[currentItemSeriesIn.itemId].length == currentItemSeriesIn.itemSeriesId,
                "InGameItems: Item series ID mismatch"
            );

            lastOccupiedTokenId += currentItemSeriesIn.editionSize;

            ItemSeries memory currentItemSeries;
            currentItemSeries.startingTokenId = lastOccupiedTokenId - currentItemSeriesIn.editionSize + 1;
            currentItemSeries.editionSize = currentItemSeriesIn.editionSize;
            currentItemSeries.itemId = currentItemSeriesIn.itemId;
            currentItemSeries.itemSeriesId = currentItemSeriesIn.itemSeriesId;

            itemSeriesMap[currentItemSeries.itemId].push(currentItemSeries);

            emit ItemSeriesAdded(
                currentItemSeries.itemId,
                currentItemSeriesIn.itemSeriesId,
                currentItemSeries.startingTokenId,
                currentItemSeries.editionSize
            );
        }
    }

    function getItem(uint itemId) external view override returns (Item memory) {
        require(itemId > 0, "InGameItems: Item id must be greater than 0");
        require(items[itemId].itemId != 0, "InGameItems: Item does not exist");
        return items[itemId];
    }

    function getItemSeries(uint itemId, uint itemSeriesId) external view override returns (ItemSeriesOut memory) {
        Item memory currentItem = items[itemId];
        require(currentItem.itemId != 0, "InGameItems: Item does not exist");
        require(
            itemSeriesMap[itemId].length > itemSeriesId,
            "InGameItems: itemSeriesId out of range"
        );
        ItemSeries memory currentItemSeries = itemSeriesMap[itemId][itemSeriesId];

        ItemSeriesOut memory currentItemSeriesOut;
        currentItemSeriesOut.itemId = currentItemSeries.itemId;
        currentItemSeriesOut.itemSeriesId = currentItemSeries.itemSeriesId;
        currentItemSeriesOut.startingTokenId = currentItemSeries.startingTokenId;
        currentItemSeriesOut.editionSize = currentItemSeries.editionSize;
        currentItemSeriesOut.minted = currentItemSeries.minted;
        currentItemSeriesOut.itemType = currentItem.itemType;
        currentItemSeriesOut.slots = currentItem.slots;

        return currentItemSeriesOut;
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

    function setTrustedForwarder(address forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(forwarder);
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
