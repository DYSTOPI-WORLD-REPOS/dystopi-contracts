// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "../NFT/interfaces/IInGameItems.sol";
import "../Utils/SignatureVerification.sol";

contract InGameItemMarketplace is
    AccessControl,
    Pausable,
    ERC2771Recipient,
    SignatureVerification
{

    // can pause minting and transfers
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can configure items
    bytes32 public constant STORE_ADMIN_ROLE = keccak256("STORE_ADMIN_ROLE");
    // able to withdraw funds
    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

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

    event ItemSeriesPricingUpdated(
        uint itemId,
        uint itemSeriesId,
        uint ethPrice,
        uint erc20Price,
        address erc20Address,
        bool active
    );

    constructor(
        address admin,
        address pauser,
        address storeAdmin,
        address beneficiary,
        address signer_,
        address inGameItemsAddress,
        address trustedForwarder_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(STORE_ADMIN_ROLE, storeAdmin);
        _grantRole(BENEFICIARY_ROLE, beneficiary);

        _inGameItems = IInGameItems(inGameItemsAddress);
        _setSigner(signer_);
        _setTrustedForwarder(trustedForwarder_);
    }

    function purchase(
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata qtys,
        bytes32 nonce,
        bytes32 hash,
        bytes memory signature
    ) external payable whenNotPaused {
        require(
            _verify(hash, signature),
            "InGameItemMarketplace: Message was not signed by signer"
        );
        require(
            !_nonces[nonce],
            "InGameItemMarketplace: Nonce was already used"
        );
        require(
            hash == _createMessageHash(_createHash(_msgSender(), itemIds, itemSeriesIds, qtys, nonce)),
            "InGameItemMarketplace: Hash mismatch"
        );
        require(
            itemIds.length == itemSeriesIds.length && itemIds.length == qtys.length,
            "InGameItemMarketplace: Array length mismatch"
        );
        require(
            itemIds.length > 0,
            "InGameItemMarketplace: No items to purchase"
        );

        uint ethPriceTotal = 0;
        uint erc20PriceTotal = 0;
        address erc20Address = address(0);

        for (uint i = 0; i < itemIds.length; i++) {
            require(qtys[i] > 0, "InGameItemMarketplace: Cannot purchase 0 tokens");
            require(
                itemSeriesPricingMap[itemIds[i]].length > itemSeriesIds[i],
                "InGameItemMarketplace: Item series ID out of bounds"
            );

            ItemSeriesPricing storage itemSeriesPricing = itemSeriesPricingMap[itemIds[i]][itemSeriesIds[i]];

            require(itemSeriesPricing.active, "InGameItemMarketplace: Item series is not active");

            // eth price takes precedence, if both are gt 0
            if (itemSeriesPricing.ethPrice > 0) {
                ethPriceTotal += itemSeriesPricing.ethPrice * qtys[i];
            } else {
                // in order for this to work optimally, itemSeries need to be ordered by erc20Address
                if (erc20Address != itemSeriesPricing.erc20Address) {
                    if (erc20PriceTotal > 0 && erc20Address != address(0)) {
                        IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
                        erc20PriceTotal = 0;
                    }
                    erc20Address = itemSeriesPricing.erc20Address;
                }
                if (erc20Address == itemSeriesPricing.erc20Address) {
                    erc20PriceTotal += itemSeriesPricing.erc20Price * qtys[i];
                }
            }
        }

        require(ethPriceTotal == msg.value, "InGameItemMarketplace: ETH price mismatch");

        _nonces[nonce] = true;

        if (erc20PriceTotal > 0 && erc20Address != address(0)) {
            IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
        }

        _inGameItems.mint(_msgSender(), itemIds, itemSeriesIds, qtys);
    }

    function setupItemSeriesPricing(ItemSeriesPricingIn[] calldata itemSeriesPricingIn)
    external
    onlyRole(STORE_ADMIN_ROLE)
    {
        for (uint i = 0; i < itemSeriesPricingIn.length; i++) {
            ItemSeriesPricingIn calldata currentItemSeriesPricingIn = itemSeriesPricingIn[i];
            ItemSeriesPricing[] storage itemSeriesForItemId = itemSeriesPricingMap[currentItemSeriesPricingIn.itemId];
            require(
                itemSeriesForItemId.length >= currentItemSeriesPricingIn.itemSeriesId,
                "InGameItemMarketplace: Item series ID mismatch"
            );
            require(
                currentItemSeriesPricingIn.ethPrice > 0 ||
                currentItemSeriesPricingIn.erc20Price > 0 && currentItemSeriesPricingIn.erc20Address != address(0),
                "InGameItemMarketplace: Price must be defined in either an ERC20 or ETH"
            );

            if (currentItemSeriesPricingIn.itemSeriesId < itemSeriesForItemId.length) {
                itemSeriesForItemId[currentItemSeriesPricingIn.itemSeriesId] = ItemSeriesPricing(
                    currentItemSeriesPricingIn.ethPrice,
                    currentItemSeriesPricingIn.erc20Price,
                    currentItemSeriesPricingIn.erc20Address,
                    currentItemSeriesPricingIn.active
                );
            } else {
                itemSeriesForItemId.push(
                    ItemSeriesPricing(
                        currentItemSeriesPricingIn.ethPrice,
                        currentItemSeriesPricingIn.erc20Price,
                        currentItemSeriesPricingIn.erc20Address,
                        currentItemSeriesPricingIn.active
                    )
                );
            }

            emit ItemSeriesPricingUpdated(
                currentItemSeriesPricingIn.itemId,
                currentItemSeriesPricingIn.itemSeriesId,
                currentItemSeriesPricingIn.ethPrice,
                currentItemSeriesPricingIn.erc20Price,
                currentItemSeriesPricingIn.erc20Address,
                currentItemSeriesPricingIn.active
            );
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

            emit ItemSeriesPricingUpdated(
                itemIds[i],
                itemSeriesIds[i],
                currentItemSeriesPricing.ethPrice,
                currentItemSeriesPricing.erc20Price,
                currentItemSeriesPricing.erc20Address,
                active
            );
        }
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function withdrawEth(uint amount) external onlyRole(BENEFICIARY_ROLE) {
        payable(_msgSender()).transfer(amount);
    }

    function withdrawErc20(address tokenAddress, uint amount) external onlyRole(BENEFICIARY_ROLE) {
        IERC20(tokenAddress).transfer(_msgSender(), amount);
    }

    function setInGameItems(address inGameItemsAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _inGameItems = IInGameItems(inGameItemsAddress);
    }

    function setTrustedForwarder(address forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(forwarder);
    }

    function setSigner(address signer_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _signer = signer_;
    }

    function getInGameItems() external view returns (address) {
        return address(_inGameItems);
    }

    function getItemSeriesPricingLength(uint itemId) external view returns (uint) {
        return itemSeriesPricingMap[itemId].length;
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

    function _createHash(
        address sender,
        uint[] calldata itemIds,
        uint[] calldata itemSeriesIds,
        uint[] calldata qtys,
        bytes32 nonce
    ) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(sender, itemIds, itemSeriesIds, qtys, nonce));
    }

    function _msgSender()
    internal
    view
    override(Context, ERC2771Recipient)
    returns (address)
    {
        return ERC2771Recipient._msgSender();
    }

    function _msgData()
    internal
    view
    override(Context, ERC2771Recipient)
    returns (bytes calldata)
    {
        return ERC2771Recipient._msgData();
    }
}
