"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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
  /** Draw flip flow — fills parent height (see glyph-draw-sequence.css). */
  draw?: boolean;
}

export function GlyphFront({ sign, animate = true, compact = false, draw = false }: GlyphFrontProps) {
  const [mobileViewport, setMobileViewport] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setMobileViewport(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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

  /** Delivery thumbnail — always small type. Draw uses mobile-small / desktop-medium. */
  const deliveryCompact = compact && !draw;
  const drawDesktop = draw && !mobileViewport;
  const faceSmall = deliveryCompact || (draw && mobileViewport);
  const deliveryDesktop = deliveryCompact && !mobileViewport;
  const stackedFooter = draw || deliveryCompact;

  const gridShellClass = draw
    ? "relative z-20 grid h-full grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-y-1.5 px-[8%] py-[5.5%] text-center md:gap-y-2 md:py-[6%]"
    : deliveryCompact
      ? deliveryDesktop
        ? "relative z-20 grid h-full grid-rows-[auto_auto_auto_auto] content-start gap-y-0.5 px-[9%] pb-[4.5%] pt-[6.5%] text-center"
        : "relative z-20 grid h-full grid-rows-[auto_auto_auto_auto] content-start gap-y-1 px-[9%] pb-[5%] pt-[7%] text-center"
      : "relative z-20 flex h-full flex-col text-center px-[11%] py-[13%]";

  const verseShellClass = draw
    ? "mx-auto flex min-h-0 w-[88%] flex-col justify-center overflow-hidden"
    : deliveryCompact
      ? "mx-auto w-[88%] -mt-0.5 flex flex-col justify-start"
      : "mx-auto -mt-2 h-[46%] w-[88%] overflow-hidden";

  const maxVerseLen = Math.max(...sign.verse_lines_en.map((line) => line.length), 1);
  const verseSizeClass = drawDesktop
    ? maxVerseLen > 62
      ? "text-[0.8rem] leading-[1.32]"
      : maxVerseLen > 54
        ? "text-[0.84rem] leading-[1.34]"
        : "text-[0.88rem] leading-[1.36]"
    : faceSmall
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
  const summarySizeClass = drawDesktop
    ? summaryLen > 130
      ? "text-[0.68rem] leading-[1.34]"
      : summaryLen > 100
        ? "text-[0.72rem] leading-[1.36]"
        : "text-[0.76rem] leading-[1.38]"
    : faceSmall
      ? summaryLen > 130
        ? "text-[0.7rem] leading-[1.32]"
        : summaryLen > 100
          ? "text-[0.75rem] leading-[1.35]"
          : "text-[0.82rem] leading-[1.38]"
      : "text-[0.96rem] leading-[1.45] md:text-[1.02rem]";

  const titleClass = drawDesktop
    ? "text-[1.45rem]"
    : faceSmall
      ? "text-[1.2rem]"
      : "text-3xl md:text-4xl";

  const subtitleClass = drawDesktop
    ? "mb-1.5 text-[0.78rem]"
    : faceSmall
      ? "mb-1 text-[0.72rem]"
      : "mb-4 text-sm md:text-base";

  const numberClass = drawDesktop
    ? "mb-0.5 text-[0.56rem] tracking-[0.16em]"
    : faceSmall
      ? "mb-0.5 text-[0.56rem] tracking-[0.14em]"
      : "text-[0.65rem] md:text-[0.72rem]";

  const brandClass = drawDesktop
    ? "mt-1.5 px-2.5 py-0.5 text-[0.56rem] tracking-[0.26em]"
    : deliveryDesktop
      ? "mt-0.5 px-2 py-0.5 text-[0.52rem] tracking-[0.2em]"
      : faceSmall
        ? "mt-1 px-2 py-0.5 text-[0.54rem] tracking-[0.22em]"
        : "";

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

      <div className={gridShellClass}>
        <motion.div
          className={faceSmall || draw ? "shrink-0 pt-[1%]" : "pt-[7%]"}
          initial={animate ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <h2
            className={`font-verse mb-0.5 tracking-wide ${titleClass}`}
            style={{ color: toneColor }}
          >
            {meta.display_name}
          </h2>

          <p className={`italic opacity-80 ${subtitleClass}`} style={{ color: toneColor }}>
            {meta.subtitle}
          </p>

          <div className={`tracking-[0.2em] text-white ${numberClass}`}>
            GLYPH No. {String(sign.sign_number).padStart(3, "0")}
          </div>
        </motion.div>

        <motion.div
          className={verseShellClass}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div
            className={`font-verse flex flex-col italic ${verseSizeClass} ${
              deliveryCompact
                ? "justify-start gap-0.5"
                : `h-full justify-center ${faceSmall || drawDesktop ? "gap-0.5" : "gap-2"}`
            }`}
            style={{ color: toneColor }}
          >
            {sign.verse_lines_en.map((line, idx) => (
              <motion.p
                key={idx}
                className={
                  faceSmall || draw
                    ? "text-center leading-[1.28]"
                    : "text-justify leading-[1.45]"
                }
                style={
                  faceSmall || draw
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
            stackedFooter
              ? deliveryDesktop
                ? "-mt-0.5 px-1"
                : "px-1 pt-0.5"
              : "mt-2 min-h-[16%] px-2"
          }`}
          initial={animate ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.2 }}
        >
          <p className={`italic text-[#E5E5E5] ${summarySizeClass}`}>
            &ldquo;{sign.summary_line_en}&rdquo;
          </p>
        </motion.div>

        {stackedFooter ? (
          <p
            className={`relative z-30 shrink-0 rounded-full ${brandClass}`}
            style={{
              color: toneColor,
              background: "rgba(0,0,0,0.72)",
            }}
          >
            pojulife.com
          </p>
        ) : null}
      </div>

      {!stackedFooter ? (
        <p
          className="absolute bottom-[7%] left-1/2 z-30 -translate-x-1/2 rounded-full px-3 py-1 text-xs tracking-[0.3em]"
          style={{
            color: toneColor,
            background: "rgba(0,0,0,0.72)",
          }}
        >
          pojulife.com
        </p>
      ) : null}
    </motion.div>
  );
}
