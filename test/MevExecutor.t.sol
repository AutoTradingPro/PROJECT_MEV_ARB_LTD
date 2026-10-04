// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MevExecutor} from "../contracts/MevExecutor.sol";

contract MintableERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockBalancerVault {
    function flashLoan(
        address recipient,
        IERC20[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external {
        uint256[] memory fees = new uint256[](tokens.length);
        for (uint256 i; i < tokens.length; ++i) {
            tokens[i].transfer(recipient, amounts[i]);
        }
        MevExecutor(payable(recipient)).receiveFlashLoan(tokens, amounts, fees, userData);
    }
}

contract MockPancakePool {
    address public token0;
    address public token1;

    constructor(address t0, address t1) {
        token0 = t0;
        token1 = t1;
    }

    function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external {
        if (amount0 > 0) IERC20(token0).transfer(recipient, amount0);
        if (amount1 > 0) IERC20(token1).transfer(recipient, amount1);
        uint256 fee0 = (amount0 * 100) / 1_000_000;
        uint256 fee1 = (amount1 * 100) / 1_000_000;
        MevExecutor(payable(recipient)).pancakeV3FlashCallback(fee0, fee1, data);
    }
}

contract MockPancakeFactory {
    address public pool;

    function setPool(address next) external {
        pool = next;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }
}

contract MockAavePool {
    function flashLoanSimple(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16
    ) external {
        IERC20(asset).transfer(receiver, amount);
        uint256 premium = (amount * 900) / 1_000_000;
        bool ok = MevExecutor(payable(receiver)).executeOperation(asset, amount, premium, msg.sender, params);
        require(ok, "AaveCallback");
        IERC20(asset).transferFrom(receiver, address(this), amount + premium);
    }
}

contract MockUniswapFactory {
    mapping(bytes32 => address) internal pools;

    function setPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        pools[_key(tokenA, tokenB, fee)] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address) {
        return pools[_key(tokenA, tokenB, fee)];
    }

    function _key(address tokenA, address tokenB, uint24 fee) internal pure returns (bytes32) {
        (address a, address b) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return keccak256(abi.encode(a, b, fee));
    }
}

contract MockUniswapPool {
    address public token0;
    address public token1;
    uint24 public fee;

    constructor(address t0, address t1, uint24 feeTier) {
        token0 = t0;
        token1 = t1;
        fee = feeTier;
    }

    function flash(address recipient, uint256 amount0, uint256 amount1, bytes calldata data) external {
        if (amount0 > 0) IERC20(token0).transfer(recipient, amount0);
        if (amount1 > 0) IERC20(token1).transfer(recipient, amount1);
        uint256 fee0 = (amount0 * fee + 1_000_000 - 1) / 1_000_000;
        uint256 fee1 = (amount1 * fee + 1_000_000 - 1) / 1_000_000;
        MevExecutor(payable(recipient)).uniswapV3FlashCallback(fee0, fee1, data);
    }
}

contract MockRouter {
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external {
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        uint256 outAmt = path[1] == path[0] ? amountIn : amountIn;
        if (keccak256(abi.encodePacked(ERC20(path[1]).symbol())) == keccak256("WETH")) {
            outAmt = amountIn + 0.02 ether;
        }
        IERC20(path[1]).transfer(to, outAmt);
    }
}

contract MevExecutorTest is Test {
    MintableERC20 internal weth;
    MintableERC20 internal usdc;
    MockBalancerVault internal vault;
    MockPancakeFactory internal factory;
    MockPancakePool internal pool;
    MockRouter internal router;
    MevExecutor internal balancerExec;
    MevExecutor internal pancakeExec;
    MevExecutor internal aaveExec;
    MevExecutor internal uniExec;
    MockAavePool internal aavePool;
    MockUniswapFactory internal uniFactory;
    MockUniswapPool internal uniPool;

    function setUp() public {
        weth = new MintableERC20("Wrapped Ether", "WETH");
        usdc = new MintableERC20("USD Coin", "USDC");
        vault = new MockBalancerVault();
        factory = new MockPancakeFactory();
        pool = new MockPancakePool(address(weth), address(usdc));
        factory.setPool(address(pool));
        router = new MockRouter();

        balancerExec = new MevExecutor(address(vault), address(weth), 1, 0);
        pancakeExec = new MevExecutor(address(factory), address(weth), 2, 100);
        aavePool = new MockAavePool();
        uniFactory = new MockUniswapFactory();
        uniPool = new MockUniswapPool(address(weth), address(usdc), 100);
        uniFactory.setPool(address(weth), address(usdc), 100, address(uniPool));
        aaveExec = new MevExecutor(address(aavePool), address(weth), 3, 900);
        uniExec = new MevExecutor(address(uniFactory), address(weth), 4, 100);

        weth.mint(address(vault), 10 ether);
        weth.mint(address(pool), 10 ether);
        weth.mint(address(aavePool), 10 ether);
        weth.mint(address(uniPool), 10 ether);
        weth.mint(address(router), 10 ether);
        usdc.mint(address(router), 10 ether);
    }

    function testLoanBpsMatchDynamicSizing() public view {
        assertEq(balancerExec.V3_LOAN_BPS(), 200);
        assertEq(balancerExec.AMM_LOAN_BPS(), 300);
        assertEq(balancerExec.loanBps(true), 200);
        assertEq(balancerExec.loanBps(false), 300);
        assertEq(pancakeExec.flashFee(), 100);
        assertEq(balancerExec.flashFee(), 0);
    }

    function testRejectsBadConstructor() public {
        vm.expectRevert(bytes("InvalidKind"));
        new MevExecutor(address(vault), address(weth), 9, 0);
        vm.expectRevert(bytes("InvalidFee"));
        new MevExecutor(address(vault), address(weth), 1, 100);
        vm.expectRevert(bytes("InvalidFee"));
        new MevExecutor(address(factory), address(weth), 2, 500);
        vm.expectRevert(bytes("InvalidFee"));
        new MevExecutor(address(aavePool), address(weth), 3, 0);
        vm.expectRevert(bytes("InvalidFee"));
        new MevExecutor(address(uniFactory), address(weth), 4, 500);
        vm.expectRevert(bytes("InvalidVault"));
        new MevExecutor(address(0), address(weth), 1, 0);
    }

    function testStrangerCannotFlashOrCallback() public {
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vm.expectRevert(bytes("NotOwner"));
        balancerExec.executeFlashLoan(_tokens(), _amounts(), _params());

        vm.prank(stranger);
        vm.expectRevert(bytes("InvalidCallback"));
        balancerExec.receiveFlashLoan(new IERC20[](0), new uint256[](0), new uint256[](0), _params());

        vm.prank(stranger);
        vm.expectRevert(bytes("InvalidCallback"));
        pancakeExec.pancakeV3FlashCallback(0, 0, _params());

        vm.prank(stranger);
        vm.expectRevert(bytes("InvalidCallback"));
        aaveExec.executeOperation(address(weth), 1 ether, 0, address(aaveExec), _params());

        vm.prank(stranger);
        vm.expectRevert(bytes("InvalidCallback"));
        uniExec.uniswapV3FlashCallback(0, 0, _params());
    }

    function testBalancerFlashRepaysVaultAndPaysOwner() public {
        uint256 vaultBefore = weth.balanceOf(address(vault));
        balancerExec.executeFlashLoan(_tokens(), _amounts(), _params());
        assertGe(weth.balanceOf(address(vault)), vaultBefore);
        assertGt(weth.balanceOf(address(this)), 0);
        assertEq(balancerExec.activePool(), address(0));
    }

    function testPancakeFlashRepaysPoolAndPaysOwner() public {
        uint256 poolBefore = weth.balanceOf(address(pool));
        pancakeExec.executeFlashLoan(_tokens(), _amounts(), _params());
        assertGt(weth.balanceOf(address(pool)), poolBefore);
        assertGt(weth.balanceOf(address(this)), 0);
        assertEq(pancakeExec.activePool(), address(0));
        assertEq(pancakeExec.activeAmount(), 0);
    }

    function testAaveFlashRepaysPremiumAndPaysOwner() public {
        uint256 poolBefore = weth.balanceOf(address(aavePool));
        aaveExec.executeFlashLoan(_tokens(), _amounts(), _params());
        assertEq(weth.balanceOf(address(aavePool)), poolBefore + ((1 ether * 900) / 1_000_000));
        assertGt(weth.balanceOf(address(this)), 0);
        assertEq(aaveExec.activePool(), address(0));
        assertEq(aaveExec.activeAmount(), 0);
    }

    function testUniswapFlashRepaysTierFeeAndPaysOwner() public {
        uint256 poolBefore = weth.balanceOf(address(uniPool));
        uniExec.executeFlashLoan(_tokens(), _amounts(), _params());
        assertGt(weth.balanceOf(address(uniPool)), poolBefore);
        assertGt(weth.balanceOf(address(this)), 0);
        assertEq(uniExec.activePool(), address(0));
        assertEq(uniExec.activeAmount(), 0);
    }

    function _tokens() internal view returns (address[] memory tokens) {
        tokens = new address[](1);
        tokens[0] = address(weth);
    }

    function _amounts() internal pure returns (uint256[] memory amounts) {
        amounts = new uint256[](1);
        amounts[0] = 1 ether;
    }

    function _params() internal view returns (bytes memory) {
        address[] memory buyPath = new address[](2);
        buyPath[0] = address(weth);
        buyPath[1] = address(usdc);
        address[] memory sellPath = new address[](2);
        sellPath[0] = address(usdc);
        sellPath[1] = address(weth);
        return abi.encode(
            MevExecutor.ArbParams({
                borrowToken: address(weth),
                profitToken: address(weth),
                routerBuy: address(router),
                routerSell: address(router),
                buyPath: buyPath,
                sellPath: sellPath,
                amountOutMinBuy: 0,
                amountOutMinSell: 0,
                poolFeeBuy: 0,
                poolFeeSell: 0,
                minProfitWei: 1,
                minerTipWei: 0,
                withdrawTo: address(0)
            })
        );
    }
}
