// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FlashArbTreasury} from "./FlashArbTreasury.sol";

interface IBalancerVault {
    function flashLoan(
        address recipient,
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external;
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/// @title BalancerFlashArb
/// @notice Executor flash loan Balancer V2 untuk Ethereum, Polygon, dan Arbitrum.
/// @dev Treasury ABI (deposit/withdraw/rescue) sama dengan ArbitrumFlashArbExecutor / VAULT_ABI.
contract BalancerFlashArb is FlashArbTreasury {
    using SafeERC20 for IERC20;

    address public immutable vault;
    address public immutable wrappedNative;

    struct ArbParams {
        address borrowToken;
        address profitToken;
        address routerBuy;
        address routerSell;
        address[] buyPath;
        address[] sellPath;
        uint256 amountOutMinBuy;
        uint256 amountOutMinSell;
        uint24 poolFeeBuy;
        uint24 poolFeeSell;
        uint256 minProfitWei;
        uint256 minerTipWei;
        address withdrawTo;
    }

    constructor(address _vault, address _wrappedNative) {
        require(_vault != address(0), "InvalidVault");
        require(_wrappedNative != address(0), "InvalidWrappedNative");
        vault = _vault;
        wrappedNative = _wrappedNative;
    }

    function executeFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata paramsData
    ) external onlyOwner {
        require(tokens.length > 0 && tokens.length == amounts.length, "InvalidCallback");
        require(paramsData.length > 0, "InvalidCallback");
        IERC20[] memory loanTokens = new IERC20[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "InvalidCallback");
            require(amounts[i] > 0, "ZeroAmountIn");
            loanTokens[i] = IERC20(tokens[i]);
        }
        IBalancerVault(vault).flashLoan(address(this), loanTokens, amounts, paramsData);
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(msg.sender == vault, "InvalidCallback");
        require(
            tokens.length == amounts.length && amounts.length == feeAmounts.length && tokens.length > 0,
            "InvalidCallback"
        );

        ArbParams memory parsed = abi.decode(userData, (ArbParams));
        require(parsed.borrowToken != address(0), "InvalidCallback");
        require(parsed.routerBuy != address(0) && parsed.routerSell != address(0), "UnknownRouter");

        uint256 borrowed;
        uint256 fee;
        for (uint256 i; i < tokens.length; ++i) {
            if (address(tokens[i]) == parsed.borrowToken) {
                borrowed = amounts[i];
                fee = feeAmounts[i];
                break;
            }
        }
        require(borrowed > 0, "InvalidCallback");

        _swap(parsed.routerBuy, parsed.borrowToken, borrowed, parsed.amountOutMinBuy, parsed.buyPath, parsed.poolFeeBuy);

        address midToken = parsed.buyPath[parsed.buyPath.length - 1];
        uint256 midBal = IERC20(midToken).balanceOf(address(this));
        _swap(parsed.routerSell, midToken, midBal, parsed.amountOutMinSell, parsed.sellPath, parsed.poolFeeSell);

        uint256 totalRepay = borrowed + fee;
        uint256 repayBal = IERC20(parsed.borrowToken).balanceOf(address(this));
        require(repayBal >= totalRepay, "RepayFailed");
        IERC20(parsed.borrowToken).safeTransfer(vault, totalRepay);

        uint256 finalBal = IERC20(parsed.borrowToken).balanceOf(address(this));
        require(finalBal >= parsed.minProfitWei, "Unprofitable");

        if (parsed.minerTipWei > 0 && block.coinbase != address(0)) {
            require(address(this).balance >= parsed.minerTipWei, "NativeTransferFailed");
            (bool tipOk, ) = payable(block.coinbase).call{value: parsed.minerTipWei}("");
            require(tipOk, "NativeTransferFailed");
        }

        if (finalBal > 0) {
            address dest = parsed.withdrawTo == address(0) ? owner : parsed.withdrawTo;
            IERC20(parsed.borrowToken).safeTransfer(dest, finalBal);
        }
    }

    function _swap(
        address router,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        uint24 poolFee
    ) internal {
        require(path.length >= 2, "BadPath");
        require(path[0] == tokenIn, "BadPath");
        _ensureApproval(tokenIn, router, amountIn);

        try IUniswapV2Router02(router).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp
        ) {
            return;
        } catch {
            _swapV3(router, tokenIn, amountIn, amountOutMin, path, poolFee);
        }
    }

    function _swapV3(
        address router,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        uint24 poolFee
    ) internal {
        require(path.length == 2, "BadPath");
        uint24 feeToUse = poolFee == 0 ? 500 : poolFee;

        try ISwapRouter02(router).exactInputSingle(
            ISwapRouter02.ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: path[1],
                fee: feeToUse,
                recipient: address(this),
                amountIn: amountIn,
                amountOutMinimum: amountOutMin,
                sqrtPriceLimitX96: 0
            })
        ) {
            return;
        } catch {
            revert("SlippageExceeded");
        }
    }

    function _ensureApproval(address token, address spender, uint256 amount) internal {
        uint256 allowed = IERC20(token).allowance(address(this), spender);
        if (allowed >= amount) return;
        IERC20(token).forceApprove(spender, type(uint256).max);
        require(IERC20(token).allowance(address(this), spender) >= amount, "ApproveFailed");
    }
}
