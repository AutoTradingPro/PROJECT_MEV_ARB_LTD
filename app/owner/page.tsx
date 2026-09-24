import { redirect } from "next/navigation";
import { OWNER_DEFAULT_HREF } from "@/lib/owner/nav";

export default function OwnerIndexPage() {
  redirect(OWNER_DEFAULT_HREF);
}
