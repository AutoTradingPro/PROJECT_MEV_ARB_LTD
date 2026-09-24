import Image from "next/image";

/** Ikon kepala robot MA — Owner Console. Favicon memakai aset yang sama. */
export default function MevArbLogo() {
  return (
    <Image
      src="/images/icon-mevarb.png"
      alt="MEV-ARB Logo"
      width={505}
      height={494}
      className="h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 shrink-0 rounded-lg object-contain"
      priority
    />
  );
}
