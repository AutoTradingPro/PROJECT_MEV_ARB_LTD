import type { Metadata } from "next";
import BeanstalkHackPage from "@/components/incidents/BeanstalkHackPage";

export const metadata: Metadata = {
  title: "Beanstalk Hack 2022 | Studi Insiden",
  description:
    "Studi kasus Beanstalk (April 2022): eksploitasi tata kelola DAO dengan hak suara dari likuiditas kilat.",
};

export default function Page() {
  return <BeanstalkHackPage />;
}
