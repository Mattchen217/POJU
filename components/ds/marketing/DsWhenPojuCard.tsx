"use client";

import { Compass, GitBranch, RefreshCcw, Search, UserRoundSearch, type LucideIcon } from "lucide-react";

import { DsWhenProductCard } from "@/components/ds/marketing/DsWhenProductCard";

const POJU_WHEN_ICONS = {
  stuck: GitBranch,
  confused: Search,
  repeating: RefreshCcw,
  depth: UserRoundSearch,
  direction: Compass,
} as const satisfies Record<string, LucideIcon>;

export type PojuWhenIconKey = keyof typeof POJU_WHEN_ICONS;

export function DsWhenPojuCard({
  index,
  iconKey,
  title,
  description,
}: {
  index: number;
  iconKey: PojuWhenIconKey;
  title: string;
  description: string;
}) {
  const Icon = POJU_WHEN_ICONS[iconKey];

  return (
    <DsWhenProductCard
      theme="poju"
      index={index}
      icon={<Icon className="h-5 w-5" strokeWidth={2} aria-hidden />}
      title={title}
      description={description}
    />
  );
}
