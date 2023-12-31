// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils/SignatureVerification.sol";

contract InGameAssetMarketplace is
    AccessControl,
    Pausable,
    ERC2771Recipient,
    SignatureVerification
{
    // can pause minting and transfers
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can configure assets
    bytes32 public constant STORE_ADMIN_ROLE = keccak256("STORE_ADMIN_ROLE");
    // able to withdraw funds
    bytes32 public constant BENEFICIARY_ROLE = keccak256("BENEFICIARY_ROLE");

    struct Asset {
        uint assetId;
        uint ethPrice;
        uint erc20Price;
        address erc20Address;
        bool active;
    }

    event AssetUpdated(
        uint assetId,
        uint ethPrice,
        uint erc20Price,
        address erc20Address,
        bool active
    );

    event AssetPurchased(
        address indexed buyer,
        uint indexed assetId,
        uint qty,
        uint indexed receiptId
    );

    // assetId => Asset
    mapping(uint => Asset) public assetMap;
    // nonces for signature verification
    mapping(bytes32 => bool) internal _nonces;

    constructor(
        address admin,
        address pauser,
        address storeAdmin,
        address beneficiary,
        address signer_,
        address trustedForwarder_
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(STORE_ADMIN_ROLE, storeAdmin);
        _grantRole(BENEFICIARY_ROLE, beneficiary);
        _setSigner(signer_);
        _setTrustedForwarder(trustedForwarder_);
    }

    function purchase(
        uint[] calldata assetIds,
        uint[] calldata qtys,
        uint[] calldata receiptIds,
        bytes32 nonce,
        bytes32 hash,
        bytes memory signature
    ) external payable whenNotPaused {
        require(
            assetIds.length == qtys.length,
            "InGameAssetMarketplace: Array length mismatch"
        );
        require(
            assetIds.length > 0,
            "InGameAssetMarketplace: No assets to purchase"
        );
        require(
            !_nonces[nonce],
            "InGameAssetMarketplace: Nonce was already used"
        );
        require(
            _verify(hash, signature),
            "InGameAssetMarketplace: Message was not signed by signer"
        );
        require(
            hash == _createMessageHash(_createHash(_msgSender(), assetIds, qtys, receiptIds, nonce)),
            "InGameAssetMarketplace: Hash mismatch"
        );

        uint ethPriceTotal = 0;
        uint erc20PriceTotal = 0;
        address erc20Address = address(0);

        for (uint i = 0; i < assetIds.length; i++) {
            require(qtys[i] > 0, "InGameAssetMarketplace: Cannot purchase 0 assets");

            Asset storage asset = assetMap[assetIds[i]];

            require(asset.active, "InGameAssetMarketplace: Asset is not active");

            // eth price takes precedence, if both are gt 0
            if (asset.ethPrice > 0) {
                ethPriceTotal += asset.ethPrice * qtys[i];
            } else {
                // in order for this to work optimally, itemSeries need to be ordered by erc20Address
                if (erc20Address != asset.erc20Address) {
                    if (erc20PriceTotal > 0 && erc20Address != address(0)) {
                        IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
                        erc20PriceTotal = 0;
                    }
                    erc20Address = asset.erc20Address;
                }
                if (erc20Address == asset.erc20Address) {
                    erc20PriceTotal += asset.erc20Price * qtys[i];
                }
            }

            emit AssetPurchased(_msgSender(), assetIds[i], qtys[i], receiptIds[i]);
        }

        require(ethPriceTotal == msg.value, "InGameAssetMarketplace: ETH price mismatch");

        _nonces[nonce] = true;

        if (erc20PriceTotal > 0 && erc20Address != address(0)) {
            IERC20(erc20Address).transferFrom(_msgSender(), address(this), erc20PriceTotal);
        }
    }

    function setupAssets(Asset[] calldata assets) external onlyRole(STORE_ADMIN_ROLE) {
        for (uint i = 0; i < assets.length; i++) {
            require(
                assets[i].ethPrice > 0 ||
                assets[i].erc20Price > 0 && assets[i].erc20Address != address(0),
                "InGameAssetMarketplace: Price must be defined in either an ERC20 or ETH"
            );
            assetMap[assets[i].assetId] = assets[i];

            emit AssetUpdated(
                assets[i].assetId,
                assets[i].ethPrice,
                assets[i].erc20Price,
                assets[i].erc20Address,
                assets[i].active
            );
        }
    }

    function activateAssets(bool active, uint[] calldata assetIds) external onlyRole(STORE_ADMIN_ROLE) {
        for (uint i = 0; i < assetIds.length; i++) {
            assetMap[assetIds[i]].active = active;

            emit AssetUpdated(
                assetMap[assetIds[i]].assetId,
                assetMap[assetIds[i]].ethPrice,
                assetMap[assetIds[i]].erc20Price,
                assetMap[assetIds[i]].erc20Address,
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

    function setTrustedForwarder(address forwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(forwarder);
    }

    function setSigner(address signer_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _signer = signer_;
    }

    function _createHash(
        address sender,
        uint[] calldata assetIds,
        uint[] calldata qtys,
        uint[] calldata receiptIds,
        bytes32 nonce
    ) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(sender, assetIds, qtys, receiptIds, nonce));
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
