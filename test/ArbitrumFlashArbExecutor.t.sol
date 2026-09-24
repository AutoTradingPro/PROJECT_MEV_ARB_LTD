// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ArbitrumFlashArbExecutor} from "../contracts/ArbitrumFlashArbExecutor.sol";
import {BalancerFlashArb} from "../contracts/BalancerFlashArb.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev USDT-style: transfer/transferFrom tidak mengembalikan bool.
contract MockUSDT {
    string public symbol = "USDT";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external {
        allowance[msg.sender][spender] = amount;
    }

    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "USDT: balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
    }

    function transferFrom(address from, address to, uint256 amount) external {
        require(balanceOf[from] >= amount, "USDT: balance");
        require(allowance[from][msg.sender] >= amount, "USDT: allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
    }
}

contract ArbitrumFlashArbExecutorTest is Test {
    address constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;

    ArbitrumFlashArbExecutor internal exec;
    MockUSDC internal usdc;
    MockUSDT internal usdt;

    address internal owner;
    address internal stranger;

    uint256 internal constant ETH_IN = 0.25 ether;
    uint256 internal constant USDC_IN = 1_000e6;
    uint256 internal constant USDT_IN = 2_500e6;

    receive() external payable {}

    function setUp() public {
        owner = address(this);
        stranger = makeAddr("stranger");
        exec = new ArbitrumFlashArbExecutor(BALANCER_VAULT, WETH);
        usdc = new MockUSDC();
        usdt = new MockUSDT();
        usdc.mint(owner, USDC_IN);
        usdt.mint(owner, USDT_IN);
        vm.deal(owner, 10 ether);
        vm.deal(stranger, 1 ether);
    }

    function _logBalances(string memory tag) internal view {
        console2.log("----------", tag, "----------");
        console2.log("owner          ", owner);
        console2.log("stranger       ", stranger);
        console2.log("executor       ", address(exec));
        console2.log("vault ETH wei  ", address(exec).balance);
        console2.log("vault USDC     ", usdc.balanceOf(address(exec)));
        console2.log("vault USDT     ", usdt.balanceOf(address(exec)));
        console2.log("owner ETH wei  ", owner.balance);
        console2.log("owner USDC     ", usdc.balanceOf(owner));
        console2.log("owner USDT     ", usdt.balanceOf(owner));
    }

    function test_DepositThenOwnerSweepEthUsdcUsdt() public {
        _logBalances("SEBELUM DEPOSIT");

        exec.deposit{value: ETH_IN}();
        usdc.approve(address(exec), USDC_IN);
        exec.depositToken(address(usdc), USDC_IN);
        usdt.approve(address(exec), USDT_IN);
        exec.depositToken(address(usdt), USDT_IN);

        _logBalances("SETELAH DEPOSIT");

        assertEq(address(exec).balance, ETH_IN, "ETH tidak masuk vault");
        assertEq(usdc.balanceOf(address(exec)), USDC_IN, "USDC tidak masuk vault");
        assertEq(usdt.balanceOf(address(exec)), USDT_IN, "USDT tidak masuk vault");

        uint256 ownerEthBefore = owner.balance;
        uint256 ownerUsdcBefore = usdc.balanceOf(owner);
        uint256 ownerUsdtBefore = usdt.balanceOf(owner);

        vm.pauseGasMetering();
        exec.withdraw(ETH_IN / 5);
        exec.withdrawToken(address(usdc), USDC_IN / 4);
        exec.emergencyWithdraw(address(0), owner);
        exec.emergencyWithdraw(address(usdc), owner);
        exec.rescueFunds(address(usdt));
        vm.resumeGasMetering();

        _logBalances("SETELAH WITHDRAW / SWEEP OWNER");

        assertEq(address(exec).balance, 0, "ETH tertahan di vault");
        assertEq(usdc.balanceOf(address(exec)), 0, "USDC tertahan di vault");
        assertEq(usdt.balanceOf(address(exec)), 0, "USDT tertahan di vault");
        assertEq(owner.balance, ownerEthBefore + ETH_IN, "ETH owner tidak lengkap");
        assertEq(usdc.balanceOf(owner), ownerUsdcBefore + USDC_IN, "USDC owner tidak lengkap");
        assertEq(usdt.balanceOf(owner), ownerUsdtBefore + USDT_IN, "USDT owner tidak lengkap");
    }

    function test_ReceiveEthCountsAsDeposit() public {
        (bool ok, ) = address(exec).call{value: 0.05 ether}("");
        require(ok, "receive ETH gagal");
        assertEq(address(exec).balance, 0.05 ether);
        exec.rescueETH();
        assertEq(address(exec).balance, 0);
    }

    function test_NonOwnerCannotWithdrawOrRescue() public {
        exec.deposit{value: 0.1 ether}();
        usdc.mint(stranger, 100e6);
        vm.startPrank(stranger);
        usdc.approve(address(exec), 100e6);
        exec.depositToken(address(usdc), 100e6);

        vm.expectRevert(bytes("NotOwner"));
        exec.withdraw(0.01 ether);

        vm.expectRevert(bytes("NotOwner"));
        exec.withdrawToken(address(usdc), 1);

        vm.expectRevert(bytes("NotOwner"));
        exec.rescueETH();

        vm.expectRevert(bytes("NotOwner"));
        exec.rescueFunds(address(usdc));

        vm.expectRevert(bytes("NotOwner"));
        exec.rescueFunds(address(usdc), 1);

        vm.expectRevert(bytes("NotOwner"));
        exec.emergencyWithdraw(address(0), stranger);
        vm.stopPrank();

        _logBalances("SETELAH NON-OWNER DITOLAK (dana masih di vault)");
        assertEq(address(exec).balance, 0.1 ether);
        assertEq(usdc.balanceOf(address(exec)), 100e6);

        exec.emergencyWithdraw(address(0), owner);
        exec.emergencyWithdraw(address(usdc), owner);
        assertEq(address(exec).balance, 0);
        assertEq(usdc.balanceOf(address(exec)), 0);
        console2.log("access control OK: hanya owner yang bisa withdraw/rescue");
    }
}

contract BalancerFlashArbTreasuryTest is Test {
    address constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

    BalancerFlashArb internal exec;
    MockUSDC internal usdc;

    receive() external payable {}

    function setUp() public {
        exec = new BalancerFlashArb(BALANCER_VAULT, WETH);
        usdc = new MockUSDC();
        usdc.mint(address(this), 1_000e6);
        vm.deal(address(this), 10 ether);
    }

    function test_BalancerFlashArbMatchesTreasuryAbi() public {
        exec.deposit{value: 0.2 ether}();
        usdc.approve(address(exec), 1_000e6);
        exec.depositToken(address(usdc), 1_000e6);

        exec.withdraw(0.05 ether);
        exec.withdrawToken(address(usdc), 100e6);
        exec.emergencyWithdraw(address(usdc), address(this));
        exec.rescueETH();

        assertEq(address(exec).balance, 0);
        assertEq(usdc.balanceOf(address(exec)), 0);
    }

    function test_BalancerFlashArbNonOwnerBlocked() public {
        address stranger = makeAddr("stranger");
        exec.deposit{value: 0.1 ether}();
        vm.startPrank(stranger);
        vm.expectRevert(bytes("NotOwner"));
        exec.withdraw(0.01 ether);
        vm.expectRevert(bytes("NotOwner"));
        exec.emergencyWithdraw(address(0), stranger);
        vm.expectRevert(bytes("NotOwner"));
        exec.rescueETH();
        vm.stopPrank();
        exec.rescueETH();
        assertEq(address(exec).balance, 0);
    }
}
