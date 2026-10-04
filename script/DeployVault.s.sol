// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {VmSafe} from "forge-std/Vm.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MevVault} from "../contracts/MevVault.sol";

/// @notice Deploy MevVault behind ERC1967Proxy and initialize it in the same transaction.
/// @dev The implementation constructor locks `initialized`. Only the proxy runs `initialize`.
/// Admin must be a multisig or timelock and must not equal the executor. The deployer key is
/// only the gas payer. It does not become admin unless `VAULT_ADMIN_ADDRESS` is that account.
///
/// Dry run (no transaction):
///   forge script script/DeployVault.s.sol:DeployVault --rpc-url $BLOCKPI_RPC_ARBITRUM
///
/// Arbitrum One reads `ARBITRUM_VAULT_ASSET`, `ARBITRUM_VAULT_ADMIN_ADDRESS`,
/// and `ARBITRUM_VAULT_EXECUTOR_ADDRESS`. Unprefixed `VAULT_*` is the fallback.
/// Verify with `ARBITRUM_ETHERSCAN_API_KEY` (Forge CLI, not a contract argument):
///   forge script script/DeployVault.s.sol:DeployVault --rpc-url $BLOCKPI_RPC_ARBITRUM --private-key $PRIVATE_KEY_ARBITRUM --broadcast --verify --verifier etherscan --etherscan-api-key $ARBITRUM_ETHERSCAN_API_KEY --chain 42161
///
/// BSC reads `BSC_VAULT_*` and uses a write RPC, not the Blockmachine scanner URL:
///   forge script script/DeployVault.s.sol:DeployVault --rpc-url $BSC_DEPLOY_RPC --private-key $PRIVATE_KEY_BSC --broadcast --verify --verifier etherscan --etherscan-api-key $BSC_ETHERSCAN_API_KEY --chain 56
contract DeployVault is Script {
    uint256 internal constant ARBITRUM = 42161;
    uint256 internal constant BSC = 56;

    /// @dev Obvious stand-ins. Broadcast is refused while any of these are still selected.
    address internal constant PLACEHOLDER_ASSET = 0x00000000000000000000000000000000000000A1;
    address internal constant PLACEHOLDER_ADMIN = 0x00000000000000000000000000000000000000A2;

    /// @dev Real tokens, printed as examples only. They are not applied unless set in the environment.
    address internal constant ARBITRUM_USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address internal constant BSC_USDT = 0x55d398326f99059fF775485246999027B3197955;

    /// @dev Routers whose ABI matches MevVault (V3 struct has no deadline; V2 is swapExactTokensForTokens).
    address internal constant ARBITRUM_UNI_V3 = 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45;
    address internal constant ARBITRUM_SUSHI_V2 = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address internal constant BSC_PANCAKE_V2 = 0x10ED43C718714eb63d5aA57B78B54704E256024E;

    struct Config {
        address asset;
        address admin;
        address executor;
        bool placeholder;
        bool executorUnset;
    }

    function run() external {
        Config memory cfg = _load();
        if (cfg.placeholder) {
            console.log("PLACEHOLDER AKTIF. Tidak ada transaksi yang boleh dikirim.");
            console.log(string.concat("  ", _chainPrefix(), "VAULT_ASSET saat ini"), cfg.asset);
            console.log(string.concat("  ", _chainPrefix(), "VAULT_ADMIN_ADDRESS saat ini"), cfg.admin);
            _printExamples();
            if (_broadcasting()) revert("placeholder config cannot be broadcast");
            console.log("Dry run berhenti. Isi env, lalu jalankan ulang sebelum --broadcast.");
            return;
        }
        if (cfg.admin == cfg.executor) revert("admin and executor must differ");
        if (cfg.asset.code.length == 0) {
            console.log("VAULT_ASSET tidak punya bytecode di chain ini:", cfg.asset);
            revert("asset has no code on this chain");
        }

        bytes memory initData = abi.encodeCall(MevVault.initialize, (cfg.asset, cfg.admin, cfg.executor));

        vm.startBroadcast();
        MevVault implementation = new MevVault();
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);
        vm.stopBroadcast();

        MevVault vault = MevVault(address(proxy));
        require(vault.initialized(), "proxy not initialized");
        require(address(vault.asset()) == cfg.asset, "asset mismatch");
        require(vault.admin() == cfg.admin, "admin mismatch");
        require(vault.executor() == cfg.executor, "executor mismatch");
        require(MevVault(address(implementation)).initialized(), "implementation not locked");
        require(MevVault(address(implementation)).admin() == address(0), "implementation storage was initialized");

        _printResult(vault, address(implementation), initData, cfg);
    }

    function _load() internal view returns (Config memory cfg) {
        (string memory assetRaw, bool assetSet) = _envString("VAULT_ASSET");
        if (!assetSet) {
            cfg.asset = PLACEHOLDER_ASSET;
            cfg.placeholder = true;
        } else {
            cfg.asset = vm.parseAddress(assetRaw);
        }
        (string memory adminRaw, bool adminSet) = _envString("VAULT_ADMIN_ADDRESS");
        if (!adminSet) {
            cfg.admin = PLACEHOLDER_ADMIN;
            cfg.placeholder = true;
        } else {
            cfg.admin = vm.parseAddress(adminRaw);
        }
        if (cfg.asset == address(0) || cfg.asset == PLACEHOLDER_ASSET) {
            cfg.asset = PLACEHOLDER_ASSET;
            cfg.placeholder = true;
        }
        if (cfg.admin == address(0) || cfg.admin == PLACEHOLDER_ADMIN) {
            cfg.admin = PLACEHOLDER_ADMIN;
            cfg.placeholder = true;
        }

        (string memory executorRaw, bool executorSet) = _envString("VAULT_EXECUTOR_ADDRESS");
        if (!executorSet) cfg.executorUnset = true;
        else cfg.executor = vm.parseAddress(executorRaw);
    }

    /// @dev Prefixed name wins (`ARBITRUM_VAULT_ASSET` on chain 42161). Plain `VAULT_ASSET` is the fallback.
    function _envString(string memory suffix) internal view returns (string memory raw, bool set) {
        string memory prefix = _chainPrefix();
        if (bytes(prefix).length != 0) {
            raw = vm.envOr(string.concat(prefix, suffix), string("UNSET"));
            if (keccak256(bytes(raw)) != keccak256("UNSET") && bytes(raw).length != 0) return (raw, true);
        }
        raw = vm.envOr(suffix, string("UNSET"));
        if (keccak256(bytes(raw)) == keccak256("UNSET") || bytes(raw).length == 0) return ("", false);
        return (raw, true);
    }

    function _chainPrefix() internal view returns (string memory) {
        if (block.chainid == ARBITRUM) return "ARBITRUM_";
        if (block.chainid == BSC) return "BSC_";
        if (block.chainid == 1) return "ETHEREUM_";
        if (block.chainid == 137) return "POLYGON_";
        if (block.chainid == 10) return "OPTIMISM_";
        if (block.chainid == 8453) return "BASE_";
        if (block.chainid == 43114) return "AVALANCHE_";
        if (block.chainid == 250) return "FANTOM_";
        return "";
    }

    function _broadcasting() internal view returns (bool) {
        return vm.isContext(VmSafe.ForgeContext.ScriptBroadcast) || vm.isContext(VmSafe.ForgeContext.ScriptResume);
    }

    function _printResult(MevVault vault, address implementation, bytes memory initData, Config memory cfg) internal view {
        console.log("chainId", block.chainid);
        console.log("MEV_VAULT_IMPLEMENTATION", implementation);
        console.log("MEV_VAULT_PROXY", address(vault));
        console.log("asset", address(vault.asset()));
        console.log("admin", vault.admin());
        console.log("executor", vault.executor());
        console.log("initData");
        console.logBytes(initData);
        console.log("--- salin ke .env indexer ---");
        console.log("VAULT_CHAIN_ID", block.chainid);
        console.log("VAULT_PROXY", address(vault));
        console.log("VAULT_IMPLEMENTATION", implementation);
        console.log("VAULT_ASSET", address(vault.asset()));
        console.log("VAULT_ADMIN", vault.admin());
        console.log("--- salin ke frontend ---");
        console.log(string.concat("NEXT_PUBLIC_MEV_VAULT_", vm.toString(block.chainid), "=", vm.toString(address(vault))));
        if (cfg.executorUnset || vault.executor() == address(0)) {
            console.log("Executor kosong. executeArb mati sampai admin memanggil setExecutor.");
        }
        if (cfg.admin.code.length == 0) {
            console.log("Admin adalah EOA. Pindahkan ke multisig lewat setAdmin sebelum ada deposit.");
        }
        _printNextSteps(address(vault));
        _printVerify(implementation, initData);
    }

    function _printExamples() internal view {
        string memory prefix = _chainPrefix();
        console.log("Isi ketiga variabel ini, lalu jalankan ulang.");
        console.log(string.concat("  ", prefix, "VAULT_ASSET"));
        console.log(string.concat("  ", prefix, "VAULT_ADMIN_ADDRESS"));
        console.log(string.concat("  ", prefix, "VAULT_EXECUTOR_ADDRESS  (boleh 0x0000...0000 untuk menunda eksekusi)"));
        if (block.chainid == ARBITRUM) {
            console.log("  contoh ARBITRUM_VAULT_ASSET USDC", ARBITRUM_USDC);
            console.log("  verifikasi memakai ARBITRUM_ETHERSCAN_API_KEY di perintah forge, bukan di kontrak");
        }
        if (block.chainid == BSC) console.log("  contoh BSC_VAULT_ASSET USDT", BSC_USDT);
        console.log("Satu deployment = satu token. USDC dan USDT butuh proxy terpisah.");
    }

    function _printNextSteps(address proxy) internal view {
        console.log("--- langkah admin setelah deploy ---");
        console.log("Pemanggil harus VAULT_ADMIN_ADDRESS. Fungsi router adalah setRouter(address,bool).");
        console.log("Kirim calldata ini dari multisig admin. Jangan pakai private key bot.");
        if (block.chainid == ARBITRUM) {
            _printRouter(proxy, "Uniswap SwapRouter02 V3", ARBITRUM_UNI_V3);
            _printRouter(proxy, "SushiSwap V2", ARBITRUM_SUSHI_V2);
            console.log("Jangan izinkan Camelot. ABI Algebra tidak sama dengan exactInputSingle vault ini.");
        } else if (block.chainid == BSC) {
            _printRouter(proxy, "PancakeSwap V2", BSC_PANCAKE_V2);
            console.log("Jangan izinkan PancakeSwap V3 SwapRouter. Struct-nya memuat deadline, vault ini tidak.");
        } else {
            console.log("Izinkan hanya router yang cocok dengan ABI vault:");
            console.log("  V2 swapExactTokensForTokens(uint256,uint256,address[],address,uint256)");
            console.log("  V3 exactInputSingle tanpa field deadline");
        }
        console.log("setDepositsPaused(true) sampai router terdaftar dan deposit uji kecil berhasil:");
        console.log("proxy", proxy);
        console.log("calldata pause");
        console.logBytes(abi.encodeCall(MevVault.setDepositsPaused, (true)));
        console.log("Penarikan tidak bisa dijeda. Jangan set admin sama dengan executor.");
    }

    function _printRouter(address proxy, string memory label, address router) internal pure {
        console.log(label, router);
        console.log("proxy", proxy);
        console.logBytes(abi.encodeCall(MevVault.setRouter, (router, true)));
    }

    function _printVerify(address implementation, bytes memory initData) internal view {
        console.log("--- verifikasi ---");
        console.log("forge script --verify memakai metadata broadcast. Jika gagal, jalankan manual:");
        console.log("solc 0.8.24, optimizer runs 200, evm paris, via_ir false");
        console.log("implementation", implementation);
        console.log("forge verify-contract <IMPLEMENTATION> contracts/MevVault.sol:MevVault --chain", block.chainid);
        console.log("proxy constructor args = abi.encode(implementation, initData)");
        console.log("initData ulang");
        console.logBytes(initData);
        console.log("forge verify-contract <PROXY> lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy --constructor-args <ARGS> --chain", block.chainid);
    }
}
