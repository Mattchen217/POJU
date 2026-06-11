"use client";

import { Shuffle, Sunrise, Wind, Zap, type LucideIcon } from "lucide-react";

import { DsWhenProductCard } from "@/components/ds/marketing/DsWhenProductCard";

const GLYPH_WHEN_ICONS = {
  quick_read: Zap,
  circling: Wind,
  fresh_angle: Shuffle,
  new_start: Sunrise,
} as const satisfies Record<string, LucideIcon>;

export type GlyphWhenIconKey = keyof typeof GLYPH_WHEN_ICONS;

export function DsWhenGlyphCard({
  index,
  iconKey,
  title,
  description,
}: {
  index: number;
  iconKey: GlyphWhenIconKey;
  title: string;
  description: string;
}) {
  const Icon = GLYPH_WHEN_ICONS[iconKey];

  return (
    <DsWhenProductCard
      theme="glyph"
      index={index}
      icon={<Icon className="h-5 w-5" strokeWidth={2} aria-hidden />}
      title={title}
      description={description}
    />
  );
}
