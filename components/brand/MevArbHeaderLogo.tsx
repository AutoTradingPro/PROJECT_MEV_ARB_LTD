import Image from "next/image";

const DEFAULT_CLASS =
  "h-11 w-auto max-h-12 max-w-[7.5rem] sm:max-w-[8.5rem] md:h-12 md:max-w-[9.5rem] shrink-0 rounded-md object-contain object-left";

/** Wordmark robot setengah badan + MEV-ARB. Favicon tetap ikon MA. */
export default function MevArbHeaderLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo-mevarb.png"
      alt="MEV-ARB Logo"
      width={607}
      height={411}
      className={className ?? DEFAULT_CLASS}
      priority
    />
  );
}
