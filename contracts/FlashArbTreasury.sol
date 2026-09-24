// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Shared owner vault surface for Ethereum / Polygon / Arbitrum executors.
/// @dev Selectors must stay in sync with `lib/vault/abi.ts` (VAULT_ABI).
abstract contract FlashArbTreasury {
    using SafeERC20 for IERC20;

    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NotOwner");
        _;
    }

    /// @notice Setor native (ETH / MATIC) ke executor. Siapa pun boleh mendanai.
    function deposit() external payable {
        require(msg.value > 0, "ZeroAmountIn");
    }

    /// @notice Setor ERC-20 via `transferFrom` setelah approve.
    function depositToken(address token, uint256 amount) external {
        require(token != address(0), "InvalidCallback");
        require(amount > 0, "ZeroAmountIn");
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @notice Tarik sebagian native ke owner.
    function withdraw(uint256 amount) external onlyOwner {
        require(amount > 0, "ZeroAmountIn");
        require(address(this).balance >= amount, "NativeTransferFailed");
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "NativeTransferFailed");
    }

    /// @notice Tarik sebagian ERC-20 ke owner.
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "InvalidCallback");
        require(amount > 0, "ZeroAmountIn");
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /// @notice Penarikan darurat: sapu seluruh native (`token == 0`) atau seluruh saldo token ke `to`.
    function emergencyWithdraw(address token, address to) external onlyOwner {
        address dest = to == address(0) ? msg.sender : to;
        if (token == address(0)) {
            uint256 value = address(this).balance;
            require(value > 0, "ZeroAmountIn");
            (bool ok, ) = payable(dest).call{value: value}("");
            require(ok, "NativeTransferFailed");
            return;
        }
        uint256 amount = IERC20(token).balanceOf(address(this));
        require(amount > 0, "ZeroAmountIn");
        IERC20(token).safeTransfer(dest, amount);
    }

    function rescueFunds(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "InvalidCallback");
        require(amount > 0, "ZeroAmountIn");
        IERC20(token).safeTransfer(msg.sender, amount);
    }

    /// @notice Sapu seluruh saldo token, atau native jika `tokenAddress == address(0)`.
    function rescueFunds(address tokenAddress) external onlyOwner {
        if (tokenAddress == address(0)) {
            uint256 value = address(this).balance;
            require(value > 0, "ZeroAmountIn");
            (bool ok, ) = payable(msg.sender).call{value: value}("");
            require(ok, "NativeTransferFailed");
            return;
        }
        uint256 amount = IERC20(tokenAddress).balanceOf(address(this));
        require(amount > 0, "ZeroAmountIn");
        IERC20(tokenAddress).safeTransfer(msg.sender, amount);
    }

    function rescueETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "ZeroAmountIn");
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "NativeTransferFailed");
    }

    receive() external payable {}
}
