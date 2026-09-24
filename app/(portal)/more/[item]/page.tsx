import { notFound } from "next/navigation";
import DevelopingPlaceholder from "@/components/layout/DevelopingPlaceholder";
import {
  isMoreMenuSlug,
  moreItemLabel,
  MORE_MENU_SLUGS,
} from "@/lib/navigation/moreMenu";

interface MoreItemPageProps {
  params: Promise<{ item: string }>;
}

export function generateStaticParams() {
  return MORE_MENU_SLUGS.map((slug) => ({ item: slug }));
}

export default async function MoreItemPage({ params }: MoreItemPageProps) {
  const { item } = await params;
  if (!isMoreMenuSlug(item)) notFound();

  return (
    <DevelopingPlaceholder menuLabel="Pricing" subLabel={moreItemLabel(item)} />
  );
}
