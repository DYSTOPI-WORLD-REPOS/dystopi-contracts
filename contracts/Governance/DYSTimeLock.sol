// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/governance/TimelockController.sol";

contract DYSTimeLock is TimelockController {
    constructor(address[] memory proposers, address[] memory executors) TimelockController(2 days, proposers, executors, address(0)) {}
}
