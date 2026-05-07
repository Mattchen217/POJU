"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import crosswindFront from "@/assets/images/crosswind front.png";
import divineTailwindFront from "@/assets/images/divine tailwind front.png";
import eyeOfStormFront from "@/assets/images/eye of storm front.png";
import fairSkyFront from "@/assets/images/fair sky front.png";
import stillWaterFront from "@/assets/images/still water front.png";
import {
  WindBorderParticlesOverlay,
  type WindCardParticleKey,
} from "@/components/oracle/wind-cards";
import { LEVEL_META, type SignData } from "@/types/oracle";

interface GlyphFrontProps {
  sign: SignData;
  animate?: boolean;
  compact?: boolean;
}

export function GlyphFront({ sign, animate = true, compact = false }: GlyphFrontProps) {
  const meta = LEVEL_META[sign.level];
  const frontByLevel = {
    divine_tailwind: divineTailwindFront,
    fair_sky: fairSkyFront,
    still_water: stillWaterFront,
    crosswind: crosswindFront,
    eye_of_storm: eyeOfStormFront,
  } satisfies Record<SignData["level"], typeof divineTailwindFront>;

  const particleKeyByLevel: Record<SignData["level"], WindCardParticleKey> = {
    divine_tailwind: "divine-tailwind",
    fair_sky: "fair-sky",
    still_water: "still-water",
    crosswind: "crosswind",
    eye_of_storm: "eye-of-storm",
  };

  const topTextColorByLevel: Record<SignData["level"], string> = {
    divine_tailwind: "#FFD278",
    fair_sky: "#73B9FF",
    still_water: "#46D29B",
    crosswind: "#C882FF",
    eye_of_storm: "#FF556E",
  };
  const toneColor = topTextColorByLevel[sign.level];
  const maxVerseLen = Math.max(...sign.verse_lines_en.map((line) => line.length), 1);
  const verseSizeClass =
    maxVerseLen > 62
      ? "text-[1rem] md:text-[1.06rem]"
      : maxVerseLen > 54
        ? "text-[1.08rem] md:text-[1.14rem]"
        : "text-[1.16rem] md:text-[1.22rem]";

  return (
    <motion.div
      className="relative aspect-[9/16] w-full overflow-hidden rounded-[24px]"
      initial={animate ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.5,
        ease: "easeOut",
      }}
    >
      <Image
        src={frontByLevel[sign.level]}
        alt={`${meta.display_name} card front`}
        fill
        sizes="(max-width: 768px) 100vw, 400px"
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/28" />
      <WindBorderParticlesOverlay particleKey={particleKeyByLevel[sign.level]} />

      <div
        className="relative z-20 flex h-full flex-col px-[11%] py-[13%] text-center"
        style={
          compact
            ? {
                transform: "scale(0.84)",
                transformOrigin: "top center",
              }
            : undefined
        }
      >
        <motion.div
          className="pt-[7%]"
          initial={animate ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2 className="font-verse mb-1 text-3xl tracking-wide md:text-4xl" style={{ color: toneColor }}>
            {meta.display_name}
          </h2>

          <p className="mb-4 text-sm italic opacity-70 md:text-base" style={{ color: toneColor }}>
            {meta.subtitle}
          </p>

          <div
            className={`text-[0.65rem] tracking-[0.2em] text-white md:text-[0.72rem] ${compact ? "mt-1 mb-4" : ""}`}
          >
            GLYPH No. {String(sign.sign_number).padStart(3, "0")}
          </div>
        </motion.div>

        <motion.div
          className={`mx-auto h-[46%] w-[88%] overflow-hidden ${compact ? "mt-1" : "-mt-2"}`}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div
            className={`font-verse flex h-full flex-col justify-center gap-2 italic ${verseSizeClass}`}
            style={{ color: toneColor }}
          >
            {sign.verse_lines_en.map((line, idx) => (
              <motion.p
                key={idx}
                className="leading-[1.45] text-justify"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
                initial={animate ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.4,
                  delay: 0.7 + idx * 0.1,
                }}
              >
                {line}
              </motion.p>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="mt-2 min-h-[16%] px-2"
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <p className="text-[0.96rem] italic leading-[1.45] text-[#E5E5E5] md:text-[1.02rem]">
            &ldquo;{sign.summary_line_en}&rdquo;
          </p>
        </motion.div>
      </div>

      <p
        className={`absolute left-1/2 z-30 -translate-x-1/2 rounded-full px-3 py-1 text-xs tracking-[0.3em] ${
          compact ? "bottom-[3.8%]" : "bottom-[7%]"
        }`}
        style={{
          color: toneColor,
          background: "rgba(0,0,0,0.72)",
        }}
      >
        pojulife.com
      </p>
    </motion.div>
  );
}

