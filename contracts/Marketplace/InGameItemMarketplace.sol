// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "../NFT/interfaces/IInGameItems.sol";

contract InGameItemMarketplace is
    Initializable,
    AccessControlUpgradeable,
    PausableUpgradeable,
    ERC2771Recipient
{
    using ECDSAUpgradeable for bytes32;

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
    // InGameItems contract to interact with
    IInGameItems internal _inGameItems;
    // nonces for signature verification
    mapping(bytes32 => bool) internal _nonces;
    // signer for signature verification
    address internal _signer;

    function initialize(
        address admin,
        address pauser,
        address storeAdmin,
        address signer_,
        address inGameItemsAddress
    ) public initializer {
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(STORE_ADMIN_ROLE, storeAdmin);

        _inGameItems = IInGameItems(inGameItemsAddress);
        _signer = signer_;
    }

    function purchase(
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata amounts,
        bytes32 nonce,
        bytes32 hash,
        bytes memory signature
    ) external payable whenNotPaused {
        require(
            matchAddressSigner(hash, signature),
            "InGameItemMarketplace: Direct minting is not allowed"
        );
        require(
            !_nonces[nonce],
            "InGameItemMarketplace: Nonce was already used"
        );
        require(
            hashTransaction(_msgSender(), itemIds, itemSeriesIds, amounts, nonce) == hash,
            "InGameItemMarketplace: Hash mismatch"
        );
        require(
            itemIds.length == itemSeriesIds.length && itemIds.length == amounts.length,
            "InGameItemMarketplace: Array length mismatch"
        );

        uint ethPriceTotal = 0;
        uint erc20PriceTotal = 0;
        address erc20Address = address(0);

        for (uint i = 0; i < itemIds.length; i++) {
            require(amounts[i] > 0, "InGameItemMarketplace: Cannot purchase 0 tokens");

            ItemSeriesPricing memory itemSeriesPricing = getItemSeriesPricing(itemIds[i], itemSeriesIds[i]);

            if (itemSeriesPricing.ethPrice > 0) {
                ethPriceTotal += itemSeriesPricing.ethPrice * amounts[i];
            } else {
                // in order for this to work optimally, itemSeries need to be ordered by erc20Address
                if (erc20Address != itemSeriesPricing.erc20Address && erc20PriceTotal > 0) {
                    IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
                    erc20Address = itemSeriesPricing.erc20Address;
                    erc20PriceTotal = 0;
                }
                if (erc20Address == itemSeriesPricing.erc20Address) {
                    erc20PriceTotal += itemSeriesPricing.erc20Price * amounts[i];
                }
            }
        }

        require(ethPriceTotal == msg.value, "InGameItemMarketplace: ETH price mismatch");

        _nonces[nonce] = true;

        if (erc20PriceTotal > 0) {
            IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
        }

        _inGameItems.mint(_msgSender(), itemIds, itemSeriesIds, amounts);
    }

    function setupItemSeriesPricing(ItemSeriesPricingIn[] calldata itemSeriesPricingIn)
    external
    onlyRole(STORE_ADMIN_ROLE)
    {
        for (uint i = 0; i < itemSeriesPricingIn.length; i++) {
            ItemSeriesPricingIn memory currentItemSeriesPricingIn = itemSeriesPricingIn[i];
            ItemSeriesPricing[] storage itemSeriesForItemId = itemSeriesPricingMap[currentItemSeriesPricingIn.itemId];
            require(
                itemSeriesForItemId.length <= currentItemSeriesPricingIn.itemSeriesId,
                "InGameItemMarketplace: Item series ID mismatch"
            );
            require(
                currentItemSeriesPricingIn.ethPrice > 0 ||
                currentItemSeriesPricingIn.erc20Price > 0 && currentItemSeriesPricingIn.erc20Address != address(0),
                "InGameItemMarketplace: Price must be defined in either an ERC20 or ETH"
            );

            ItemSeriesPricing memory newItemSeriesPricing;
            newItemSeriesPricing.active = currentItemSeriesPricingIn.active;
            newItemSeriesPricing.ethPrice = currentItemSeriesPricingIn.ethPrice;
            newItemSeriesPricing.erc20Address = currentItemSeriesPricingIn.erc20Address;
            newItemSeriesPricing.erc20Price = currentItemSeriesPricingIn.erc20Price;

            if (currentItemSeriesPricingIn.itemSeriesId < itemSeriesForItemId.length) {
                itemSeriesForItemId[currentItemSeriesPricingIn.itemSeriesId] = newItemSeriesPricing;
            } else {
                itemSeriesForItemId.push(newItemSeriesPricing);
            }
        }
    }

    function activateItemSeries(
        bool active,
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds
    ) external onlyRole(STORE_ADMIN_ROLE) {
        require(itemIds.length == itemSeriesIds.length, "InGameItemMarketplace: Array length mismatch");

        for (uint i = 0; i < itemIds.length; i++) {
            ItemSeriesPricing storage currentItemSeriesPricing = itemSeriesPricingMap[itemIds[i]][itemSeriesIds[i]];
            currentItemSeriesPricing.active = active;
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function getItemSeriesPricing(uint itemId, uint itemSeriesId)
    public
    view
    returns (ItemSeriesPricing memory)
    {
        require(
            itemSeriesPricingMap[itemId].length > itemSeriesId,
                "InGameItemMarketplace: Item series ID out of bounds"
        );

        return itemSeriesPricingMap[itemId][itemSeriesId];
    }

    function hashTransaction(
        address sender,
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata amounts,
        bytes32 nonce
    ) internal pure returns(bytes32) {
        bytes32 hash = keccak256(abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(abi.encodePacked(sender, itemIds, itemSeriesIds, amounts, nonce)))
        );

        return hash;
    }

    function matchAddressSigner(bytes32 hash, bytes memory signature) internal view returns(bool) {
        return _signer == hash.recover(signature);
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
