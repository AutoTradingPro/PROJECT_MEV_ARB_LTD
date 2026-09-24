"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type ButtonPhase } from "@/components/ArbitrageMatrixUtama";
import DashboardTopControls from "@/components/DashboardTopControls";
import TxNotifyToast, { type TxNotify } from "@/components/TxNotifyToast";
import FreeModePanel from "@/components/tier/FreeModePanel";
import ProModePanel from "@/components/tier/ProModePanel";
import PnLAnalyticsPanel from "@/components/PnLAnalyticsPanel";
import ExtremeApproveBanner from "@/components/ExtremeApproveBanner";
import SandboxModeBanner from "@/components/sandbox/SandboxModeBanner";
import { useBotConfig } from "@/context/BotConfigContext";
import { useBotMode } from "@/context/BotModeContext";
import { useNetwork } from "@/context/NetworkContext";
import { useSandbox } from "@/context/SandboxContext";
import { useTier } from "@/context/TierContext";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/context/WalletContext";
import { useRpcLiveFeed } from "@/context/RpcLiveFeedContext";
import { useBotTerminal } from "@/hooks/useBotTerminal";
import { useLiveBlock } from "@/hooks/useLiveBlock";
import { useLiveNetworkFees } from "@/hooks/useLiveNetworkFees";
import { useProAutoExecute } from "@/hooks/useProAutoExecute";
import { DEFAULT_BOT_CONFIG, DEFAULT_GAS_STRATEGY, SCAN_IDLE_INTERVAL_MS, defaultDexIdsForChain } from "@/lib/bot/constants";
import { isTradingChainId, normalizeTradingChainId } from "@/config/networks";
import { hasActiveFlashLoanProvider, pickLivePoolFeePct, syncFlashLoanPlatformsToChain } from "@/lib/bot/flashLoanProviders";
import { orderOpportunitiesByPairList } from "@/lib/bot/opportunityOrder";
import { stableWeiToUsd } from "@/lib/bot/configUnits";
import { extractTxHash, explorerTxUrl, shortenTxHash } from "@/lib/chain/explorer";
import { formatOpportunityNet } from "@/lib/bot/bnbQuote";
import { buildTradeTraceSnapshot } from "@/lib/bot/transactionTrace";
import type { BotConfig, BotState, Opportunity } from "@/lib/bot/types";
import type { ScanOnlyReport } from "@/lib/scanOnly/types";
import { SCAN_ONLY_BLOCK_MESSAGE } from "@/lib/scanOnly/mode";
import {
  describeSolanaNotReadyDetail,
  featuredScanRoute,
  formatAdaptiveScanPaceLine,
  formatRuntimeScanLine,
  gasPriceToGwei,
  isScanIdlePace,
  isUserRejectedExec,
  maxOpportunitySpreadBps,
  minSpreadBpsFromConfig,
  pickLiveGasWei,
  resolveAdaptiveScanIntervalMs,
  scanLogBelongsToActiveChain,
  scanPairHighlights,
} from "@/lib/bot/autoExecute";
import { evaluateGasStrategy } from "@/lib/bot/gasStrategy";
import { meetsMinPoolLiquidityUsd } from "@/lib/bot/poolSafety";
import { formatWalletError } from "@/lib/wallet/rpcError";
import { parseBlockNumber } from "@/lib/chain/publicEnv";
import { formatConfigSnapshot, isExecRevertFailure } from "@/lib/bot/revertReason";
import { sendContractTx } from "@/lib/wallet/sendTx";
import { buildHardhatTxDump, HARDHAT_FORK_FROM, sleep } from "@/lib/sandbox/hardhatTxDump";

const emptyState = (): BotState => ({
  killed: false,
  running: false,
  config: DEFAULT_BOT_CONFIG,
  lastBlock: 0,
  gasPriceWei: "0",
  opportunities: [],
  trades: [],
  realizedProfitWei: "0",
  updatedAt: new Date().toISOString(),
});

function flashPhase(setter: (phase: ButtonPhase) => void, phase: ButtonPhase, ms = 1600) {
  setter(phase);
  window.setTimeout(() => setter("idle"), ms);
}

function explorerLinkLabel(chainId: string): string {
  if (chainId === "polygon") return "Buka Polygonscan";
  if (chainId === "arbitrum") return "Buka Arbiscan";
  if (chainId === "ethereum") return "Buka Etherscan";
  return "Buka BscScan";
}

function pushExecFailure(
  push: (
    level: "error",
    message: string,
    link?: { href?: string; label?: string }
  ) => void,
  raw: string,
  config?: BotConfig,
  chainId: string = "polygon"
) {
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^\[EXEC\]\s*/i, "").trim())
    .filter(Boolean);
  if (lines.length === 0) {
    push("error", "[EXEC] execution reverted");
    if (config) push("error", formatConfigSnapshot(config));
    return;
  }
  const isPreflight = /\[PREFLIGHT\]/i.test(raw);
  const isRevert = isExecRevertFailure(raw);
  if (isPreflight) {
    push("error", "[PREFLIGHT] simulation failure — belum di-broadcast (tidak ada tx hash)");
  } else if (isRevert) {
    push("error", "[EXEC] execution reverted");
  }
  const seen = new Set<string>();
  for (const line of lines) {
    if (/^execution reverted$/i.test(line)) continue;
    if (/^\[CONFIG SNAPSHOT\]/i.test(line)) continue;
    const hash = extractTxHash(line);
    if (hash) {
      if (seen.has(hash)) continue;
      seen.add(hash);
      const href = explorerTxUrl(hash, chainId);
      push("error", `[TX HASH] ${hash}`, { href, label: explorerLinkLabel(chainId) });
      continue;
    }
    if (/^https?:\/\/.*\/tx\/0x/i.test(line)) continue;
    push("error", `[EXEC] ${line}`);
  }
  if (config && isRevert) push("error", formatConfigSnapshot(config));
}

