// SPDX-License-Identifier: Apache-2.0
// The below is a modified version of the original open-source code found under
// https://github.com/abdelhamidbakhta/token-vesting-contracts/blob/main/contracts/MockTokenVesting.sol
// released under the Apache-2.0 license
// Original license: https://github.com/abdelhamidbakhta/token-vesting-contracts/blob/main/LICENSE
pragma solidity ^0.8.4;

import "./DYSVesting.sol";

/**
 * WARNING: use only for testing and debugging purpose
 */
contract MockDYSVesting is DYSVesting {

    uint256 mockTime = 0;

    constructor(address token_) DYSVesting(token_) {}

    function setCurrentTime(uint256 _time)
    external {
        mockTime = _time;
    }

    function getCurrentTime()
    internal
    virtual
    override
    view
    returns(uint256) {
        return mockTime;
    }
}
