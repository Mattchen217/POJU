"use client";

import { motion } from "framer-motion";
import crosswind from "@/assets/images/crosswind.png";
import divineTailwind from "@/assets/images/divine tailwind.png";
import eyeOfStorm from "@/assets/images/eye of storm.png";
import fairSky from "@/assets/images/fair sky.png";
import stillWater from "@/assets/images/still water.png";
import {
  WindCardWithParticles,
  type WindCardParticleKey,
} from "@/components/oracle/wind-cards";
import { LEVEL_META, type GlyphLevel } from "@/types/oracle";

interface GlyphBackImageProps {
  level: GlyphLevel;
  animate?: boolean;
  /** Fill parent flip cell (draw flow) instead of fixed 9:16 box. */
  fill?: boolean;
  onAnimationComplete?: () => void;
}

export function GlyphBackImage({
  level,
  animate = true,
  fill = false,
  onAnimationComplete,
}: GlyphBackImageProps) {
  const meta = LEVEL_META[level];
  const sourceByLevel: Record<
    GlyphLevel,
    { src: typeof divineTailwind; particleKey: WindCardParticleKey }
  > = {
    divine_tailwind: { src: divineTailwind, particleKey: "divine-tailwind" },
    fair_sky: { src: fairSky, particleKey: "fair-sky" },
    still_water: { src: stillWater, particleKey: "still-water" },
    crosswind: { src: crosswind, particleKey: "crosswind" },
    eye_of_storm: { src: eyeOfStorm, particleKey: "eye-of-storm" },
  };
  const source = sourceByLevel[level];

  return (
    <motion.div
      className={`relative w-full overflow-hidden rounded-[24px] ${fill ? "h-full" : "aspect-[9/16]"}`}
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.55,
        ease: "easeOut",
      }}
      onAnimationComplete={onAnimationComplete}
    >
      <WindCardWithParticles
        src={source.src}
        alt={`${meta.display_name} card back`}
        particleKey={source.particleKey}
        sizes="(max-width: 768px) 100vw, 400px"
        priority
        className="block h-full w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover"
      />
    </motion.div>
  );
}
