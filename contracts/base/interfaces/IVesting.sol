// SPDX-License-Identifier: Unlicense

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
pragma solidity ^0.8.0;

interface IVesting {
    struct UnlockEvent {
        uint256 percentX100;
        uint256 unlockTime;
    }

    event Released(address beneficiary, uint256 amount);

    function addUnlockEvents(
        uint256[] memory _amount,
        uint256[] memory _unlockTime
    ) external;

    function getUnlockEvents() external view returns (UnlockEvent[] memory);

    function addBeneficiaries(
        address[] memory _beneficiaries,
        uint256[] memory _tokenAmounts
    ) external;

    function getBeneficiaries() external view returns (address[] memory);

    function claimTokens() external;

    function claimablePercent() external view returns (uint256);

    function claimableAmount(
        address _beneficiary
    ) external view returns (uint256);

    function withdrawAllERC20(IERC20 erc20Token) external;
}
