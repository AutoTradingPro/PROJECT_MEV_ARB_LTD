import { Contract, Interface, getAddress, type JsonRpcProvider } from "ethers";
import { createJsonRpcProvider, withRpcFailover } from "@/lib/bot/rpc";
import { getChain, type ChainId } from "@/lib/chain/networks";
import type { TrackedPool } from "@/scanner/reserveBook";
import { installInitializedTick, ticksInWindow } from "@/scanner/v3/tickBitmap";

/** Jarak tick di kiri dan kanan harga aktif yang diisi saat cold start. */
export const ACTIVE_TICK_RADIUS = 500;
const CHUNK = 120;

const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";
const MULTICALL_IFACE = new Interface([
  "function aggregate3((address target, bool allowFailure, bytes callData)[] calls) payable returns ((bool success, bytes returnData)[] returnData)",
]);
const TICK_IFACE = new Interface([
  "function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56 tickCumulativeOutside, uint160 secondsPerLiquidityOutsideX128, uint32 secondsOutside, bool initialized)",
]);

type Call3 = { target: string; allowFailure: boolean; callData: string };

async function aggregate3(
  client: JsonRpcProvider,
  calls: Call3[]
): Promise<{ success: boolean; returnData: string }[]> {
  if (calls.length === 0) return [];
  const multicall = new Contract(MULTICALL3, MULTICALL_IFACE, client);
  return (await multicall.aggregate3.staticCall(calls)) as { success: boolean; returnData: string }[];
}

function decodeTick(data: string): { liquidityGross: bigint; liquidityNet: bigint; initialized: boolean } | null {
  try {
    const decoded = TICK_IFACE.decodeFunctionResult("ticks", data);
    return {
      liquidityGross: BigInt(decoded[0]),
      liquidityNet: BigInt(decoded[1]),
      initialized: Boolean(decoded[7]),
    };
  } catch {
    return null;
  }
}

async function fillPool(client: JsonRpcProvider, entry: TrackedPool): Promise<number> {
  const v3 = entry.v3;
  if (!v3) return 0;
  const targets = ticksInWindow(v3.tick, v3.tickSpacing, ACTIVE_TICK_RADIUS);
  const pool = getAddress(entry.address);
  let installed = 0;
  for (let offset = 0; offset < targets.length; offset += CHUNK) {
    const slice = targets.slice(offset, offset + CHUNK);
    const calls: Call3[] = slice.map((tick) => ({
      target: pool,
      allowFailure: true,
      callData: TICK_IFACE.encodeFunctionData("ticks", [tick]),
    }));
    const rows = await aggregate3(client, calls);
    rows.forEach((row, index) => {
      if (!row.success) return;
      const tick = decodeTick(row.returnData);
      if (!tick?.initialized || tick.liquidityGross <= 0n) return;
      installInitializedTick(v3.ticks, slice[index], v3.tickSpacing, tick.liquidityGross, tick.liquidityNet);
      installed += 1;
    });
  }
  return installed;
}

/**
 * Cold start: baca ticks(int24) di sekitar harga aktif lewat RPC scan yang sama
 * (antrian Primary/Backup, termasuk BlockPI bila itu endpoint aktif), sebelum log Mint/Burn.
 */
export async function populateActiveTicks(chainId: ChainId, entries: TrackedPool[]): Promise<number> {
  const pools = entries.filter((entry) => entry.kind === "v3" && entry.v3);
  if (pools.length === 0) return 0;
  const networkId = getChain(chainId).chainId ?? 1;
  const loaded = await withRpcFailover(chainId, async (url) => {
    const client = createJsonRpcProvider(url, networkId);
    try {
      let total = 0;
      for (const entry of pools) total += await fillPool(client, entry);
      return total;
    } finally {
      client.destroy();
    }
  });
  console.log(
    `[scanner] cold start tick · ${pools.length} pool V3 · ${loaded} tick berlikuiditas · ±${ACTIVE_TICK_RADIUS} dari harga aktif`
  );
  return loaded;
}
