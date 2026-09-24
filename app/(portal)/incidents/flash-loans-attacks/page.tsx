import type { Metadata } from "next";
import FlashLoansAttacksIndexPage from "@/components/incidents/FlashLoansAttacksIndexPage";

export const metadata: Metadata = {
  title: "View all Flash Loan hacks | Studi Insiden",
  description:
    "Katalog insiden flash loan nyata untuk pembelajaran keamanan: Euler, Beanstalk, Cream, Rari, dan catatan kelas serangan.",
};

export default function Page() {
  return <FlashLoansAttacksIndexPage />;
}
