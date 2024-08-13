// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./interfaces/IVesting.sol";

contract Vesting is IVesting, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public token;
    uint256 public start;
    uint256 public claimablePercentIndex;
    uint256 public accumulatedClaimablePercent;
    string public vestingName;

    mapping(address => uint256) public tokenAmounts;
    mapping(address => uint256) public releasedAmount;

    UnlockEvent[] private _unlockEvents;
    uint256 private _totalUnlockedPercentX100;
    address[] private _beneficiaries;
    uint256 private _assigned;
    uint256 private _released;

    /**
     * @param _token The token address.
     * @param _start The TGE timestamp.
     * @param _vestingName The Vesting Schedule name. For instance: Private Round
     */
    constructor(
        IERC20 _token,
        uint256 _start,
        string memory _vestingName
    ) Ownable(msg.sender) {
        token = _token;
        start = _start;
        vestingName = _vestingName;
    }

    /**
     * @dev Adds the Vesting Schedule Configuration
     * @param percentX100 The Unlock Percent.
     * @param unlockTime The Unlock Time.
     */
    function addUnlockEvents(
        uint256[] memory percentX100,
        uint256[] memory unlockTime
    ) external override onlyOwner {
        require(
            percentX100.length == unlockTime.length && percentX100.length > 0,
            "Invalid params"
        );
        if (_unlockEvents.length == 0) {
            require(start == unlockTime[0], "Unlock time must start from TGE");
        } else {
            require(
                _unlockEvents[_unlockEvents.length - 1].unlockTime <
                    unlockTime[0],
                "Unlock time has to be in order"
            );
        }
        uint256 totalUnlockedPercentX100 = _totalUnlockedPercentX100;
        for (uint256 i = 0; i < percentX100.length; i++) {
            if (i > 0) {
                require(
                    unlockTime[i] > unlockTime[i - 1],
                    "Unlock time has to be in order"
                );
            }

            totalUnlockedPercentX100 += percentX100[i];
            require(
                totalUnlockedPercentX100 <= 100 * 100,
                "Invalid percent values"
            );

            _addUnlockEvent(percentX100[i], unlockTime[i]);
        }
        _totalUnlockedPercentX100 = totalUnlockedPercentX100;
    }

    function _addUnlockEvent(uint256 percentX100, uint256 unlockTime) private {
        _unlockEvents.push(
            UnlockEvent({percentX100: percentX100, unlockTime: unlockTime})
        );
    }

    /**
     * @dev Fetches the Vesting Schedule Configuration
     * @return The Vesting Schedule Configuration
     */
    function getUnlockEvents()
        external
        view
        override
        returns (UnlockEvent[] memory)
    {
        return _unlockEvents;
    }

    /**
     * @dev Adds Beneficiaries addresses and amounts
     */
    function addBeneficiaries(
        address[] memory beneficiaries,
        uint256[] memory amounts
    ) external override onlyOwner {
        require(beneficiaries.length == amounts.length, "Invalid params");

        uint256 newAssigned = 0;
        for (uint256 i = 0; i < beneficiaries.length; i++) {
            _addBeneficiary(beneficiaries[i], amounts[i]);
            newAssigned += amounts[i];
        }

        uint256 balance = token.balanceOf(address(this));
        require(
            balance >= _assigned - _released + newAssigned,
            "Not enough token to cover"
        );
        _assigned += newAssigned;
    }

    function _addBeneficiary(address beneficiary, uint256 tokenAmount) private {
        require(
            beneficiary != address(0),
            "The beneficiary's address cannot be 0"
        );
        require(tokenAmount > 0, "Amount has to be greater than 0");

        if (tokenAmounts[beneficiary] == 0) {
            _beneficiaries.push(beneficiary);
        }

        tokenAmounts[beneficiary] = tokenAmounts[beneficiary] + tokenAmount;
    }

    /**
     * @dev Gets All Beneficiaries Addresses
     * @return All Beneficiaries Addresses
     */
    function getBeneficiaries()
        external
        view
        override
        returns (address[] memory)
    {
        return _beneficiaries;
    }

    /**
     * @dev Claims All available User Tokens
     */
    function claimTokens() external override nonReentrant {
        require(tokenAmounts[msg.sender] > 0, "No tokens to claim");
        require(
            releasedAmount[msg.sender] < tokenAmounts[msg.sender],
            "User already released all available tokens"
        );

        (
            uint256 percent,
            uint256 _accumulatedClaimablePercent,
            uint256 _claimablePercentIndex
        ) = _claimablePercent();
        accumulatedClaimablePercent = _accumulatedClaimablePercent;
        claimablePercentIndex = _claimablePercentIndex;
        uint256 unreleased = _claimableAmount(msg.sender, percent);

        if (unreleased > 0) {
            _released += unreleased;
            releasedAmount[msg.sender] += unreleased;
            token.safeTransfer(msg.sender, unreleased);
            emit Released(msg.sender, unreleased);
        }
    }

    /**
     * @dev Calculates the total Claimable Percent according to how many days have passed
     * @notice This function doesn't modify the contract state and it's just called for display purposes
     * @return The total Claimable Percent, accumulated Claimable Percent, claimable Percent Index
     */
    function _claimablePercent()
        private
        view
        returns (uint256, uint256, uint256)
    {
        uint256 _accumulatedClaimablePercent = accumulatedClaimablePercent;
        uint256 _claimablePercentIndex = claimablePercentIndex;

        // cannot claim before TGE
        if (block.timestamp < start)
            return (0, _accumulatedClaimablePercent, _claimablePercentIndex);

        uint256 claimablePercentForCurentPeriod;

        for (
            uint256 i = _claimablePercentIndex;
            i < _unlockEvents.length;
            i++
        ) {
            //unlockEvents[i].percentX100 = 400 for 4%
            uint256 lockedPeriodPercent = _unlockEvents[i].percentX100;

            if (block.timestamp > _unlockEvents[i].unlockTime) {
                _accumulatedClaimablePercent += lockedPeriodPercent;
            } else {
                // "i" will always be greater than 0 since unlockEvents[0].unlockTime = start
                uint256 totalDaysForCurrentPeriod = (_unlockEvents[i]
                    .unlockTime - _unlockEvents[i - 1].unlockTime) / 1 days;
                uint256 daysPassedForCurrentPeriod = (block.timestamp -
                    _unlockEvents[i - 1].unlockTime) / 1 days;

                claimablePercentForCurentPeriod +=
                    (lockedPeriodPercent * daysPassedForCurrentPeriod) /
                    totalDaysForCurrentPeriod;

                _claimablePercentIndex = i;
                break;
            }
        }

        uint256 resultPercent = _accumulatedClaimablePercent +
            claimablePercentForCurentPeriod;

        if (resultPercent > 100 * 100) resultPercent = 100 * 100;

        // if 4% then it'll return 400
        return (
            resultPercent,
            _accumulatedClaimablePercent,
            _claimablePercentIndex
        );
    }

    /**
     * @dev Calculates the total Claimable Percent according to how many days have passed
     * @notice This function doesn't modify the contract state and it's just called for display purposes
     * @return The total Claimable Percent
     */
    function claimablePercent() public view override returns (uint256) {
        (uint256 percent, , ) = _claimablePercent();
        return percent;
    }

    /**
     * @dev Calculates the total Claimable Tokens according to how many days have passed
     * @return The total Claimable Tokens
     */
    function claimableAmount(
        address beneficiary
    ) public view override returns (uint256) {
        return _claimableAmount(beneficiary, claimablePercent());
    }

    function _claimableAmount(
        address beneficiary,
        uint256 percent
    ) private view returns (uint256) {
        return
            (tokenAmounts[beneficiary] * percent) /
            (100 * 100) -
            releasedAmount[beneficiary];
    }

    /**
     * withdraw ERC20 tokens - owner only
     */
    function withdrawAllERC20(IERC20 erc20Token) external onlyOwner {
        uint256 balance = erc20Token.balanceOf(address(this));
        uint256 available = balance;
        // only allow withdraw unassigned $CLASH
        if (erc20Token == token) {
            // can withdraw only unassigned tokens after vesting period
            require(
                block.timestamp >
                    _unlockEvents[_unlockEvents.length - 1].unlockTime,
                "Vesting period not ended"
            );
            available = balance - _assigned;
        }
        require(available > 0, "No tokens to withdraw");

        erc20Token.transfer(owner(), available);
    }
}
