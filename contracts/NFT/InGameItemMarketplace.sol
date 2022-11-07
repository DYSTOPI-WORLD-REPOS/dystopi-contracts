// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "./interfaces/IInGameItems.sol";

contract InGameItemMarketplace is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2771Recipient
{
    // can pause minting and transfers
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can configure items
    bytes32 public constant STORE_ADMIN_ROLE = keccak256("STORE_ADMIN_ROLE");

    struct ItemSeriesPricingIn {
        uint itemId;
        uint itemSeriesId;
        uint ethPrice;
        uint erc20Price;
        address erc20Address;
        bool active;
    }

    struct ItemSeriesPricing {
        uint ethPrice;
        uint erc20Price;
        address erc20Address;
        bool active;
    }

    // itemId => itemSeriesId => ItemSeriesPricing
    mapping(uint => ItemSeriesPricing[]) public itemSeriesPricingMap;

    function initialize(
        address admin,
        address pauser,
        address storeAdmin
    ) public initializer {
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(STORE_ADMIN_ROLE, storeAdmin);
    }

    function setupItemSeriesPricing(ItemSeriesPricingIn[] calldata itemSeriesPricingIn) external onlyRole(STORE_ADMIN_ROLE) {
        for (uint i = 0; i < itemSeriesPricingIn.length; i++) {
            ItemSeriesPricingIn memory currentItemSeriesPricingIn = itemSeriesPricingIn[i];
            ItemSeriesPricing[] memory itemSeriesForItemId = itemSeriesPricingMap[currentItemSeriesPricingIn.itemId];
            require(
                itemSeriesForItemId.length <= currentItemSeriesPricingIn.itemSeriesId,
                "InGameItemMarketplace: Item series ID mismatch"
            );

            ItemSeriesPricing memory newItemSeriesPricing;
            newItemSeriesPricing.active = currentItemSeriesPricingIn.active;
            newItemSeriesPricing.ethPrice = currentItemSeriesPricingIn.ethPrice;
            newItemSeriesPricing.erc20Address = currentItemSeriesPricingIn.erc20Address;
            newItemSeriesPricing.erc20Price = currentItemSeriesPricingIn.erc20Price;

            if (currentItemSeriesPricingIn.itemSeriesId < itemSeriesForItemId.length) {
                itemSeriesPricingMap[currentItemSeriesPricingIn.itemId][currentItemSeriesPricingIn.itemSeriesId] = newItemSeriesPricing;
            } else {
                itemSeriesPricingMap[currentItemSeriesPricingIn.itemId].push(newItemSeriesPricing);
            }
        }
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
