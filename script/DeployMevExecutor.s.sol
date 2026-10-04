// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MevExecutor} from "../contracts/MevExecutor.sol";

/// @notice Deploy MevExecutor. Signer dibayar lewat DEPLOYER_PK (tidak dicetak).
/// @dev Env: FLASH_SOURCE, WRAPPED_NATIVE, FLASH_KIND (1 Balancer / 2 Pancake V3),
///      FLASH_FEE (0 atau 100), EXPECTED_CHAIN_ID, DEPLOYER_PK.
contract DeployMevExecutor is Script {
    function run() external {
        address source = vm.envAddress("FLASH_SOURCE");
        address wrapped = vm.envAddress("WRAPPED_NATIVE");
        uint8 kind = uint8(vm.envUint("FLASH_KIND"));
        uint24 fee = uint24(vm.envUint("FLASH_FEE"));
        uint256 expectedChain = vm.envUint("EXPECTED_CHAIN_ID");
        uint256 pk = vm.envUint("DEPLOYER_PK");

        require(block.chainid == expectedChain, "WrongChain");

        vm.startBroadcast(pk);
        MevExecutor arb = new MevExecutor(source, wrapped, kind, fee);
        vm.stopBroadcast();

        require(arb.V3_LOAN_BPS() == 200, "V3LoanBps");
        require(arb.AMM_LOAN_BPS() == 300, "AmmLoanBps");
        require(arb.kind() == kind, "Kind");
        require(arb.flashFee() == fee, "Fee");
        require(arb.flashSource() == source, "Source");
        require(arb.owner() == vm.addr(pk), "Owner");

        console.log("MevExecutor", address(arb));
        console.log("owner", arb.owner());
        console.log("kind", uint256(kind));
        console.log("flashFee", uint256(fee));
        console.log("flashSource", source);
        console.log("wrappedNative", wrapped);
        console.log("chainId", block.chainid);
    }
}
