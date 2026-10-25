import { STEM_TO_WUXING, type WuXing } from "@/lib/calendar/wuxing-utils";

const ELEMENT_TO_WUXING: Record<string, WuXing> = {
  木: "木",
  火: "火",
  土: "土",
  金: "金",
  水: "水",
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};

export function elementTokenToWuXing(token: string): WuXing | undefined {
  const trimmed = token.trim();
  if (STEM_TO_WUXING[trimmed]) return STEM_TO_WUXING[trimmed];
  const lower = trimmed.toLowerCase();
  if (ELEMENT_TO_WUXING[lower]) return ELEMENT_TO_WUXING[lower];
  if (ELEMENT_TO_WUXING[trimmed]) return ELEMENT_TO_WUXING[trimmed];
  return undefined;
}

export function elementsToWuXingList(tokens?: string[]): WuXing[] {
  if (!tokens?.length) return [];
  const out: WuXing[] = [];
  for (const token of tokens) {
    const wx = elementTokenToWuXing(token);
    if (wx && !out.includes(wx)) out.push(wx);
  }
  return out;
}