export default function ControlCenter() {
  const { isFree, isPro, scannerEnabled, setScannerEnabled, proScanMode, setProScanMode } = useTier();
  const { isScanOnly, botMode } = useBotMode();
  const { chain, chainId, pair, pairId, availablePairs, setPairId, activeNetwork, hydrated } = useNetwork();
  const {
    isSandbox,
    vaultUsd,
    realizedProfitWei: sandboxRealizedWei,
    trades: sandboxTrades,
    applyProfit,
    withdrawVault,
    resetSandbox,
  } = useSandbox();
  const { address: walletAddress } = useWallet();
  const { user: authUser } = useAuth();
  const { wssEnabled, rpcFallbackEnabled } = useRpcLiveFeed();
  const { blockNumber, tickMs, setScanPaceMs, applyLiveBlock } = useLiveBlock(
    chainId,
    chain.evm || chainId === "solana"
  );
  const liveBlockRef = useRef(0);
  const { gasPriceWei: liveGasPriceWei } = useLiveNetworkFees(
    chainId,
    chain.evm || chainId === "solana"
  );
  const { config, setConfig, patchConfig } = useBotConfig();
  const flashLoanArmed = hasActiveFlashLoanProvider(config.flashLoanPlatforms);

  const [state, setState] = useState<BotState>(emptyState);
  const [scanOnlyReport, setScanOnlyReport] = useState<ScanOnlyReport | null>(null);
  const scanDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanPhase, setScanPhase] = useState<ButtonPhase>("idle");
  const [simulatePhase, setSimulatePhase] = useState<ButtonPhase>("idle");
  const [simulateHint, setSimulateHint] = useState("");
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [txNotify, setTxNotify] = useState<TxNotify | null>(null);
  const [extremeArmedUntil, setExtremeArmedUntil] = useState(0);
  const [showExtremeBanner, setShowExtremeBanner] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<"kill" | "resume" | "withdraw" | null>(null);
  const lastAutoScan = useRef(0);
  const scanIntervalMs = useRef(SCAN_IDLE_INTERVAL_MS);
  const scanIdlePace = useRef<boolean | null>(null);
  const killedRef = useRef(false);
  const sandboxRef = useRef(false);
  const scanInFlight = useRef(false);
  const scanAbortRef = useRef<AbortController | null>(null);
  const scanEpochRef = useRef(0);
  const executingRef = useRef(false);
  const lastSignerLine = useRef("");
  const lastTradingChain = useRef<string | null>(null);
  const skipScanModeRescan = useRef(true);
  const scanOnlyRef = useRef(false);
  const lastScanOnlyKey = useRef("");
  const configRef = useRef(config);
  configRef.current = config;
  const displayGasWei = pickLiveGasWei(liveGasPriceWei, state.gasPriceWei);

  killedRef.current = state.killed;
  sandboxRef.current = isSandbox;
  scanOnlyRef.current = isScanOnly;
  liveBlockRef.current = parseBlockNumber(blockNumber);

  const resolveScanPairIds = useCallback((): string[] => {
    if (proScanMode === "full") {
      return availablePairs.map((p) => p.id);
    }
    return [pairId];
  }, [proScanMode, availablePairs, pairId]);

  const displayOpportunities = useMemo(() => {
    const allowed = new Set(availablePairs.map((p) => p.id));
    const onChain = state.opportunities.filter(
      (item) => item.chainId === chainId && allowed.has(item.pairId)
    );
    const scoped =
      proScanMode === "full" ? onChain : onChain.filter((item) => item.pairId === pairId);
    return orderOpportunitiesByPairList(
      scoped,
      proScanMode === "full" ? availablePairs.map((p) => p.id) : [pairId]
    );
  }, [state.opportunities, chainId, pairId, isFree, proScanMode, availablePairs]);

  const livePoolFee = useMemo(
    () => pickLivePoolFeePct(displayOpportunities, pairId),
    [displayOpportunities, pairId]
  );

  const {
    entries: terminalEntries,
    sessionProfitUsd,
    sessionProfitWei,
    sessionTrades,
    clear: clearTerminal,
    resetSession,
    push,
    recordSessionTrade,
  } = useBotTerminal({
    config,
    opportunities: displayOpportunities,
    scannerEnabled: isPro && (scannerEnabled || isSandbox),
    killed: state.killed,
    scanPhase,
    liveBlock: parseBlockNumber(blockNumber),
    gasPriceWei: displayGasWei,
    suppressScanCycleLogs: isPro,
    activeChainId: chainId,
  });

  const refresh = useCallback(async () => {
    if (sandboxRef.current) return null;
    try {
      const res = await fetch(`/api/bot?t=${Date.now()}`, {
        cache: "no-store",
        headers: { pragma: "no-cache" },
      });
      const text = await res.text();
      if (!res.ok || !text) return null;
      let json: BotState;
      try {
        json = JSON.parse(text) as BotState;
      } catch {
        return null;
      }
      if (sandboxRef.current) return json;
      const incomingChain = normalizeTradingChainId(json.config?.chainId);
      setState((current) => {
        const uiChain = normalizeTradingChainId(current.config.chainId);
        if (incomingChain !== uiChain) {
          return {
            ...current,
            killed: json.killed,
          };
        }
        return {
          ...json,
          config: current.config,
          opportunities: (json.opportunities || []).filter((item) => !item.chainId || item.chainId === uiChain),
          gasPriceWei: pickLiveGasWei(json.gasPriceWei, current.gasPriceWei),
        };
      });
      return json;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (isSandbox) return;
    void refresh();
    const id = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(id);
  }, [refresh, isSandbox]);

  const runScan = useCallback(async (opts?: { silent?: boolean }) => {
    if (killedRef.current) return;
    if (scanInFlight.current) return;
    const ac = new AbortController();
    scanAbortRef.current = ac;
    const epoch = scanEpochRef.current;
    scanInFlight.current = true;
    const silent = opts?.silent ?? isFree;
    if (!silent) setScanPhase("loading");
    if (scanOnlyRef.current) {
      const scanConfig = configRef.current;
      try {
        const res = await fetch("/api/scan-only", {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            chainId,
            config: {
              ...scanConfig,
              chainId,
            },
          }),
        });
        const json = (await res.json().catch(() => null)) as (ScanOnlyReport & { error?: string }) | null;
        if (epoch !== scanEpochRef.current || ac.signal.aborted) return;
        if (!json || json.error) throw new Error(json?.error || "scan-only gagal");
        setScanOnlyReport(json);
        applyLiveBlock(json.blockNumber);
        setState((prev) => ({
          ...prev,
          lastBlock: json.blockNumber || prev.lastBlock,
          gasPriceWei: pickLiveGasWei(json.gasPriceWei, prev.gasPriceWei),
          lastError: undefined,
        }));
        scanIntervalMs.current = SCAN_IDLE_INTERVAL_MS;
        setScanPaceMs(SCAN_IDLE_INTERVAL_MS);
        const key = `${json.blockNumber}:${json.layakCount}:${json.skipCount}:${json.minSpreadPct}:${json.maxSpotSpreadPct}:${json.maxPriceImpactPct}:${json.bribePct}:${json.bestNetUsd.toFixed(2)}`;
        if (lastScanOnlyKey.current !== key) {
          lastScanOnlyKey.current = key;
          push("scan", json.matrix);
        }
        if (!silent) flashPhase(setScanPhase, "success");
      } catch (error) {
        const aborted =
          (error instanceof DOMException && error.name === "AbortError") ||
          (error instanceof Error && error.name === "AbortError");
        if (aborted) return;
        if (!silent) flashPhase(setScanPhase, "error", 2000);
      } finally {
        scanInFlight.current = false;
      }
      return;
    }
    const pairIds = resolveScanPairIds();
    const scanConfig = configRef.current;
    try {
      const scanEndpoint = isSandbox ? "/api/sandbox" : "/api/bot";
      const res = await fetch(scanEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          action: "scan",
          scanMode: proScanMode === "full" ? "full" : "single",
          pairIds,
          chainId,
          config: {
            ...scanConfig,
            chainId,
            pairId,
            scanMode: proScanMode === "full" ? "full" : "single",
            activeDexIds: scanConfig.activeDexIds,
            loanAmountUsd: scanConfig.loanAmountUsd ?? DEFAULT_BOT_CONFIG.loanAmountUsd,
            aaveFeePct: scanConfig.aaveFeePct,
            flashLoanProvider: scanConfig.flashLoanProvider,
            flashLoanPlatforms: scanConfig.flashLoanPlatforms,
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | (BotState & {
            opportunities?: BotState["opportunities"];
            lastBlock?: number;
            killed?: boolean;
            chainId?: string;
            error?: string;
            autonomousSignerLine?: string;
            signerBalances?: {
              nativeSymbol?: string;
              nativeFormatted?: string;
              nativeLow?: boolean;
              tokenSymbol?: string;
              tokenFormatted?: string;
              vaultFormatted?: string;
              vaultLow?: boolean;
              vaultEthFormatted?: string;
              vaultUsdcFormatted?: string;
              vaultUsdtFormatted?: string;
            };
          })
        | null;
      if (!json) throw new Error("scan gagal");
      if (!res.ok) throw new Error(json.error || "scan gagal");
      if (epoch !== scanEpochRef.current || ac.signal.aborted) return;
      const scanWasSandbox = scanEndpoint === "/api/sandbox";
      if (scanWasSandbox !== sandboxRef.current) return;
      const scannedChain = normalizeTradingChainId(json.chainId || json.config?.chainId || chainId);
      if (!scanWasSandbox && scannedChain !== chainId) return;
      if (Array.isArray(json.opportunities)) {
        const scoped = json.opportunities.filter((item) => !item.chainId || item.chainId === chainId);
        setState((prev) => ({
          ...prev,
          killed: json.killed === true ? true : json.killed === false ? false : prev.killed,
          opportunities: json.killed === true ? [] : scoped,
          lastError: json.lastError,
          lastBlock: json.lastBlock || prev.lastBlock,
          gasPriceWei: pickLiveGasWei(json.gasPriceWei, prev.gasPriceWei),
        }));
        const list = scoped.filter((item) =>
          // Solana: estimasi liq Jupiter kasar — jangan saring dari pace/spread UI
          // (ambang $800k hanya menahan eksekusi, bukan memperlambat pencarian spread).
          chainId === "solana"
            ? (item.priceDexAUsd || 0) > 0 && (item.priceDexBUsd || 0) > 0
            : meetsMinPoolLiquidityUsd(item.poolLiquidityUsd, scanConfig.minPoolLiquidityUsd ?? 0)
        );
        const maxSpreadBps = maxOpportunitySpreadBps(list);
        const nextInterval = resolveAdaptiveScanIntervalMs(config.minSpreadPct, maxSpreadBps, chainId);
        scanIntervalMs.current = nextInterval;
        setScanPaceMs(nextInterval);
        const scanBlock = parseBlockNumber(json.lastBlock);
        applyLiveBlock(scanBlock);
        const canonicalBlock =
          scanBlock || Math.max(parseBlockNumber(liveBlockRef.current), parseBlockNumber(blockNumber));
        const idle = isScanIdlePace(config.minSpreadPct, maxSpreadBps);
        if (scanIdlePace.current !== idle) {
          scanIdlePace.current = idle;
          push(
            "scan",
            formatAdaptiveScanPaceLine({
              minSpreadPct: config.minSpreadPct,
              maxSpreadBps,
              intervalMs: nextInterval,
              chainId,
            })
          );
        }
        const signerLine = json.autonomousSignerLine?.trim();
        if (
          isPro &&
          signerLine &&
          scanLogBelongsToActiveChain(signerLine, chainId) &&
          signerLine !== lastSignerLine.current
        ) {
          lastSignerLine.current = signerLine;
          push(signerLine.includes("BUKAN owner") ? "warn" : "info", signerLine);
        }
        if (isPro && !killedRef.current && !executingRef.current) {
          const ready = list.filter((item) => item.status === "ready");
          const pairHighlights = scanPairHighlights(list);
          const highlight = pairHighlights[0] ?? featuredScanRoute(list);
          const block = canonicalBlock || "—";
          const scanGas = pickLiveGasWei(json.gasPriceWei, liveGasPriceWei);
          const expectedGas = chain.nativeSymbol;
          const balances =
            json.signerBalances?.nativeSymbol === expectedGas ? json.signerBalances : undefined;
          const scanMinBps = minSpreadBpsFromConfig(scanConfig);
          const notReadyDetail =
            chainId === "solana" && ready.length === 0
              ? describeSolanaNotReadyDetail(list, scanMinBps)
              : undefined;
          push(
            "scan",
            formatRuntimeScanLine({
              sandbox: isSandbox,
              chainId,
              block,
              routes: list.length,
              ready: ready.length,
              maxSpreadBps: highlight?.spreadBps ?? 0,
              gasPriceWei: scanGas,
              pair: highlight?.pair,
              dexIn: highlight?.dexIn,
              dexOut: highlight?.dexOut,
              pairHighlights,
              scannedPairLabels: pairIds
                .map((id) => availablePairs.find((item) => item.id === id)?.label)
                .filter((label): label is string => Boolean(label)),
              minSpreadBps: scanMinBps,
              minPoolLiquidityUsd: scanConfig.minPoolLiquidityUsd,
              nativeSymbol: expectedGas,
              nativeBalance: balances?.nativeFormatted,
              gasLimit: scanConfig.gasLimit,
              tokenSymbol: balances?.tokenSymbol,
              tokenBalance: balances?.vaultFormatted ?? balances?.tokenFormatted,
              vaultEth: balances?.vaultEthFormatted,
              vaultUsdc: balances?.vaultUsdcFormatted,
              vaultUsdt: balances?.vaultUsdtFormatted,
              notReadyDetail,
            })
          );
        }
      }
      if (!isSandbox) await refresh();
      if (!silent) flashPhase(setScanPhase, "success");
    } catch (error) {
      const aborted =
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError");
      if (aborted) return;
      if (!silent) flashPhase(setScanPhase, "error", 2000);
    } finally {
      scanInFlight.current = false;
    }
  }, [refresh, chainId, chain.nativeSymbol, pairId, isFree, isPro, isSandbox, isScanOnly, proScanMode, resolveScanPairIds, availablePairs, push, blockNumber, liveGasPriceWei, setScanPaceMs, applyLiveBlock]);

  useEffect(() => {
    if (!isSandbox || !isPro) return;
    setScannerEnabled(true);
  }, [isSandbox, isPro, setScannerEnabled]);

  useEffect(() => {
    if (!isSandbox || !isPro || state.killed || !flashLoanArmed) return;
    void runScan({ silent: true });
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now - lastAutoScan.current < scanIntervalMs.current) return;
      lastAutoScan.current = now;
      void runScan({ silent: true });
    }, 100);
    return () => window.clearInterval(id);
  }, [isSandbox, isPro, state.killed, runScan, flashLoanArmed]);

  useEffect(() => {
    if (!hydrated || state.killed || !flashLoanArmed) return;
    if (isScanOnly) {
      /* pemantauan 10 pair setiap tick, tanpa eksekusi */
    } else {
      if (isSandbox) return;
      if (!isPro || !scannerEnabled || !(chain.evm || chainId === "solana")) return;
    }
    const tick = () => {
      if (killedRef.current) return;
      const now = Date.now();
      if (now - lastAutoScan.current < scanIntervalMs.current) return;
      lastAutoScan.current = now;
      void runScan({ silent: true });
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [runScan, state.killed, chain.evm, chainId, isPro, isFree, scannerEnabled, isSandbox, hydrated, isScanOnly, flashLoanArmed]);

  useEffect(() => {
    if (!isPro || state.killed || !flashLoanArmed) return;
    if (!(scannerEnabled || isSandbox)) return;
    const ping = () => {
      void fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat-ping",
          isPro: true,
          telegramId: authUser?.telegramId,
          username: authUser?.username,
          email: authUser?.email,
          wallet: walletAddress,
          sandbox: isSandbox,
          wssEnabled,
          rpcFallbackEnabled,
        }),
      }).catch(() => {
        /* heartbeat ping tidak boleh mengganggu bot */
      });
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    return () => window.clearInterval(id);
  }, [
    isPro,
    state.killed,
    scannerEnabled,
    isSandbox,
    flashLoanArmed,
    authUser?.telegramId,
    authUser?.username,
    authUser?.email,
    walletAddress,
    wssEnabled,
    rpcFallbackEnabled,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const trading = isTradingChainId(chainId) ? chainId : "bsc";
    const switched = lastTradingChain.current !== null && lastTradingChain.current !== trading;
    const firstLock = lastTradingChain.current === null;
    lastTradingChain.current = trading;
    patchConfig({
      chainId: trading,
      pairId,
      flashLoanPlatforms: syncFlashLoanPlatformsToChain(configRef.current.flashLoanPlatforms, trading),
      ...(switched ? { activeDexIds: defaultDexIdsForChain(trading) } : {}),
    });
    let cancelled = false;
    const boot = async () => {
      if (switched || firstLock) {
        scanAbortRef.current?.abort();
        scanEpochRef.current += 1;
        scanInFlight.current = false;
        lastSignerLine.current = "";
        scanIdlePace.current = null;
        scanIntervalMs.current = SCAN_IDLE_INTERVAL_MS;
        setScanPaceMs(SCAN_IDLE_INTERVAL_MS);
        lastAutoScan.current = 0;
        clearTerminal();
        setState((current) => ({
          ...current,
          opportunities: [],
          lastBlock: 0,
          gasPriceWei: "0",
          lastError: undefined,
        }));
        try {
          await fetch("/api/bot", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              action: "adopt-chain",
              config: { chainId: trading, pairId },
            }),
          });
        } catch {
          /* ganti rantai tetap dilanjutkan di klien */
        }
      }
      if (cancelled) return;
      if (isSandbox && isPro) return;
      void runScan({ silent: isFree });
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [chainId, hydrated, isFree, isSandbox, patchConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!hydrated) return;
    patchConfig({ scanMode: proScanMode === "full" ? "full" : "single" });
    if (skipScanModeRescan.current) {
      skipScanModeRescan.current = false;
      return;
    }
    if (isSandbox && isPro) return;
    void runScan({ silent: false });
  }, [proScanMode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    patchConfig({ pairId });
  }, [pairId, patchConfig]);

  useEffect(() => {
    if (!hydrated) return;
    if (proScanMode === "full") return;
    void runScan();
  }, [pairId, hydrated, isFree, proScanMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendTx = useCallback(async (to: string, data: string, label: string, gasLimit?: number) => {
    push("exec", `[TX] Menunggu konfirmasi MetaMask · ${label}`);
    const txHash = await sendContractTx(to, data, { gasLimit });
    const href = explorerTxUrl(txHash, chainId);
    push("exec", `[TX HASH] ${shortenTxHash(txHash)} · dikirim ke jaringan`, {
      href,
      label: explorerLinkLabel(chainId),
    });
    setTxNotify({
      id: txHash,
      tone: "success",
      title: "Transaksi terkirim",
      message: txHash,
      href,
    });
    return txHash;
  }, [push, chainId]);

  const handleExecute = useCallback(async (
    opp: Opportunity,
    execConfig: BotConfig,
    source: "auto" | "manual" = "manual",
    queue?: Opportunity[]
  ): Promise<"ok" | "fail" | "reject"> => {
    if (killedRef.current) {
      push("warn", "[EXEC] Dibatalkan — kill switch aktif.");
      return "fail";
    }
    if (scanOnlyRef.current) {
      push("warn", `[SCAN_ONLY] ${SCAN_ONLY_BLOCK_MESSAGE}`);
      return "fail";
    }

    if (isSandbox) {
      executingRef.current = true;
      setExecutingId(opp.id);
      push(
        "exec",
        `[SANDBOX] ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} · virtual pool · dumping Transaction`
      );
      try {
        const res = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "execute",
            opportunity: opp,
            config: execConfig,
            isPro,
            telegramId: authUser?.telegramId,
            username: authUser?.username,
            email: authUser?.email,
            wallet: walletAddress,
            botMode,
          }),
        });
        const json = (await res.json()) as {
          txHash?: string;
          netProfitWei?: string;
          trade?: BotState["trades"][number];
          error?: string;
        };
        if (!res.ok || json.error || !json.txHash) {
          const message = json.error || "Eksekusi sandbox gagal.";
          push("error", `[SANDBOX] ${message}`);
          setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Sandbox gagal", message });
          return "fail";
        }
        const profitWei = json.netProfitWei || opp.netProfitWei || "0";
        applyProfit(profitWei, json.trade);
        recordSessionTrade(profitWei);
        setState((current) => ({
          ...current,
          realizedProfitWei: (
            BigInt(current.realizedProfitWei || "0") + BigInt(profitWei)
          ).toString(),
          trades: json.trade ? [json.trade, ...current.trades] : current.trades,
        }));

        const dumpLines = buildHardhatTxDump({
          txHash: json.txHash,
          opportunity: opp,
          config: execConfig,
          from: walletAddress || HARDHAT_FORK_FROM,
          blockNumber: state.lastBlock,
        });
        for (const tokens of dumpLines) {
          push("dump", tokens.map((part) => part.text).join(""), { dump: true, tokens });
          await sleep(22);
        }

        if (BigInt(profitWei) > 0n) {
          push("profit", `[SANDBOX PROFIT] +${formatOpportunityNet(opp, 4, chain.nativeSymbol)} · vault fiktif bertambah`);
        }
        push(
          "scan",
          `[TESTNET] Runtime scan dilanjutkan · interval adaptif (1000 ms jika spread < min−0.1% / belum > setting, else 100–200 ms)`
        );
        setTxNotify({
          id: json.txHash,
          tone: "success",
          title: "Sandbox: transaksi tiruan sukses",
          message: json.txHash,
        });
        return "ok";
      } catch (err) {
        const message = formatWalletError(err);
        push("error", `[SANDBOX] ${message}`);
        setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Sandbox gagal", message });
        return "fail";
      } finally {
        executingRef.current = false;
        setExecutingId(null);
      }
    }

    const gwei = gasPriceToGwei(displayGasWei);
    const extremeArmed = Date.now() < extremeArmedUntil;
    const gate = evaluateGasStrategy({
      gwei,
      config: execConfig,
      extremeArmed,
      chainId,
    });

    if (source === "auto") {
      if (!gate.ok) {
        if (gwei <= 0 && chainId !== "solana") return "fail";
        if (gate.needApproval) setShowExtremeBanner(true);
        push("warn", `[EXEC] ${gate.reason}`);
        setTxNotify({
          id: `err-${Date.now()}`,
          tone: gate.needApproval ? "info" : "error",
          title: gate.needApproval ? "Approval Extreme diperlukan" : "Eksekusi ditahan",
          message: gate.reason,
        });
        return "fail";
      }

      setExecutingId(opp.id);
      const queueSize = queue?.length ?? 1;
      push(
        "exec",
        `[EXEC] ${gate.mode.toUpperCase()} otonom · antrian ${queueSize} kandidat · mulai ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange}`
      );
      try {
        const res = await fetch("/api/bot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "execute-autonomous",
            opportunityId: opp.id,
            opportunityIds: (queue && queue.length > 0 ? queue : [opp]).map((item) => item.id),
            extremeApproved: gate.mode === "extreme" && extremeArmed,
            config: { ...execConfig, chainId },
            botMode,
          }),
        });
        const json = (await res.json()) as {
          txHash?: string;
          error?: string;
          opportunity?: Opportunity;
          executedRank?: number;
          queueSize?: number;
          skipped?: Array<{ rank: number; id: string; reason: string }>;
        };
        if (!res.ok || json.error || !json.txHash) {
          const message = json.error || "Eksekusi otonom gagal.";
          for (const skip of json.skipped ?? []) {
            push("warn", `[QUEUE] peringkat ${skip.rank} dilewati — ${skip.reason}`);
          }
          pushExecFailure(push, message, execConfig, chainId);
          setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Otonom gagal", message });
          return "fail";
        }
        for (const skip of json.skipped ?? []) {
          push("warn", `[QUEUE] peringkat ${skip.rank} dilewati — ${skip.reason}`);
        }
        const filled = json.opportunity ?? opp;
        if ((json.executedRank ?? 1) > 1) {
          push(
            "exec",
            `[QUEUE] fallback sukses pada peringkat ${json.executedRank} / ${json.queueSize ?? queueSize} · ${filled.tokenPair} · ${filled.buyExchange} → ${filled.sellExchange}`
          );
        }
        const href = explorerTxUrl(json.txHash, chainId);
        push("exec", `[TX HASH] ${shortenTxHash(json.txHash)} · signer privat`, {
          href,
          label: explorerLinkLabel(chainId),
        });
        setTxNotify({
          id: json.txHash,
          tone: "success",
          title: "Transaksi otonom terkirim",
          message: json.txHash,
          href,
        });
        const profitWei = filled.netProfitWei || "0";
        recordSessionTrade(profitWei);
        if (BigInt(profitWei) > 0n) {
          setState((current) => ({
            ...current,
            realizedProfitWei: (BigInt(current.realizedProfitWei || "0") + BigInt(profitWei)).toString(),
          }));
          push("profit", `[PROFIT] +${formatOpportunityNet(filled, 4, chain.nativeSymbol)} net · tx ${shortenTxHash(json.txHash)}`);
        }
        await refresh();
        return "ok";
      } catch (err) {
        const message = formatWalletError(err);
        pushExecFailure(push, message, execConfig, chainId);
        setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Transaksi gagal", message });
        void fetch("/api/bot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "report-exec-error",
            pair: opp.tokenPair,
            route: `${opp.buyExchange} → ${opp.sellExchange}`,
            message,
            source: "auto",
          }),
        });
        return "fail";
      } finally {
        setExecutingId(null);
      }
    }

    if (!walletAddress) {
      const message = "Hubungkan dompet MetaMask terlebih dahulu.";
      push("error", `[EXEC] ${message}`);
      setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Eksekusi dibatalkan", message });
      return "fail";
    }
    setExecutingId(opp.id);
    push(
      "exec",
      `[EXEC] ${opp.tokenPair} · ${opp.buyExchange} → ${opp.sellExchange} · menyusun calldata`
    );
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "execute-calldata",
          opportunityId: opp.id,
          to: walletAddress,
          config: { ...execConfig, chainId },
          botMode,
        }),
      });
      const json = (await res.json()) as { to?: string; data?: string; gasLimit?: number; error?: string };
      if (json.error || !json.to || !json.data) {
        const message = json.error || "Calldata tidak tersedia.";
        if (/\[PREFLIGHT\]/i.test(message)) {
          push("error", message);
        } else {
          push("error", `[EXEC] Gagal · ${message}`);
        }
        setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Calldata gagal", message });
        return "fail";
      }
      const txHash = await sendTx(json.to, json.data, `executeFlashArb ${opp.tokenPair}`, json.gasLimit);
      const profitWei = opp.netProfitWei || "0";
      recordSessionTrade(profitWei);
      if (BigInt(profitWei) > 0n) {
        setState((current) => ({
          ...current,
          realizedProfitWei: (BigInt(current.realizedProfitWei || "0") + BigInt(profitWei)).toString(),
        }));
        push("profit", `[PROFIT] +${formatOpportunityNet(opp, 4, chain.nativeSymbol)} net · tx ${shortenTxHash(txHash)}`);
      }
      await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "record-trade",
          pair: opp.tokenPair,
          route: `${opp.buyExchange} → ${opp.sellExchange}`,
          netProfitWei: profitWei,
          txHash,
          isPro,
          telegramId: authUser?.telegramId,
          username: authUser?.username,
          email: authUser?.email,
          wallet: walletAddress,
          config: execConfig,
          trace: buildTradeTraceSnapshot({
            opportunity: opp,
            txHash,
            config: execConfig,
            blockNumber: blockNumber || state.lastBlock,
            gasPriceWei: displayGasWei,
            isSandbox: false,
            isPro,
          }),
        }),
      });
      await refresh();
      return "ok";
    } catch (err) {
      const message = formatWalletError(err);
      pushExecFailure(push, message, execConfig, chainId);
      setTxNotify({
        id: `err-${Date.now()}`,
        tone: "error",
        title: "Transaksi gagal",
        message,
      });
      if (!isUserRejectedExec(message)) {
        void fetch("/api/bot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "report-exec-error",
            pair: opp.tokenPair,
            route: `${opp.buyExchange} → ${opp.sellExchange}`,
            message,
            source: "manual",
          }),
        });
      }
      return isUserRejectedExec(message) ? "reject" : "fail";
    } finally {
      setExecutingId(null);
    }
  }, [walletAddress, refresh, push, recordSessionTrade, sendTx, displayGasWei, state.lastBlock, blockNumber, extremeArmedUntil, isSandbox, isPro, applyProfit, authUser, botMode]);

  useProAutoExecute({
    enabled:
      isPro &&
      !isScanOnly &&
      flashLoanArmed &&
      (scannerEnabled || isSandbox) &&
      !state.killed,
    killed: state.killed,
    executing: Boolean(executingId),
    opportunities: displayOpportunities,
    config,
    gasPriceWei: displayGasWei,
    execute: (opp, cfg, queue) => handleExecute(opp, cfg, "auto", queue),
    push,
    extremeArmed: Date.now() < extremeArmedUntil,
    onNeedExtremeApproval: () => setShowExtremeBanner(true),
    bypassGasGate: isSandbox,
  });

  const handleSimulate = async () => {
    setSimulatePhase("loading");
    setSimulateHint("");
    try {
      if (isSandbox) {
        const ready = displayOpportunities.find((item) => item.status === "ready");
        const res = await fetch("/api/sandbox", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "simulate",
            opportunities: displayOpportunities,
            opportunityId: ready?.id,
          }),
        });
        const json = (await res.json()) as { simulated?: boolean; reason?: string };
        setSimulateHint(json.reason ?? "");
        flashPhase(setSimulatePhase, json.simulated ? "success" : "error", 2200);
        return;
      }
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "simulate", to: walletAddress || undefined }),
      });
      const json = (await res.json()) as { simulated?: boolean; reason?: string };
      await refresh();
      setSimulateHint(json.reason ?? "");
      flashPhase(setSimulatePhase, json.simulated ? "success" : "error", 2200);
    } catch {
      setSimulateHint("Simulasi gagal dijalankan.");
      flashPhase(setSimulatePhase, "error", 2200);
    }
  };

  const handleKill = async () => {
    setPendingSwitch("kill");
    setScannerEnabled(false);
    setState((current) => ({ ...current, killed: true, running: false }));
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "kill" }),
      });
      const json = (await res.json()) as BotState & { killData?: string; to?: string };
      setState((current) => ({ ...current, ...json, killed: true, running: false }));
      if (isSandbox) {
        push("warn", "[KILL] Switch global aktif — scanner testnet/mainnet ditahan.");
        setPendingSwitch(null);
        return;
      }
      if (json.to && json.killData) await sendTx(json.to, json.killData, "setKilled(true)");
      await refresh();
    } catch (err) {
      const message = formatWalletError(err);
      push("error", `[KILL] ${message}`);
      setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Kill switch gagal", message });
      setState((current) => ({ ...current, killed: false }));
    } finally {
      setPendingSwitch(null);
    }
  };

  const handleResume = async () => {
    setPendingSwitch("resume");
    setState((current) => ({ ...current, killed: false }));
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });
      const json = (await res.json()) as BotState & { killData?: string; to?: string };
      setState((current) => ({ ...current, ...json, killed: false }));
      if (isSandbox) {
        push("info", "[RESUME] Kill switch global dilepas — virtual pool boleh scan lagi.");
        setPendingSwitch(null);
        return;
      }
      if (json.to && json.killData) await sendTx(json.to, json.killData, "setKilled(false)");
      await refresh();
    } catch (err) {
      const message = formatWalletError(err);
      push("error", `[RESUME] ${message}`);
      setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Resume gagal", message });
    } finally {
      setPendingSwitch(null);
    }
  };

  const handleWithdraw = async (withdrawPct = 100) => {
    if (isSandbox) {
      setPendingSwitch("withdraw");
      const { withdrawnUsd } = withdrawVault(withdrawPct);
      setScannerEnabled(false);
      setState((current) => ({ ...current, killed: true, running: false }));
      push(
        "exec",
        `[SANDBOX WITHDRAW] ${withdrawPct}% · vault fiktif −$${withdrawnUsd.toFixed(2)} · tanpa tx on-chain`
      );
      setTxNotify({
        id: `sandbox-wd-${Date.now()}`,
        tone: "success",
        title: "Sandbox: tarik dana fiktif",
        message: `${withdrawPct}% vault virtual dipindahkan. Reset Sandbox untuk mengembalikan saldo awal.`,
      });
      setPendingSwitch(null);
      return;
    }
    if (!walletAddress) {
      const message = "Hubungkan dompet MetaMask terlebih dahulu.";
      push("error", `[WITHDRAW] ${message}`);
      setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Withdraw dibatalkan", message });
      return;
    }
    setPendingSwitch("withdraw");
    try {
      const res = await fetch("/api/bot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "withdraw-calldata",
          to: walletAddress,
          withdrawPct,
        }),
      });
      const json = (await res.json()) as { to?: string; data?: string; error?: string };
      if (json.error || !json.to || !json.data) {
        const message = json.error || "Konfigurasi kontrak belum lengkap.";
        push("error", `[WITHDRAW] ${message}`);
        setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Withdraw gagal", message });
        return;
      }
      setState((current) => ({ ...current, killed: true, running: false }));
      setScannerEnabled(false);
      await sendTx(json.to, json.data, `withdraw ${withdrawPct}%`);
      await refresh();
    } catch (err) {
      const message = formatWalletError(err);
      push("error", `[WITHDRAW] ${message}`);
      setTxNotify({ id: `err-${Date.now()}`, tone: "error", title: "Withdraw gagal", message });
    } finally {
      setPendingSwitch(null);
    }
  };

  const handleConfigChange = useCallback(
    (next: BotConfig) => {
      const merged = { ...configRef.current, ...next };
      configRef.current = merged;
      setConfig(merged);
      if (scanDebounce.current) clearTimeout(scanDebounce.current);
      scanDebounce.current = setTimeout(() => {
        void runScan();
      }, 400);
    },
    [runScan, setConfig]
  );

  useEffect(
    () => () => {
      if (scanDebounce.current) clearTimeout(scanDebounce.current);
    },
    []
  );

  const switchBusy = pendingSwitch !== null;
  const displayBlock = parseBlockNumber(blockNumber) || (isSandbox ? state.lastBlock || 42_000_000 : parseBlockNumber(state.lastBlock));
  const realizedWei = isSandbox ? sandboxRealizedWei : state.realizedProfitWei;
  const displayTrades = isSandbox ? sandboxTrades : state.trades;
  const todayProfitUsd = isSandbox
    ? stableWeiToUsd(sandboxRealizedWei)
    : sessionProfitUsd + stableWeiToUsd(state.realizedProfitWei);
  const healthFactor = state.killed ? 0 : 1.5;

  const handleResetSandbox = () => {
    resetSandbox();
    resetSession();
    setState((current) => ({
      ...emptyState(),
      config: current.config,
    }));
    push("warn", "[SANDBOX] State direset · vault fiktif $1,000,000.00 · profit Result $0.000.");
    window.setTimeout(() => void runScan({ silent: isFree }), 50);
  };

  const pnlAnalytics = (
    <PnLAnalyticsPanel
      realizedProfitWei={realizedWei}
      gasPriceWei={displayGasWei}
      lastBlock={displayBlock}
      trades={displayTrades}
      gasLimit={config.gasLimit}
      aaveFeePct={config.aaveFeePct}
      loanAmountUsd={config.loanAmountUsd}
      isSandbox={isSandbox}
      isPro={isPro}
      nativeSymbol={chain.nativeSymbol}
    />
  );

  return (
    <div className="space-y-5 w-full">
      {isSandbox ? (
        <SandboxModeBanner vaultUsd={vaultUsd} onReset={handleResetSandbox} />
      ) : null}

      {state.lastError && !isSandbox && (
        <p className="text-xs text-red-400 font-mono border border-red-500/30 rounded-xl px-4 py-2 bg-red-500/10">
          {state.lastError}
        </p>
      )}

      <DashboardTopControls
        config={config}
        onConfigChange={handleConfigChange}
        configBusy={scanPhase === "loading"}
        isPro={isPro}
        killed={state.killed}
        running={flashLoanArmed && (scannerEnabled || (isSandbox && isPro)) && !state.killed}
        switchBusy={switchBusy}
        pendingSwitch={pendingSwitch}
        todayProfitUsd={todayProfitUsd}
        healthFactor={healthFactor}
        sandbox={isSandbox}
        vaultUsd={vaultUsd}
        livePoolFeePct={livePoolFee?.feePct ?? null}
        livePairLabel={livePoolFee?.pairLabel ?? pair.label}
        onKill={() => void handleKill()}
        onWithdraw={(pct) => void handleWithdraw(pct)}
      />

      <div className="w-full">
        {isFree ? (
          <FreeModePanel
            opportunities={displayOpportunities}
            config={config}
            liveBlock={displayBlock}
            chainLabel={isSandbox ? `${activeNetwork.shortLabel} · Sandbox` : activeNetwork.shortLabel}
            selectedPair={pair}
            availablePairs={availablePairs}
            executingId={executingId}
            walletConnected={Boolean(walletAddress) || isSandbox}
            sandboxMode={isSandbox}
            terminalEntries={terminalEntries}
            analytics={pnlAnalytics}
            scanOnly={isScanOnly}
            scanOnlyReport={scanOnlyReport}
            scanOnlyBusy={scanPhase === "loading"}
            proScanMode={proScanMode}
            onProScanModeChange={setProScanMode}
            onSelectPair={setPairId}
            onExecute={(opp, nextConfig) => void handleExecute(opp, nextConfig)}
            onClearTerminal={clearTerminal}
          />
        ) : (
          <ProModePanel
            opportunities={displayOpportunities}
            scanPhase={scanPhase}
            simulatePhase={simulatePhase}
            simulateHint={simulateHint}
            liveBlock={displayBlock}
            scanPaceMs={tickMs}
            chainLabel={isSandbox ? `${activeNetwork.shortLabel} · Sandbox` : activeNetwork.shortLabel}
            selectedPair={pair}
            availablePairs={availablePairs}
            scannerEnabled={scannerEnabled}
            killed={state.killed}
            terminalEntries={terminalEntries}
            analytics={pnlAnalytics}
            minSpreadPct={config.minSpreadPct}
            proScanMode={proScanMode}
            onProScanModeChange={setProScanMode}
            onScannerChange={setScannerEnabled}
            onSelectPair={setPairId}
            onScan={() => void runScan()}
            onSimulate={() => void handleSimulate()}
            onClearTerminal={clearTerminal}
            sandboxMode={isSandbox}
            scanOnly={isScanOnly}
            scanOnlyReport={scanOnlyReport}
            scanOnlyBusy={scanPhase === "loading"}
          />
        )}
      </div>

      <TxNotifyToast notify={txNotify} onDismiss={() => setTxNotify(null)} />
      {showExtremeBanner && !isSandbox && (
        <ExtremeApproveBanner
          gwei={gasPriceToGwei(displayGasWei)}
          slowMax={config.slowMaxGasGwei ?? DEFAULT_GAS_STRATEGY.slowMaxGasGwei}
          extremeMax={config.extremeMaxGasGwei ?? DEFAULT_GAS_STRATEGY.extremeMaxGasGwei}
          onApprove={() => {
            setExtremeArmedUntil(Date.now() + DEFAULT_GAS_STRATEGY.extremeArmMs);
            setShowExtremeBanner(false);
            push(
              "warn",
              `[EXTREME] Perang gas disetujui ${DEFAULT_GAS_STRATEGY.extremeArmMs / 1000}s · cap ${config.extremeMaxGasGwei} gwei`
            );
          }}
          onDismiss={() => setShowExtremeBanner(false)}
        />
      )}
    </div>
  );
}
