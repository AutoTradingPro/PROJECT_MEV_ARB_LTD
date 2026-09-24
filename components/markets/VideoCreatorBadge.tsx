import Image from "next/image";

export default function VideoCreatorBadge() {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
      <div
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 sm:gap-2.5 sm:pr-3"
        style={{
          border: "1.5px solid transparent",
          background:
            "linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0)) padding-box, linear-gradient(90deg, #22d3ee, #e879f9, #ec4899) border-box",
        }}
      >
        <Image
          src="/images/my-profile.jpg"
          alt=""
          width={36}
          height={36}
          className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9"
        />
        <p className="whitespace-nowrap text-[11px] leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-[13px]">
          <span className="text-white">Created By : </span>
          <span className="font-bold text-cyan-300">Moch Engineer</span>
        </p>
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-400"
          aria-hidden
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-[#0a1020]" strokeWidth="2.2">
            <path d="M2.2 6.2 4.7 8.6 9.8 3.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}
