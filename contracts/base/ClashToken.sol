// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract ClashToken is ERC20, ERC20Burnable, ERC20Permit {
    string private constant NAME = "Chibi Clash Token";
    string private constant SYMBOL = "CLASH";
    uint256 private constant TOTAL_SUPPLY = 5_000_000_000 ether;

    constructor(address treasury) ERC20(NAME, SYMBOL) ERC20Permit(NAME) {
        _mint(treasury, TOTAL_SUPPLY);
    }
}
