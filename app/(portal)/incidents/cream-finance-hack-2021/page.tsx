import type { Metadata } from "next";
import CreamFinanceHackPage from "@/components/incidents/CreamFinanceHackPage";

export const metadata: Metadata = {
  title: "Cream Finance Hack 2021 | Studi Insiden",
  description:
    "Studi kasus Cream Finance (Oktober 2021): manipulasi oracle pricePerShare yUSD dengan flash liquidity.",
};

export default function Page() {
  return <CreamFinanceHackPage />;
}
