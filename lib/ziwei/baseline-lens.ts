/**
 * Live baseline second lens. Structural Ziwei lines beside the bazi portrait.
 * No narrative, no quotes. The offline pack does not call this.
 */

import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

export type BaselineLensLine = {
  label: string;
  value: string;
};

function joinStars(stars: readonly string[] | undefined): string {
  return (stars ?? []).map((star) => star.trim()).filter(Boolean).join("、");
}

/** Palace, stars, soul/body, decadal, and natal sihua. Nothing else. */
export function baselineZiweiLensLines(
  pack: Pick<ZiweiFactPack, "topicPalace" | "mingShen" | "daxian" | "sihua">,
): BaselineLensLine[] {
  const lines: BaselineLensLine[] = [];
  const topic = pack.topicPalace;
  if (topic?.palace) {
    const stars = joinStars(topic.majorStars);
    lines.push({ label: topic.palace, value: stars || topic.earthlyBranch });
    if (topic.oppositePalace) {
      const oppositeStars = joinStars(topic.oppositeMajorStars);
      lines.push({
        label: `对宫 ${topic.oppositePalace}`,
        value: oppositeStars || topic.oppositePalace,
      });
    }
  }
  const ming = pack.mingShen;
  if (ming?.soul || ming?.body) {
    lines.push({ label: "命主 / 身主", value: `${ming.soul} / ${ming.body}` });
  }
  if (ming?.shenPalace) {
    lines.push({ label: "身宫", value: `${ming.shenPalace} · ${ming.shenBranch}` });
  }
  if (ming?.fiveElementsClass) {
    lines.push({ label: "五行局", value: ming.fiveElementsClass });
  }
  const limit = pack.daxian;
  if (limit?.palace) {
    const stars = joinStars(limit.majorStars);
    lines.push({
      label: "大限",
      value: `${limit.palace} ${limit.startAge}–${limit.endAge}${stars ? ` · ${stars}` : ""}`,
    });
  }
  if (pack.sihua?.length) {
    lines.push({
      label: "四化",
      value: pack.sihua.map((hit) => `${hit.mutagen}${hit.star}·${hit.palace}`).join("  "),
    });
  }
  return lines;
}
