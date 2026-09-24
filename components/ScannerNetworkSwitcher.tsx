"use client";

import Image from "next/image";
import { SCANNER_CHAIN_LIST, isScannerChainId, type ScannerChainId } from "@/config/networks";
import { useNetwork } from "@/context/NetworkContext";
import { getChain } from "@/lib/chain/networks";

const TAB_LABEL: Record<ScannerChainId, string> = {
  optimism: "Optimism",
  avalanche: "Avalanche",
  solana: "Solana",
  base: "Base",
  bsc: "BNB Chain",
  fantom: "Fantom",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  ethereum: "Ethereum",
};

/** Tab scanner: ganti target data lokal saja — tidak memicu switch jaringan wallet. */
export default function ScannerNetworkSwitcher() {
  const { chainId, setChainId } = useNetwork();

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        Jaringan scanner
      </span>
      <div
        role="tablist"
        aria-label="Pilih jaringan scanner"
        className="inline-flex w-full max-w-full flex-nowrap overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80 p-0.5"
      >
        {SCANNER_CHAIN_LIST.map((network) => {
          const chain = getChain(network.id);
          const selected = chainId === network.id;
          return (
            <button
              key={network.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                if (isScannerChainId(network.id) && chainId !== network.id) {
                  setChainId(network.id);
                }
              }}
              className={`flex shrink-0 items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold font-mono whitespace-nowrap transition-colors cursor-pointer ${
                selected
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Image
                src={chain.logoUrl}
                alt=""
                width={14}
                height={14}
                className="rounded-full shrink-0"
                unoptimized
              />
              <span className={selected ? chain.accentClass : ""}>{TAB_LABEL[network.id]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
