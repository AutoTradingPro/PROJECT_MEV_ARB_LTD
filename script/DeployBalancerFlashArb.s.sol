// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BalancerFlashArb} from "../contracts/BalancerFlashArb.sol";

/// @notice Deploy BalancerFlashArb to Ethereum / Polygon PoS (137) / Arbitrum.
/// @dev forge install foundry-rs/forge-std --no-git
///
///   forge script script/DeployBalancerFlashArb.s.sol:DeployBalancerFlashArb \
///     --rpc-url $BLOCKPI_RPC_POLYGON --broadcast --private-key $PRIVATE_KEY_POLYGON
///
/// Optional env:
///   BALANCER_VAULT   default 0xBA12222222228d8Ba445958a75a0704d566BF2C8
///                    (Balancer V2 Vault — same address on Ethereum, Polygon 137, Arbitrum)
///   WRAPPED_NATIVE   WETH / WMATIC for the target chain
/// Polygon deploy RPC: BLOCKPI_RPC_POLYGON (server .env.local). Do not use Blockmachine scanner URLs.
/// (never NEXT_PUBLIC_).
contract DeployBalancerFlashArb is Script {
    address constant BALANCER_V2_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;

    function run() external {
        address vault = vm.envOr("BALANCER_VAULT", BALANCER_V2_VAULT);
        address wrapped = vm.envAddress("WRAPPED_NATIVE");

        vm.startBroadcast();
        BalancerFlashArb arb = new BalancerFlashArb(vault, wrapped);
        vm.stopBroadcast();

        console.log("BalancerFlashArb", address(arb));
        console.log("owner", arb.owner());
        console.log("vault", vault);
        console.log("wrappedNative", wrapped);
        console.log("chainId", block.chainid);
    }
}
