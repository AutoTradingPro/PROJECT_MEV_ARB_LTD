import { JsonRpcProvider, id } from "ethers";
import { BSC_EXECUTOR_ADDRESS } from "../lib/vault/executors";

const CANDIDATES = [
  "owner()", "withdraw()", "withdraw(address)", "withdraw(uint256)", "withdraw(address,uint256)",
  "withdrawToken(address)", "withdrawToken(address,uint256)", "withdrawTokens(address)", "withdrawETH()",
  "withdrawBNB()", "withdrawAll()", "withdrawAll(address)", "rescue(address)", "rescueTokens(address)",
  "rescueToken(address)", "rescueToken(address,uint256)", "rescueBNB()", "sweep(address)", "emergencyWithdraw()",
  "emergencyWithdraw(address)", "emergencyWithdraw(address,address)", "transferOwnership(address)",
  "setKilled(bool)", "killed()", "executeFlashArb(address,uint256,uint256,bytes)", "pancakeCall(address,uint256,uint256,bytes)",
  "uniswapV2Call(address,uint256,uint256,bytes)", "BiswapCall(address,uint256,uint256,bytes)", "deposit()",
  "depositToken(address,uint256)", "setMinProfitWei(uint256)", "minProfitWei()", "DEPLOYER()",
  "executeArbitrage(address,address,uint256,bytes)", "startArbitrage(address,uint256,uint256,address[],address[])",
  "flashArb(address,address,uint256)", "renounceOwnership()", "execute(bytes)",
];

void (async () => {
  const code = (await new JsonRpcProvider("https://bsc-rpc.publicnode.com", undefined, { staticNetwork: true }).getCode(BSC_EXECUTOR_ADDRESS)).toLowerCase().slice(2);
  const selectors = new Set<string>();
  for (let i = 0; i < code.length; i += 2) {
    const op = parseInt(code.slice(i, i + 2), 16);
    if (op === 0x63) selectors.add(code.slice(i + 2, i + 10));
    if (op >= 0x60 && op <= 0x7f) i += (op - 0x5f) * 2;
  }
  const known = new Map(CANDIDATES.map((sig) => [id(sig).slice(2, 10), sig]));
  for (const sel of selectors) console.log(`0x${sel} ${known.get(sel) ?? "?"}`);
})();
