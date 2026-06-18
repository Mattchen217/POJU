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
  /** Draw flip flow — same as compact, tuned for shorter viewport card. */
  draw?: boolean;
}

export function GlyphFront({ sign, animate = true, compact = false, draw = false }: GlyphFrontProps) {
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
  const faceSmall = compact || draw;
  const maxVerseLen = Math.max(...sign.verse_lines_en.map((line) => line.length), 1);
  const verseSizeClass = faceSmall
    ? maxVerseLen > 62
      ? "text-[0.74rem] leading-[1.28]"
      : maxVerseLen > 54
        ? "text-[0.78rem] leading-[1.3]"
        : "text-[0.82rem] leading-[1.32]"
    : maxVerseLen > 62
      ? "text-[1rem] md:text-[1.06rem]"
      : maxVerseLen > 54
        ? "text-[1.08rem] md:text-[1.14rem]"
        : "text-[1.16rem] md:text-[1.22rem]";

  const summaryLen = sign.summary_line_en.length;
  const summarySizeClass = faceSmall
    ? summaryLen > 130
      ? "text-[0.7rem] leading-[1.32]"
      : summaryLen > 100
        ? "text-[0.75rem] leading-[1.35]"
        : "text-[0.82rem] leading-[1.38]"
    : "text-[0.96rem] leading-[1.45] md:text-[1.02rem]";

  return (
    <motion.div
      className={`relative h-full w-full overflow-hidden rounded-[24px] ${draw ? "" : "aspect-[9/16]"}`}
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
        className={`relative z-20 flex h-full flex-col text-center ${
          draw ? "px-[8%] py-[7%]" : faceSmall ? "px-[10%] py-[10%]" : "px-[11%] py-[13%]"
        }`}
      >
        <motion.div
          className={faceSmall ? "shrink-0 pt-[1%]" : "pt-[7%]"}
          initial={animate ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2
            className={`font-verse mb-0.5 tracking-wide ${
              faceSmall ? "text-[1.2rem]" : "text-3xl md:text-4xl"
            }`}
            style={{ color: toneColor }}
          >
            {meta.display_name}
          </h2>

          <p
            className={`italic opacity-80 ${
              faceSmall ? "mb-1 text-[0.72rem]" : "mb-4 text-sm md:text-base"
            }`}
            style={{ color: toneColor }}
          >
            {meta.subtitle}
          </p>

          <div
            className={`tracking-[0.2em] text-white ${
              faceSmall
                ? "mb-0.5 text-[0.56rem] tracking-[0.14em]"
                : "text-[0.65rem] md:text-[0.72rem]"
            }`}
          >
            GLYPH No. {String(sign.sign_number).padStart(3, "0")}
          </div>
        </motion.div>

        <motion.div
          className={`mx-auto w-[88%] ${faceSmall ? "min-h-0 flex-1" : "-mt-2 h-[46%] overflow-hidden"}`}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div
            className={`font-verse flex h-full flex-col justify-center italic ${
              faceSmall ? "gap-0.5" : "gap-2"
            } ${verseSizeClass}`}
            style={{ color: toneColor }}
          >
            {sign.verse_lines_en.map((line, idx) => (
              <motion.p
                key={idx}
                className={faceSmall ? "leading-[1.28] text-center" : "leading-[1.45] text-justify"}
                style={
                  faceSmall
                    ? undefined
                    : {
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }
                }
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
          className={`relative z-30 shrink-0 ${
            draw ? "mt-0.5 px-1 pb-[7%] pt-0.5" : faceSmall ? "mt-1 px-1 pb-[9%] pt-1" : "mt-2 min-h-[16%] px-2"
          }`}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <p className={`italic text-[#E5E5E5] ${summarySizeClass}`}>
            &ldquo;{sign.summary_line_en}&rdquo;
          </p>
        </motion.div>
      </div>

      <p
        className={`absolute left-1/2 z-30 -translate-x-1/2 rounded-full tracking-[0.3em] ${
          faceSmall
            ? "bottom-[2.5%] px-2 py-0.5 text-[0.58rem]"
            : "bottom-[7%] px-3 py-1 text-xs"
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

