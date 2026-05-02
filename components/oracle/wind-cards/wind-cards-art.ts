import type { StaticImageData } from "next/image";
import crosswind from "@/assets/images/crosswind.png";
import divineTailwind from "@/assets/images/divine tailwind.png";
import eyeOfStorm from "@/assets/images/eye of storm.png";
import fairSky from "@/assets/images/fair sky.png";
import stillWater from "@/assets/images/still water.png";

/** 顺序：Crosswind → Divine Tailwind → Eye of Storm → Fair Sky → Still Water */
export const WIND_CARDS_IN_ORDER: { key: string; src: StaticImageData; alt: string }[] = [
  { key: "crosswind", src: crosswind, alt: "Crosswind" },
  { key: "divine-tailwind", src: divineTailwind, alt: "Divine Tailwind" },
  { key: "eye-of-storm", src: eyeOfStorm, alt: "Eye of Storm" },
  { key: "fair-sky", src: fairSky, alt: "Fair Sky" },
  { key: "still-water", src: stillWater, alt: "Still Water" },
];
