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

interface IPancakeV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IPancakeV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external;
}

interface IAaveV3Pool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external;
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

/// @title MevExecutor
/// @notice Executor flash loan. Kind 1 Balancer V2 (0 ppm), kind 2 PancakeSwap V3 (100 ppm),
///         kind 3 Aave V3 (900 ppm), kind 4 Uniswap V3 flash (100 atau 3000 ppm).
/// @dev Ukuran pinjaman dihitung off-chain: 200 bps (2%) untuk pool V3, 300 bps (3%) untuk AMM.
///      Pemanggil mengirim `amounts` yang sudah disesuaikan. EVM paris: pool aktif disimpan di storage.
contract MevExecutor is FlashArbTreasury {
    using SafeERC20 for IERC20;

    uint8 public constant KIND_BALANCER = 1;
    uint8 public constant KIND_PANCAKE_V3 = 2;
    uint256 public constant KIND_AAVE_V3 = 3;
    uint256 public constant KIND_UNISWAP_V3_FLASH = 4;
    uint256 public constant AAVE_PREMIUM_PPM = 900;
    uint256 public constant UNI_FEE_LOW_PPM = 100;
    uint256 public constant UNI_FEE_HIGH_PPM = 3000;
    uint16 public constant V3_LOAN_BPS = 200;
    uint16 public constant AMM_LOAN_BPS = 300;

    address public immutable flashSource;
    address public immutable wrappedNative;
    uint8 public immutable kind;
    uint24 public immutable flashFee;

    /// @dev Pool Pancake yang sedang di dalam callback. Nol di luar flash.
    address public activePool;
    uint256 public activeAmount;

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

    constructor(address _flashSource, address _wrappedNative, uint8 _kind, uint24 _flashFee) {
        require(_flashSource != address(0), "InvalidVault");
        require(_wrappedNative != address(0), "InvalidWrappedNative");
        require(
            _kind == KIND_BALANCER ||
                _kind == KIND_PANCAKE_V3 ||
                uint256(_kind) == KIND_AAVE_V3 ||
                uint256(_kind) == KIND_UNISWAP_V3_FLASH,
            "InvalidKind"
        );
        if (_kind == KIND_BALANCER) require(_flashFee == 0, "InvalidFee");
        if (_kind == KIND_PANCAKE_V3) require(_flashFee == 100, "InvalidFee");
        if (uint256(_kind) == KIND_AAVE_V3) require(uint256(_flashFee) == AAVE_PREMIUM_PPM, "InvalidFee");
        if (uint256(_kind) == KIND_UNISWAP_V3_FLASH) {
            require(
                _flashFee == 0 || uint256(_flashFee) == UNI_FEE_LOW_PPM || uint256(_flashFee) == UNI_FEE_HIGH_PPM,
                "InvalidFee"
            );
        }
        flashSource = _flashSource;
        wrappedNative = _wrappedNative;
        kind = _kind;
        flashFee = _flashFee;
    }

    /// @notice 200 bps jika pool terkonsentrasi, 300 bps jika AMM biasa.
    function loanBps(bool concentrated) external pure returns (uint16) {
        return concentrated ? V3_LOAN_BPS : AMM_LOAN_BPS;
    }

    function executeFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata paramsData
    ) external onlyOwner {
        require(tokens.length > 0 && tokens.length == amounts.length, "InvalidCallback");
        require(paramsData.length > 0, "InvalidCallback");
        if (kind == KIND_BALANCER) {
            _flashBalancer(tokens, amounts, paramsData);
            return;
        }
        if (uint256(kind) == KIND_AAVE_V3) {
            require(tokens.length == 1, "InvalidCallback");
            _flashAave(tokens[0], amounts[0], paramsData);
            return;
        }
        if (uint256(kind) == KIND_UNISWAP_V3_FLASH) {
            require(tokens.length == 1, "InvalidCallback");
            _flashUniswap(tokens[0], amounts[0], paramsData);
            return;
        }
        require(tokens.length == 1, "InvalidCallback");
        require(tokens[0] != address(0) && amounts[0] > 0, "ZeroAmountIn");
        _flashPancake(tokens[0], amounts[0], paramsData);
    }

    function receiveFlashLoan(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external {
        require(kind == KIND_BALANCER, "InvalidKind");
        require(msg.sender == flashSource, "InvalidCallback");
        require(
            tokens.length == amounts.length && amounts.length == feeAmounts.length && tokens.length > 0,
            "InvalidCallback"
        );

        ArbParams memory parsed = abi.decode(userData, (ArbParams));
        (uint256 borrowed, uint256 fee) = _borrowed(tokens, amounts, feeAmounts, parsed.borrowToken);
        _swapRoute(parsed, borrowed);
        _settle(parsed, borrowed, fee, flashSource);
    }

    function pancakeV3FlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external {
        require(kind == KIND_PANCAKE_V3, "InvalidKind");
        require(msg.sender == activePool && activePool != address(0), "InvalidCallback");
        address pool = activePool;
        uint256 borrowed = activeAmount;
        activePool = address(0);
        activeAmount = 0;
        require(borrowed > 0, "InvalidCallback");

        ArbParams memory parsed = abi.decode(data, (ArbParams));
        require(parsed.borrowToken != address(0), "InvalidCallback");
        address token0 = IPancakeV3Pool(pool).token0();
        uint256 fee = parsed.borrowToken == token0 ? fee0 : fee1;
        _swapRoute(parsed, borrowed);
        _settle(parsed, borrowed, fee, pool);
    }

    /// @dev Hanya Pool Aave yang dikunci di constructor, dan hanya flash yang kita mulai.
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(uint256(kind) == KIND_AAVE_V3, "InvalidKind");
        require(msg.sender == flashSource, "InvalidCallback");
        require(initiator == address(this), "InvalidCallback");
        require(activePool == flashSource && activeAmount == amount && amount > 0, "InvalidCallback");
        require(asset != address(0), "InvalidCallback");
        require(premium <= _ppmCeil(amount, AAVE_PREMIUM_PPM), "InvalidFee");
        activePool = address(0);
        activeAmount = 0;

        ArbParams memory parsed = abi.decode(params, (ArbParams));
        require(parsed.borrowToken == asset, "InvalidCallback");
        _swapRoute(parsed, amount);
        _settleAave(parsed, amount, premium, flashSource);
        return true;
    }

    /// @dev Hanya pool Uniswap V3 dari factory resmi, tier 100 atau 3000, yang sedang kita flash.
    function uniswapV3FlashCallback(uint256 fee0, uint256 fee1, bytes calldata data) external {
        require(uint256(kind) == KIND_UNISWAP_V3_FLASH, "InvalidKind");
        require(msg.sender == activePool && activePool != address(0), "InvalidCallback");
        address pool = activePool;
        uint256 borrowed = activeAmount;
        activePool = address(0);
        activeAmount = 0;
        require(borrowed > 0, "InvalidCallback");

        uint24 tier = IUniswapV3Pool(pool).fee();
        require(uint256(tier) == UNI_FEE_LOW_PPM || uint256(tier) == UNI_FEE_HIGH_PPM, "InvalidFee");
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();
        require(IUniswapV3Factory(flashSource).getPool(token0, token1, tier) == pool, "InvalidCallback");

        ArbParams memory parsed = abi.decode(data, (ArbParams));
        require(parsed.borrowToken == token0 || parsed.borrowToken == token1, "InvalidCallback");
        uint256 fee = parsed.borrowToken == token0 ? fee0 : fee1;
        require(fee <= _ppmCeil(borrowed, tier), "InvalidFee");
        _swapRoute(parsed, borrowed);
        _settle(parsed, borrowed, fee, pool);
    }

    function _flashBalancer(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata paramsData
    ) internal {
        IERC20[] memory loanTokens = new IERC20[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "InvalidCallback");
            require(amounts[i] > 0, "ZeroAmountIn");
            loanTokens[i] = IERC20(tokens[i]);
        }
        IBalancerVault(flashSource).flashLoan(address(this), loanTokens, amounts, paramsData);
    }

    function _flashPancake(address asset, uint256 amount, bytes calldata paramsData) internal {
        ArbParams memory parsed = abi.decode(paramsData, (ArbParams));
        address pairToken = parsed.buyPath.length >= 2 ? parsed.buyPath[parsed.buyPath.length - 1] : wrappedNative;
        if (pairToken == asset) pairToken = wrappedNative;
        address pool = IPancakeV3Factory(flashSource).getPool(asset, pairToken, flashFee);
        if (pool == address(0) && pairToken != wrappedNative) {
            pool = IPancakeV3Factory(flashSource).getPool(asset, wrappedNative, flashFee);
        }
        require(pool != address(0), "NoPool");
        address token0 = IPancakeV3Pool(pool).token0();
        address token1 = IPancakeV3Pool(pool).token1();
        require(asset == token0 || asset == token1, "AssetNotInPool");
        uint256 amount0 = asset == token0 ? amount : 0;
        uint256 amount1 = asset == token0 ? 0 : amount;
        activePool = pool;
        activeAmount = amount;
        IPancakeV3Pool(pool).flash(address(this), amount0, amount1, paramsData);
        require(activePool == address(0) && activeAmount == 0, "CallbackMissing");
    }

    function _flashAave(address asset, uint256 amount, bytes calldata paramsData) internal {
        require(asset != address(0) && amount > 0, "ZeroAmountIn");
        activePool = flashSource;
        activeAmount = amount;
        IAaveV3Pool(flashSource).flashLoanSimple(address(this), asset, amount, paramsData, 0);
        require(activePool == address(0) && activeAmount == 0, "CallbackMissing");
    }

    function _flashUniswap(address asset, uint256 amount, bytes calldata paramsData) internal {
        require(asset != address(0) && amount > 0, "ZeroAmountIn");
        ArbParams memory parsed = abi.decode(paramsData, (ArbParams));
        address pairToken = parsed.buyPath.length >= 2 ? parsed.buyPath[parsed.buyPath.length - 1] : wrappedNative;
        if (pairToken == asset) pairToken = wrappedNative;
        (address pool, uint24 tier) = _uniswapPool(asset, pairToken);
        if (pool == address(0) && pairToken != wrappedNative) {
            (pool, tier) = _uniswapPool(asset, wrappedNative);
        }
        require(pool != address(0), "NoPool");
        address token0 = IUniswapV3Pool(pool).token0();
        address token1 = IUniswapV3Pool(pool).token1();
        require(asset == token0 || asset == token1, "AssetNotInPool");
        require(tier == IUniswapV3Pool(pool).fee(), "InvalidFee");
        uint256 amount0 = asset == token0 ? amount : 0;
        uint256 amount1 = asset == token0 ? 0 : amount;
        activePool = pool;
        activeAmount = amount;
        IUniswapV3Pool(pool).flash(address(this), amount0, amount1, paramsData);
        require(activePool == address(0) && activeAmount == 0, "CallbackMissing");
    }

    function _uniswapPool(address asset, address pairToken) internal view returns (address pool, uint24 tier) {
        uint24 first = uint256(flashFee) == UNI_FEE_HIGH_PPM ? uint24(UNI_FEE_HIGH_PPM) : uint24(UNI_FEE_LOW_PPM);
        uint24 second = first == uint24(UNI_FEE_LOW_PPM) ? uint24(UNI_FEE_HIGH_PPM) : uint24(UNI_FEE_LOW_PPM);
        pool = IUniswapV3Factory(flashSource).getPool(asset, pairToken, first);
        if (pool != address(0)) return (pool, first);
        pool = IUniswapV3Factory(flashSource).getPool(asset, pairToken, second);
        if (pool != address(0)) return (pool, second);
    }

    function _ppmCeil(uint256 amount, uint256 ppm) internal pure returns (uint256) {
        return (amount * ppm + 1_000_000 - 1) / 1_000_000;
    }

    function _borrowed(
        IERC20[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        address borrowToken
    ) internal pure returns (uint256 borrowed, uint256 fee) {
        require(borrowToken != address(0), "InvalidCallback");
        for (uint256 i; i < tokens.length; ++i) {
            if (address(tokens[i]) == borrowToken) {
                borrowed = amounts[i];
                fee = feeAmounts[i];
                break;
            }
        }
        require(borrowed > 0, "InvalidCallback");
    }

    function _swapRoute(ArbParams memory parsed, uint256 borrowed) internal {
        require(parsed.routerBuy != address(0) && parsed.routerSell != address(0), "UnknownRouter");
        _swap(parsed.routerBuy, parsed.borrowToken, borrowed, parsed.amountOutMinBuy, parsed.buyPath, parsed.poolFeeBuy);
        address midToken = parsed.buyPath[parsed.buyPath.length - 1];
        uint256 midBal = IERC20(midToken).balanceOf(address(this));
        _swap(parsed.routerSell, midToken, midBal, parsed.amountOutMinSell, parsed.sellPath, parsed.poolFeeSell);
    }

    function _settle(ArbParams memory parsed, uint256 borrowed, uint256 fee, address repayTo) internal {
        uint256 totalRepay = borrowed + fee;
        uint256 repayBal = IERC20(parsed.borrowToken).balanceOf(address(this));
        require(repayBal >= totalRepay, "RepayFailed");
        IERC20(parsed.borrowToken).safeTransfer(repayTo, totalRepay);

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

    /// @dev Aave menarik pelunasan sendiri lewat transferFrom sesudah callback selesai.
    function _settleAave(ArbParams memory parsed, uint256 borrowed, uint256 premium, address pool) internal {
        uint256 totalRepay = borrowed + premium;
        uint256 repayBal = IERC20(parsed.borrowToken).balanceOf(address(this));
        require(repayBal >= totalRepay, "RepayFailed");
        uint256 profit = repayBal - totalRepay;
        require(profit >= parsed.minProfitWei, "Unprofitable");

        if (parsed.minerTipWei > 0 && block.coinbase != address(0)) {
            require(address(this).balance >= parsed.minerTipWei, "NativeTransferFailed");
            (bool tipOk, ) = payable(block.coinbase).call{value: parsed.minerTipWei}("");
            require(tipOk, "NativeTransferFailed");
        }

        if (profit > 0) {
            address dest = parsed.withdrawTo == address(0) ? owner : parsed.withdrawTo;
            IERC20(parsed.borrowToken).safeTransfer(dest, profit);
        }
        _ensureApproval(parsed.borrowToken, pool, totalRepay);
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
