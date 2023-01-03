// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address beneficiary,
        uint totalSupply_
    ) ERC20(name, symbol) {
        _mint(beneficiary, totalSupply_ * 10 ** decimals());
    }
}
