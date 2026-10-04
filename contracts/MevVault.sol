// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface IMevVaultV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);
}

interface IMevVaultV3Router {
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

/// @title MevVault
/// @notice Multi-user vault for one ERC-20 asset (deploy once per asset, e.g. USDC, and once for USDT).
/// @dev Shares live in `userBalances`. Profit from `executeArb` stays in the contract and raises the
/// share price, so every holder can withdraw principal plus their pro-rata gain.
/// The executor key can only run a round trip that increases the asset balance. It cannot set a
/// recipient, upgrade the proxy, or pause withdrawals. The admin (multisig / timelock, never the bot)
/// allowlists routers and is the only account that can upgrade.
contract MevVault is ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    enum Venue {
        V2,
        V3
    }

    struct Leg {
        address router;
        Venue venue;
        address tokenIn;
        address tokenOut;
        uint24 fee;
    }

    /// @dev Virtual offset makes an empty-vault donation attack unprofitable.
    uint256 private constant VIRTUAL_SHARES = 1_000_000;
    uint256 private constant VIRTUAL_ASSETS = 1;

    bool public initialized;
    bool public depositsPaused;
    address public admin;
    address public executor;
    IERC20 public asset;
    uint256 public totalShares;
    mapping(address => uint256) public userBalances;
    mapping(address => bool) public allowedRouters;

    uint256[40] private __gap;

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event Withdrawn(address indexed user, uint256 assets, uint256 shares);
    event ArbExecuted(address indexed executor, address indexed midToken, uint256 amountIn, uint256 profit);
    event ExecutorUpdated(address indexed executor);
    event RouterUpdated(address indexed router, bool allowed);
    event DepositsPaused(bool paused);
    event AdminUpdated(address indexed admin);

