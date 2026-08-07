import type { FiveElement } from "@/lib/calculations/types";
import { elementTokenToWuXing } from "@/lib/syncro/build-syncro-bazi-context";
import type { WuXing } from "@/lib/syncro/wuxing-utils";

const WUXING_TO_FIVE: Record<WuXing, FiveElement> = {
  木: "wood",
  火: "fire",
  土: "earth",
  金: "metal",
  水: "water",
};

const FIVE_TO_WUXING: Record<FiveElement, WuXing> = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

export function toFiveElement(token: string | null | undefined): FiveElement | null {
  if (!token?.trim()) return null;
  const wx = elementTokenToWuXing(token);
  return wx ? WUXING_TO_FIVE[wx] : null;
}

export function fiveElementToWuXing(el: FiveElement): WuXing {
  return FIVE_TO_WUXING[el];
}

export function wuXingToFiveElement(wx: WuXing): FiveElement {
  return WUXING_TO_FIVE[wx];
}
