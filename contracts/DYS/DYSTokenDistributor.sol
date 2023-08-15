// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../Utils/SignatureVerification.sol";

contract DYSTokenDistributor is AccessControlUpgradeable, PausableUpgradeable, ERC2771Recipient, SignatureVerification {
    // can pause the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    // can deposit and withdraw tokens
    bytes32 public constant TREASURER_ROLE = keccak256("TREASURER_ROLE");
    // can configure the claim limits and parameters
    bytes32 public constant CLAIM_ADMIN_ROLE = keccak256("CLAIM_ADMIN_ROLE");

    // maximum number of tokens that can be claimed by an account per transaction
    uint public maxClaimPerTransaction;
    // minimum time between claims per account
    uint public minClaimFrequencyPerAccount;
    // last time the user has claimed
    mapping(address => uint) public lastClaimedTime;
    // all rewards ever claimed by address
    mapping(address => uint) internal _claimedRewards;

    // maximum number of tokens that can be claimed from the contract per day
    uint public globalDailyClaimLimit;
    // the start date for calculating claim limit periods
    // claim limits reset at globalDailyClaimLimitPeriodStart + globalDailyClaimLimitPeriod * n
    // can only be set once in the constructor
    uint public globalDailyClaimLimitPeriodsStart;
    // the length of a claim limit period
    uint public constant globalDailyClaimLimitPeriod = 1 days;
    // the amount of tokens claimed in a claim limit period
    mapping (uint => uint) public globalDailyClaimLimitPeriodClaimed;

    // address of the DYS token
    IERC20 public token;

    mapping(address => uint) public claimedRewards;

    event Claimed(
        address indexed account,
        uint claimedAmount,
        uint totalClaimedAmount
    );

    function initialize(
        address admin,
        address pauser,
        address treasurer,
        address claimAdmin,
        address trustedForwarder,
        address tokenAddress,
        uint _globalDailyClaimLimitPeriodsStart
    ) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(TREASURER_ROLE, treasurer);
        _grantRole(CLAIM_ADMIN_ROLE, claimAdmin);

        __AccessControl_init();
        __Pausable_init();

        _setTrustedForwarder(trustedForwarder);
        token = IERC20(tokenAddress);
        globalDailyClaimLimitPeriodStart = _globalDailyClaimLimitPeriodsStart;
    }

    function claim(uint totalRewards, bytes32 hash, bytes calldata signature) external whenNotPaused {
        require(
            _verify(hash, signature),
            "DYSTokenDistributor: Message was not signed by signer"
        );
        require(
            hash == _createMessageHash(_createHash(_msgSender(), totalRewards)),
            "DYSTokenDistributor: Hash mismatch"
        );
        require(
            block.timestamp - lastClaimedTime[_msgSender()] >= minClaimFrequencyPerAccount,
            "DYSTokenDistributor: Last claim was too recent"
        );

        uint amount = totalRewards - _claimedRewards[_msgSender()];

        require(
            amount <= maxClaimPerTransaction,
            "DYSTokenDistributor: Claim amount exceeds max claim per transaction"
        );

        uint lastClaimLimitResetDate = _getLastClaimLimitResetDate();

        require(
            globalDailyClaimLimitPeriodClaimed[lastClaimLimitResetDate] + amount <= globalDailyClaimLimit,
            "DYSTokenDistributor: Claim amount exceeds global daily claim limit"
        );

        lastClaimedTime[_msgSender()] = block.timestamp;
        claimedRewards[_msgSender()] += amount;
        globalDailyClaimLimitPeriodClaimed[lastClaimLimitResetDate] += amount;

        token.transfer(_msgSender(), amount);

        emit Claimed(_msgSender(), amount, claimedRewards[_msgSender()]);
    }

    function deposit(uint amount) public onlyRole(TREASURER_ROLE) {
        token.transferFrom(_msgSender(), address(this), amount);
    }

    function withdraw(uint amount) public onlyRole(TREASURER_ROLE) {
        token.transfer(_msgSender(), amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function setMaxClaimPerTransaction(uint amount) public onlyRole(CLAIM_ADMIN_ROLE) {
        maxClaimPerTransaction = amount;
    }

    function setMinClaimFrequencyPerAccount(uint amount) public onlyRole(CLAIM_ADMIN_ROLE) {
        minClaimFrequencyPerAccount = amount;
    }

    function setGlobalDailyClaimLimit(uint amount) public onlyRole(CLAIM_ADMIN_ROLE) {
        globalDailyClaimLimit = amount;
    }

    function setTrustedForwarder(address trustedForwarder) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(trustedForwarder);
    }

    function setSigner(address signer) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _signer = signer;
    }

    function _getLastClaimLimitResetDate() internal view returns(uint) {
        uint periodsElapsed = (block.timestamp - globalDailyClaimLimitPeriodStart) / globalDailyClaimLimitPeriod;
        return periodsElapsed * globalDailyClaimLimitPeriod + globalDailyClaimLimitPeriodStart;
    }

    function _createHash(
        address sender,
        uint totalRewards
    ) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(sender, totalRewards));
    }

    function _msgSender() internal view override(ContextUpgradeable, ERC2771Recipient) returns (address sender) {
        return ERC2771Recipient._msgSender();
    }

    function _msgData() internal view override(ContextUpgradeable, ERC2771Recipient) returns (bytes calldata) {
        return ERC2771Recipient._msgData();
    }
}
