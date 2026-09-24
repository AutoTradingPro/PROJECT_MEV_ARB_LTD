import type { Metadata } from "next";
import EulerFinanceHackPage from "@/components/incidents/EulerFinanceHackPage";

export const metadata: Metadata = {
  title: "Euler Finance Hack 2023 | Studi Insiden",
  description:
    "Studi kasus Euler Finance (Maret 2023): eksploitasi lending dengan flash liquidity, donateToReserves, dan self-liquidation.",
};

export default function Page() {
  return <EulerFinanceHackPage />;
}
