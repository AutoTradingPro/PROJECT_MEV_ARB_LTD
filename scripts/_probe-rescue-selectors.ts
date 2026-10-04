import { JsonRpcProvider, id } from "ethers";
import { ARBITRUM_BALANCER_FLASH_ARB, ETHEREUM_BALANCER_FLASH_ARB } from "../config/networks";
import { BSC_EXECUTOR_ADDRESS } from "../lib/vault/executors";

const SIGS = [
  "rescueFunds(address)",
  "rescueFunds(address,uint256)",
  "rescueETH()",
  "emergencyWithdraw(address,address)",
  "withdraw(uint256)",
  "withdrawToken(address,uint256)",
  "owner()",
];

const targets = [
  { chain: "ethereum", rpc: "https://ethereum.publicnode.com", address: process.env.NEXT_PUBLIC_ETHEREUM_ARBITRAGE_EXECUTOR || ETHEREUM_BALANCER_FLASH_ARB },
  { chain: "polygon", rpc: "https://polygon-bor.publicnode.com", address: process.env.NEXT_PUBLIC_POLYGON_ARBITRAGE_EXECUTOR || "" },
  { chain: "bsc", rpc: "https://bsc-rpc.publicnode.com", address: BSC_EXECUTOR_ADDRESS },
  { chain: "arbitrum", rpc: "https://arb1.arbitrum.io/rpc", address: process.env.NEXT_PUBLIC_ARBITRUM_ARBITRAGE_EXECUTOR || ARBITRUM_BALANCER_FLASH_ARB },
];

void (async () => {
for (const t of targets) {
  if (!t.address) {
    console.log(`${t.chain}: executor tidak dikonfigurasi`);
    continue;
  }
  try {
    const code = (await new JsonRpcProvider(t.rpc, undefined, { staticNetwork: true }).getCode(t.address)).toLowerCase();
    const found = SIGS.map((sig) => `${sig}=${code.includes("63" + id(sig).slice(2, 10)) ? "YA" : "tidak"}`);
    console.log(`${t.chain} ${t.address} codeLen=${(code.length - 2) / 2}\n  ${found.join("\n  ")}`);
  } catch (err) {
    console.log(`${t.chain}: gagal ${(err as Error).message}`);
  }
}
})();

