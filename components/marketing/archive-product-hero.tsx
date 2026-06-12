import { Ban, Lock, TriangleAlert, type LucideIcon } from "lucide-react";

import { DsGradientTitle } from "@/components/ds/primitives";
import {
  ProductHeroContent,
  ProductMarketingHero,
} from "@/components/marketing/product-marketing-hero";

export type ArchiveHeroPointIcon = "lock" | "alert" | "erase";

export type ArchiveHeroPoint = {
  icon: ArchiveHeroPointIcon;
  text: string;
};

export type ArchiveProductHeroCopy = {
  title: string;
  intro: string;
  points: readonly ArchiveHeroPoint[];
};

const HERO_POINT_ICONS: Record<ArchiveHeroPointIcon, LucideIcon> = {
  lock: Lock,
  alert: TriangleAlert,
  erase: Ban,
};

/** DS archive hero — local vault privacy notice */
export function ArchiveProductHero({ copy }: { copy: ArchiveProductHeroCopy }) {
  return (
    <ProductMarketingHero theme="archive">
      <ProductHeroContent alignMd="left" className="mx-auto">
        <DsGradientTitle from="#c4b5fd" to="#a78bfa">
          {copy.title}
        </DsGradientTitle>
        <p className="archive-hero__intro">{copy.intro}</p>
        <ul className="archive-hero__points">
          {copy.points.map((point) => {
            const Icon = HERO_POINT_ICONS[point.icon];
            return (
              <li key={point.text} className="archive-hero__point">
                <span className="archive-hero__icon" aria-hidden>
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span>{point.text}</span>
              </li>
            );
          })}
        </ul>
      </ProductHeroContent>
    </ProductMarketingHero>
  );
}
