"use client";

import VideoCreatorBadge from "@/components/markets/VideoCreatorBadge";

export default function FlashLoanAttacksVideo() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 pb-12 pt-0">
      <div className="theme-panel overflow-hidden rounded-2xl border border-slate-800/80">
        <div className="px-5 pb-4 pt-6 sm:px-8 md:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/90">
            Video edukasi
          </p>
          <h2 className="mt-2 text-lg font-black tracking-tight text-[var(--app-fg)] sm:text-xl">
            Flash Loan Attacks &amp; Keamanan DeFi
          </h2>
        </div>
        <div className="px-5 pb-6 sm:px-8 md:px-12">
          <div className="relative overflow-hidden rounded-xl border border-slate-800/70 bg-black shadow-[0_0_48px_rgba(56,189,248,0.08)]">
            <video
              className="aspect-video w-full bg-black object-contain"
              controls
              playsInline
              preload="metadata"
            >
              <source src="/videos/Flashloan_attact.mp4" type="video/mp4" />
              Browser ini tidak mendukung pemutaran video.
            </video>

            <VideoCreatorBadge />

            <div
              className="pointer-events-none absolute bottom-10 right-0 z-[9] h-28 w-[46%] bg-[#0b1824] sm:bottom-11 sm:h-32 sm:w-[40%]"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}
