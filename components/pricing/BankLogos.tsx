import type { TransferBankId } from "@/lib/pricing/checkout";

const BANK_LOGO_SRC: Record<TransferBankId, string> = {
  bca: "/images/banks/bca.jpg",
  mandiri: "/images/banks/mandiri.png",
  bni: "/images/banks/bni.jpg",
  bri: "/images/banks/bri.jpg",
};

const BANK_LOGO_BG: Record<TransferBankId, string> = {
  bca: "bg-white",
  mandiri: "bg-[#003D79]",
  bni: "bg-[#F36C21]",
  bri: "bg-[#1E6CB5]",
};

export default function BankLogo({ id }: { id: TransferBankId }) {
  return (
    <span
      className={`flex h-11 w-[4.75rem] shrink-0 items-center justify-center overflow-hidden rounded-lg ${BANK_LOGO_BG[id]}`}
    >
      <img
        src={BANK_LOGO_SRC[id]}
        alt=""
        className="h-full w-full object-contain object-center"
      />
    </span>
  );
}
