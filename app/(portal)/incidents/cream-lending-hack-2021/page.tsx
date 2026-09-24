import type { Metadata } from "next";
import CreamLandingHackPage from "@/components/incidents/CreamLandingHackPage";

export const metadata: Metadata = {
  title: "Cream Landing (CREAM Lending) Hack 2021 | Studi Insiden",
  description:
    "Studi kasus CREAM Lending (Oktober 2021): oracle yUSD, supply rekursif, dan pengurasan pasar v1.",
};

export default function Page() {
  return <CreamLandingHackPage />;
}
