import type { Metadata } from "next";
import RariCapitalHackPage from "@/components/incidents/RariCapitalHackPage";

export const metadata: Metadata = {
  title: "Rari Capital Hack 2022 | Studi Insiden",
  description:
    "Studi kasus Rari Capital (April 2022): reentrancy Fuse/Fei dengan flash loan, kerugian sekitar $80 juta.",
};

export default function Page() {
  return <RariCapitalHackPage />;
}
