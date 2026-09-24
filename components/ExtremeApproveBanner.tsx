"use client";

import { ShieldAlert } from "lucide-react";

interface ExtremeApproveBannerProps {
  gwei: number;
  slowMax: number;
  extremeMax: number;
  onApprove: () => void;
  onDismiss: () => void;
}

export default function ExtremeApproveBanner({
  gwei,
  slowMax,
  extremeMax,
  onApprove,
  onDismiss,
}: ExtremeApproveBannerProps) {
  return (
    <div
      role="alertdialog"
      className="fixed bottom-5 left-4 z-50 max-w-md w-[calc(100%-2rem)] sm:w-[28rem] rounded-xl border border-red-500/40 bg-red-950/95 text-red-50 shadow-2xl px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 shrink-0 text-red-300 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide">Approval Mode Extreme</p>
          <p className="text-[11px] font-mono mt-1 leading-relaxed opacity-90">
            Gas {gwei.toFixed(2)} gwei di atas batas Slow {slowMax} gwei (cap Extreme {extremeMax}{" "}
            gwei). Setujui perang gas atau bot menahan transaksi untuk mencegah kerugian revert.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-red-400 cursor-pointer"
            >
              Setujui Extreme 90s
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-red-400/40 px-3 py-1.5 text-[11px] font-semibold hover:bg-white/5 cursor-pointer"
            >
              Tahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
