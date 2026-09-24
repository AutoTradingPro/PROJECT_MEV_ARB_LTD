import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseBlockNumber } from "@/lib/chain/publicEnv";
import { DEFAULT_BOT_CONFIG } from "./constants";
import { migrateBotConfig } from "./configUnits";
import { appendServerLog } from "./serverLog";
import { hardAdoptScanChain, rememberStrictScanChain, strictScanChainId } from "./scanRuntime";
import { normalizeTradingChainId } from "@/config/networks";
import type { BotConfig, BotState, Opportunity, TradeRecord } from "./types";

const STATE_PATH = path.join(process.cwd(), "data", "bot-state.json");

const emptyState = (): BotState => ({
  killed: false,
  running: false,
  config: { ...DEFAULT_BOT_CONFIG },
  lastBlock: 0,
  gasPriceWei: "0",
  opportunities: [],
  trades: [],
  realizedProfitWei: "0",
  updatedAt: new Date().toISOString(),
});

export async function readBotState(): Promise<BotState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as BotState;
    const state: BotState = {
      ...emptyState(),
      ...parsed,
      config: migrateBotConfig(parsed.config ?? {}),
      lastBlock: parseBlockNumber(parsed.lastBlock),
    };
    if (!strictScanChainId()) {
      rememberStrictScanChain(normalizeTradingChainId(state.config.chainId));
    }
    return state;
  } catch {
    const state = emptyState();
    if (!strictScanChainId()) {
      rememberStrictScanChain(normalizeTradingChainId(state.config.chainId));
    }
    return state;
  }
}

export async function writeBotState(next: BotState): Promise<BotState> {
  const payload: BotState = {
    ...next,
    lastBlock: parseBlockNumber(next.lastBlock),
    updatedAt: new Date().toISOString(),
  };
  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

export async function patchBotState(
  updater: (current: BotState) => BotState | Promise<BotState>
): Promise<BotState> {
  const current = await readBotState();
  return writeBotState(await updater(current));
}

export async function updateConfig(partial: Partial<BotConfig>): Promise<BotState> {
  return patchBotState((state) => {
    const nextChain = normalizeTradingChainId(partial.chainId ?? state.config.chainId);
    const prevChain = normalizeTradingChainId(state.config.chainId);
    if (partial.chainId && nextChain !== prevChain) {
      hardAdoptScanChain(nextChain, "config");
      return {
        ...state,
        config: migrateBotConfig({ ...state.config, ...partial }),
        opportunities: [],
        lastError: undefined,
        lastBlock: 0,
        gasPriceWei: "0",
      };
    }
    return {
      ...state,
      config: migrateBotConfig({ ...state.config, ...partial }),
    };
  });
}

export async function setKilled(killed: boolean): Promise<BotState> {
  const next = await patchBotState((state) => ({
    ...state,
    killed,
    running: killed ? false : state.running,
  }));
  appendServerLog({
    level: killed ? "warn" : "info",
    source: "kill-switch",
    message: killed
      ? "KILL SWITCH GLOBAL AKTIF — scanner dan eksekusi ditahan."
      : "Kill switch dimatikan — mesin arbitrase diizinkan berjalan kembali.",
  });
  return next;
}

export async function setOpportunities(opportunities: Opportunity[]): Promise<BotState> {
  return patchBotState((state) => ({ ...state, opportunities }));
}

export async function appendTrade(trade: TradeRecord): Promise<BotState> {
  const next = await patchBotState((state) => {
    const profit = BigInt(state.realizedProfitWei || "0");
    const delta = trade.outcome === "success" ? BigInt(trade.netProfitWei || "0") : 0n;
    return {
      ...state,
      trades: [trade, ...state.trades].slice(0, 50),
      realizedProfitWei: (profit + delta).toString(),
    };
  });
  appendServerLog({
    level: trade.outcome === "success" ? "profit" : "warn",
    source: "trade",
    message: `${trade.outcome.toUpperCase()} ${trade.pair} · ${trade.route} · tx ${trade.txHash || "—"}`,
  });
  return next;
}
