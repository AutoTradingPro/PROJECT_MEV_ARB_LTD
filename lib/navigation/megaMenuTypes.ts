import type { LucideIcon } from "lucide-react";

export interface MegaMenuItemDef {
  slug: string;
  label: string;
  iconBg: string;
  icon?: LucideIcon;
  /** Short glyph rendered inside the circle when no Lucide icon is used */
  iconText?: string;
  /** Optional pill badge shown beside the label (e.g. "New") */
  badge?: string;
}

export interface MegaMenuSectionDef {
  title: string;
  items: MegaMenuItemDef[];
}

export interface MegaMenuColumnDef {
  sections: MegaMenuSectionDef[];
}

export function flattenColumnSlugs(columns: MegaMenuColumnDef[]): string[] {
  return columns.flatMap((col) =>
    col.sections.flatMap((section) => section.items.map((item) => item.slug))
  );
}

export function findItemLabel(columns: MegaMenuColumnDef[], slug: string): string | undefined {
  for (const col of columns) {
    for (const section of col.sections) {
      const found = section.items.find((item) => item.slug === slug);
      if (found) return found.label;
    }
  }
  return undefined;
}

export function findListItemLabel(items: MegaMenuItemDef[], slug: string): string | undefined {
  return items.find((item) => item.slug === slug)?.label;
}

export function flattenListSlugs(items: MegaMenuItemDef[]): string[] {
  return items.map((item) => item.slug);
}

export function flattenSectionSlugs(sections: MegaMenuSectionDef[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.slug));
}

export function findSectionGroupLabel(
  sections: MegaMenuSectionDef[],
  slug: string
): string | undefined {
  for (const section of sections) {
    const found = section.items.find((item) => item.slug === slug);
    if (found) return found.label;
  }
  return undefined;
}
