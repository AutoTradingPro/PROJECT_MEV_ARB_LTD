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
  monad: "Monad",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  ethereum: "Ethereum",
  linea: "Linea",
};

const TOP_ROW = SCANNER_CHAIN_LIST.slice(0, 5);
const BOTTOM_ROW = SCANNER_CHAIN_LIST.slice(5);

function NetworkTab({
  id,
  selected,
  onSelect,
}: {
  id: ScannerChainId;
  selected: boolean;
  onSelect: (id: ScannerChainId) => void;
}) {
  const chain = getChain(id);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => onSelect(id)}
      className={`flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-[10px] border px-2 text-sm font-semibold text-slate-200 transition-[background-color,border-color] duration-150 cursor-pointer ${
        selected
          ? "border-slate-200/80 bg-slate-800"
          : "border-slate-700/70 bg-[#0b1220] hover:border-slate-300/70 hover:bg-[#162033]"
      }`}
    >
      <Image
        src={chain.logoUrl}
        alt=""
        width={16}
        height={16}
        className="h-4 w-4 shrink-0 rounded-full"
        unoptimized
      />
      <span className="min-w-0 truncate">{TAB_LABEL[id]}</span>
    </button>
  );
}

/** Tab scanner: ganti target data lokal saja — tidak memicu switch jaringan wallet. */
export default function ScannerNetworkSwitcher() {
  const { chainId, setChainId } = useNetwork();

  const select = (id: ScannerChainId) => {
    if (isScannerChainId(id) && chainId !== id) setChainId(id);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        Jaringan scanner
      </span>
      <div
        role="tablist"
        aria-label="Pilih jaringan scanner"
        className="flex w-full flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-2"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {TOP_ROW.map((network) => (
            <NetworkTab
              key={network.id}
              id={network.id}
              selected={chainId === network.id}
              onSelect={select}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {BOTTOM_ROW.map((network) => (
            <NetworkTab
              key={network.id}
              id={network.id}
              selected={chainId === network.id}
              onSelect={select}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
