// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";


contract DYSToken is ERC20, ERC2771Recipient, AccessControl, Pausable {
    // can pause the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can withdraw tokens and eth
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    // can configure fees
    bytes32 public constant FEE_ADMIN_ROLE = keccak256("FEE_ADMIN_ROLE");

    uint public buyFeePercentage = 0; // decimal 10000
    uint public sellFeePercentage = 0; // decimal 10000

    // uniswap v2 router
    IUniswapV2Router02 public immutable v2Router;
    // dex routers to and from which sell and buy fees apply
    mapping(address => bool) public isDex;
    // addresses exempt from sell and buy fees
    mapping (address => bool) public whitelist;
    // whether to convert buy and sell fees to eth
    bool public swapFeesToEth = true;

    receive() external payable {}

    constructor(
        address admin,
        address pauser,
        address feeAdmin,
        address treasurer,
        address v2RouterAddress,
        address beneficiary,
        uint totalSupply_
    ) ERC20("DYSEUM Token", "DYS") {
        require(totalSupply_ > 0, "DYSToken: Total supply cannot be zero");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(FEE_ADMIN_ROLE, feeAdmin);
        _grantRole(TREASURER_ROLE, treasurer);

        // minting all tokens to the beneficiary initially
        _mint(beneficiary, totalSupply_ * 10 ** decimals());

        // setting up the uniswap router
        v2Router = IUniswapV2Router02(v2RouterAddress);
        // approving uniswap router to spend tokens
        _approve(address(this), v2RouterAddress, 2**256-1);

        // setting whitelist
        whitelist[beneficiary] = true;
        whitelist[admin] = true;
        whitelist[treasurer] = true;
        whitelist[address(this)] = true;
    }

    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal whenNotPaused override {
        // if both the sender and recipient are not whitelisted, try to apply fees
        if (!whitelist[from] && !whitelist[to]) {
            uint fee = 0;

            if (isDex[from] && buyFeePercentage > 0) {
                fee = _getPercentageOf(amount, buyFeePercentage);
            } else if (isDex[to] && sellFeePercentage > 0) {
                fee = _getPercentageOf(amount, sellFeePercentage);
            }

            if (fee > 0) {
                super._transfer(from, address(this), fee);
                if (swapFeesToEth) {
                    _swapTokenForETH(fee);
                }
            }

            super._transfer(from, to, amount - fee);
        } else {
            super._transfer(from, to, amount);
        }
    }

    function _swapTokenForETH(uint amount) internal returns (uint[] memory) {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = v2Router.WETH();

        return v2Router.swapExactTokensForETH(
            amount,
            0,
            path,
            address(this),
            block.timestamp
        );
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setBuyFeePercentage(uint fee) external onlyRole(FEE_ADMIN_ROLE) {
        require(fee <= 1000, "DYSToken: Buy fee cannot be more than 10%");
        buyFeePercentage = fee;
    }

    function setSellFeePercentage(uint fee) external onlyRole(FEE_ADMIN_ROLE) {
        require(fee <= 1000, "DYSToken: Sell fee cannot be more than 10%");
        sellFeePercentage = fee;
    }

    function setSwapFeesToEth(bool swapFeesToEth_) external onlyRole(FEE_ADMIN_ROLE) {
        swapFeesToEth = swapFeesToEth_;
    }

    function setWhitelistedAddress(address account, bool isWhitelisted) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "DYSToken: Cannot set zero address as whitelisted");
        whitelist[account] = isWhitelisted;
    }

    function setIsDex(address account, bool isDex_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(account != address(0), "DYSToken: Cannot set zero address as dex");
        isDex[account] = isDex_;
    }

    function setTrustedForwarder(address trustedForwarder) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(trustedForwarder);
    }

    function setApprovalFor(address spender, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _approve(address(this), spender, amount);
    }

    function withdrawTokens(address tokenAddress, address beneficiary) external onlyRole(TREASURER_ROLE) {
        require(beneficiary != address(0), "DYSToken: Cannot withdraw tokens to zero address");
        SafeERC20.safeTransfer(IERC20(tokenAddress), beneficiary, IERC20(tokenAddress).balanceOf(address(this)));
    }

    function withdrawETH(address beneficiary) external onlyRole(TREASURER_ROLE) {
        require(beneficiary != address(0), "DYSToken: Cannot withdraw ETH to zero address");
        payable(beneficiary).transfer(address(this).balance);
    }

    function _getPercentageOf(uint amount, uint percentage) internal pure returns (uint) {
        return amount * percentage / 10000;
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
