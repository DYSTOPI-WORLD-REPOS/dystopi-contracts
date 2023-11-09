// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUniswapV2Router {
    IERC20 public WETH;

    constructor(address mockWETHAddress) {
        WETH = IERC20(mockWETHAddress);
    }

    event SwapExactTokensForETH(
        uint amountIn,
        uint amountOut,
        address[] path,
        address to,
        uint deadline
    );

    function swapExactTokensForETH(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        emit SwapExactTokensForETH(
            amountIn,
            amountOutMin,
            path,
            to,
            deadline
        );

        uint[] memory _amounts = new uint[](2);
        _amounts[0] = amountIn;
        _amounts[1] = amountOutMin;

        return _amounts;
    }
}