    error AlreadyInitialized();
    error ZeroAddress();
    error ZeroAssets();
    error ExecutorIsAdmin();
    error NotAdmin();
    error NotExecutor();
    error DepositsPausedError();
    error Expired();
    error RouterNotAllowed(address router);
    error BadRoute();
    error MinOutTooLow(uint256 amountIn, uint256 amountOutMin);
    error Unprofitable(uint256 beforeBalance, uint256 afterBalance, uint256 amountOutMin);
    error MidTokenLeft(address token, uint256 expected, uint256 actual);
    error InsufficientShares(uint256 have, uint256 need);

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != executor) revert NotExecutor();
        _;
    }

    /// @dev Locks the implementation. Proxy storage stays uninitialized until {initialize}.
    constructor() {
        initialized = true;
    }

    /// @dev `executor_` may be zero. Execution stays off until {setExecutor}. Admin must not be the bot key.
    function initialize(address asset_, address admin_, address executor_) external {
        if (initialized) revert AlreadyInitialized();
        if (asset_ == address(0) || admin_ == address(0)) revert ZeroAddress();
        if (admin_ == executor_) revert ExecutorIsAdmin();
        initialized = true;
        asset = IERC20(asset_);
        admin = admin_;
        executor = executor_;
        emit AdminUpdated(admin_);
        emit ExecutorUpdated(executor_);
    }

    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function assetsOf(address user) public view returns (uint256) {
        return _convertToAssets(userBalances[user], Math.Rounding.Floor);
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Floor);
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return _convertToShares(assets, Math.Rounding.Ceil);
    }

    /// @notice Pull `assets` of the vault token from the caller. Requires prior approval.
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (depositsPaused) revert DepositsPausedError();
        if (assets == 0) revert ZeroAssets();
        shares = previewDeposit(assets);
        if (shares == 0) revert ZeroAssets();
        userBalances[msg.sender] += shares;
        totalShares += shares;
        asset.safeTransferFrom(msg.sender, address(this), assets);
        emit Deposited(msg.sender, assets, shares);
    }

    /// @notice Send `assets` of the vault token back to the caller, including pro-rata profit.
    function withdraw(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();
        shares = previewWithdraw(assets);
        _burnShares(msg.sender, shares);
        asset.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }

    /// @notice Burn an exact share balance. Use this to exit in full (`userBalances[msg.sender]`).
    function redeem(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAssets();
        assets = _convertToAssets(shares, Math.Rounding.Floor);
        if (assets == 0) revert ZeroAssets();
        _burnShares(msg.sender, shares);
        asset.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }

    /// @notice Two-leg round trip of the vault asset. Profit stays in the vault. Loss reverts.
    /// @dev Both legs are built inside the contract: asset -> mid -> asset. The recipient is always
    /// this contract. `amountOutMin` must be greater than `amountIn`.
    function executeArb(
        Leg calldata buy,
        Leg calldata sell,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 deadline
    ) external onlyExecutor nonReentrant {
        if (block.timestamp > deadline) revert Expired();
        if (amountIn == 0 || amountOutMin <= amountIn) revert MinOutTooLow(amountIn, amountOutMin);
        if (!allowedRouters[buy.router]) revert RouterNotAllowed(buy.router);
        if (!allowedRouters[sell.router]) revert RouterNotAllowed(sell.router);

        address mid = buy.tokenOut;
        if (
            buy.tokenIn != address(asset) ||
            sell.tokenOut != address(asset) ||
            sell.tokenIn != mid ||
            mid == address(0) ||
            mid == address(asset) ||
            buy.router == address(this) ||
            sell.router == address(this)
        ) {
            revert BadRoute();
        }

        uint256 beforeBalance = totalAssets();
        if (amountIn > beforeBalance) revert Unprofitable(beforeBalance, beforeBalance, amountOutMin);
        uint256 midBefore = IERC20(mid).balanceOf(address(this));

        uint256 bought = _swap(buy, amountIn, deadline);
        _swap(sell, bought, deadline);

        uint256 midAfter = IERC20(mid).balanceOf(address(this));
        if (midAfter != midBefore) revert MidTokenLeft(mid, midBefore, midAfter);

        uint256 afterBalance = totalAssets();
        uint256 floor = beforeBalance - amountIn + amountOutMin;
        if (afterBalance < floor) revert Unprofitable(beforeBalance, afterBalance, amountOutMin);

        emit ArbExecuted(msg.sender, mid, amountIn, afterBalance - beforeBalance);
    }

    function setExecutor(address next) external onlyAdmin {
        if (next == admin) revert ExecutorIsAdmin();
        executor = next;
        emit ExecutorUpdated(next);
    }

    function setRouter(address router, bool allowed) external onlyAdmin {
        if (router == address(0) || router == address(this)) revert ZeroAddress();
        allowedRouters[router] = allowed;
        emit RouterUpdated(router, allowed);
    }

    /// @dev Stops new deposits and keeps withdrawals open.
    function setDepositsPaused(bool paused) external onlyAdmin {
        depositsPaused = paused;
        emit DepositsPaused(paused);
    }

    function setAdmin(address next) external onlyAdmin {
        if (next == address(0)) revert ZeroAddress();
        if (next == executor) revert ExecutorIsAdmin();
        admin = next;
        emit AdminUpdated(next);
    }

    function _authorizeUpgrade(address newImplementation) internal view override onlyAdmin {
        if (newImplementation == address(0)) revert ZeroAddress();
    }

    function _burnShares(address user, uint256 shares) private {
        uint256 have = userBalances[user];
        if (have < shares) revert InsufficientShares(have, shares);
        userBalances[user] = have - shares;
        totalShares -= shares;
    }

    function _convertToShares(uint256 assets, Math.Rounding rounding) private view returns (uint256) {
        return Math.mulDiv(assets, totalShares + VIRTUAL_SHARES, totalAssets() + VIRTUAL_ASSETS, rounding);
    }

    function _convertToAssets(uint256 shares, Math.Rounding rounding) private view returns (uint256) {
        return Math.mulDiv(shares, totalAssets() + VIRTUAL_ASSETS, totalShares + VIRTUAL_SHARES, rounding);
    }

    /// @dev Measures tokens that actually arrived. The router return value is ignored.
    function _swap(Leg calldata leg, uint256 amountIn, uint256 deadline) private returns (uint256 received) {
        IERC20 tokenIn = IERC20(leg.tokenIn);
        uint256 outBefore = IERC20(leg.tokenOut).balanceOf(address(this));
        tokenIn.forceApprove(leg.router, amountIn);
        if (leg.venue == Venue.V2) {
            address[] memory path = new address[](2);
            path[0] = leg.tokenIn;
            path[1] = leg.tokenOut;
            IMevVaultV2Router(leg.router).swapExactTokensForTokens(amountIn, 0, path, address(this), deadline);
        } else {
            IMevVaultV3Router(leg.router).exactInputSingle(
                IMevVaultV3Router.ExactInputSingleParams({
                    tokenIn: leg.tokenIn,
                    tokenOut: leg.tokenOut,
                    fee: leg.fee,
                    recipient: address(this),
                    amountIn: amountIn,
                    amountOutMinimum: 0,
                    sqrtPriceLimitX96: 0
                })
            );
        }
        tokenIn.forceApprove(leg.router, 0);
        uint256 outAfter = IERC20(leg.tokenOut).balanceOf(address(this));
        if (outAfter <= outBefore) revert BadRoute();
        received = outAfter - outBefore;
    }
}
