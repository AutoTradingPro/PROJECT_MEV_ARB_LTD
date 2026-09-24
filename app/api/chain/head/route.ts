import type { ChainId } from "@/lib/chain/networks";
import { getBlockNumber, getGasPriceWei, rpcUrl } from "@/lib/bot/rpc";
import { patchBotState, readBotState } from "@/lib/bot/store";
import { getChain } from "@/lib/chain/networks";
import { normalizeTradingChainId } from "@/config/networks";
import { ScanRuntimeAbortError, strictScanChainId } from "@/lib/bot/scanRuntime";
import { isHttpRpcAllowed } from "@/lib/owner/chainQuota";
import { hydrateChainQuotaFromDisk } from "@/lib/owner/chainQuotaPersist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  await readBotState().catch(() => null);
  hydrateChainQuotaFromDisk();
  const scannerChain = strictScanChainId();
  const requested = searchParams.get("chain");
  const chainId = requested ? normalizeTradingChainId(requested) : scannerChain ?? normalizeTradingChainId(requested);
  const chain = getChain(chainId);

  if (!isHttpRpcAllowed(chainId)) {
    // Solana: tetap sediakan priority-fee fallback agar auto-exec tidak tertahan
    // hanya karena toggle HTTP/quota Overview sedang OFF.
    if (chainId === "solana") {
      const { SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } = await import(
        "@/lib/bot/solana/priorityFee"
      );
      const gasPriceWei = SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS.toString();
      return Response.json({
        block: 0,
        gasPriceWei,
        live: false,
        chainId,
        label: chain.shortLabel,
        skipped: "quota-off",
        feeUnit: "microLamports",
        feeSource: "fallback",
      });
    }
    return Response.json({
      block: 0,
      gasPriceWei: "0",
      live: false,
      chainId,
      label: chain.shortLabel,
      skipped: "quota-off",
    });
  }

  if (!chain.evm || !rpcUrl(chainId)) {
    if (chainId === "solana") {
      try {
        const { ensureSolanaLiveSlotMonitor } = await import("@/lib/bot/solana/liveSlot");
        const { resolveSolanaGasPriceWei, SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } = await import(
          "@/lib/bot/solana/priorityFee"
        );
        let gasPriceWei = SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS.toString();
        try {
          gasPriceWei = await resolveSolanaGasPriceWei();
        } catch {
          gasPriceWei = SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS.toString();
        }

        const live = await ensureSolanaLiveSlotMonitor().catch(() => null);
        if (!live?.rpcUrl) {
          return Response.json({
            block: 0,
            gasPriceWei,
            live: false,
            chainId,
            label: chain.shortLabel,
            skipped: "no-rpc",
            feeUnit: "microLamports",
            feeSource: "fallback",
          });
        }
        const slot = live.slot;
        if (slot > 0) {
          await patchBotState((current) => ({
            ...current,
            lastBlock: slot,
            gasPriceWei,
          }));
        } else if (gasPriceWei !== "0") {
          await patchBotState((current) => ({
            ...current,
            gasPriceWei,
          }));
        }
        return Response.json({
          block: slot,
          gasPriceWei,
          live: slot > 0,
          chainId,
          nativeSymbol: chain.nativeSymbol,
          label: chain.shortLabel,
          transport: live.transport,
          via: live.via,
          feeUnit: "microLamports",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "gagal membaca slot Solana";
        const { SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS } = await import(
          "@/lib/bot/solana/priorityFee"
        );
        return Response.json(
          {
            block: 0,
            gasPriceWei: SOLANA_DEFAULT_PRIORITY_FEE_MICROLAMPORTS.toString(),
            live: false,
            chainId,
            error: message,
            feeUnit: "microLamports",
            feeSource: "fallback",
          },
          { status: 502 }
        );
      }
    }
    return Response.json({
      block: 0,
      gasPriceWei: "0",
      live: false,
      chainId,
      label: chain.shortLabel,
    });
  }

  try {
    const [block, gasPriceWei] = await Promise.all([
      getBlockNumber(undefined, chainId),
      getGasPriceWei(undefined, chainId),
    ]);
    const state = await readBotState().catch(() => null);
    const fallbackBlock =
      block > 0
        ? block
        : scannerChain === chainId && state && state.lastBlock > 0
          ? state.lastBlock
          : 0;
    if (scannerChain === chainId && fallbackBlock > 0) {
      await patchBotState((current) => ({
        ...current,
        lastBlock: fallbackBlock,
        gasPriceWei: gasPriceWei > 0n ? gasPriceWei.toString() : current.gasPriceWei,
      }));
    }
    return Response.json({
      block: fallbackBlock,
      gasPriceWei: gasPriceWei.toString(),
      live: fallbackBlock > 0,
      chainId,
      nativeSymbol: chain.nativeSymbol,
      label: chain.shortLabel,
      stale: block <= 0 && fallbackBlock > 0,
    });
  } catch (error) {
    if (error instanceof ScanRuntimeAbortError) {
      return Response.json({
        block: 0,
        gasPriceWei: "0",
        live: false,
        chainId,
        skipped: "quota-off",
      });
    }
    const state = await readBotState().catch(() => null);
    const staleBlock =
      scannerChain === chainId && state && state.lastBlock > 0 ? state.lastBlock : 0;
    if (staleBlock > 0) {
      return Response.json({
        block: staleBlock,
        gasPriceWei: state?.gasPriceWei ?? "0",
        live: true,
        chainId,
        nativeSymbol: chain.nativeSymbol,
        label: chain.shortLabel,
        stale: true,
      });
    }
    const message = error instanceof Error ? error.message : "gagal membaca head chain";
    return Response.json(
      { block: 0, gasPriceWei: "0", live: false, chainId, error: message },
      { status: 502 }
    );
  }
}
