/**
 * Live baseline second lens. Structural Ziwei lines beside the bazi portrait.
 * User-facing: soft labels only via ZiweiDisplayFactPack (Phase 2).
 * No narrative, no quotes, no traditional palace/star fallback.
 */

import {
  buildZiweiDisplayFactPack,
  displayAtomLabel,
  joinDisplayLabels,
  type ZiweiDisplayAtom,
  type ZiweiDisplayFactPack,
} from "@/lib/ziwei/display-fact-pack";
import type { ZiweiFactPack } from "@/lib/ziwei/fact-pack";

export type BaselineLensLine = {
  label: string;
  value: string;
};

function atomOrDash(atom: ZiweiDisplayAtom): string {
  return displayAtomLabel(atom) || "—";
}

/** Build lens lines from an already-projected display pack. */
export function baselineZiweiLensLinesFromDisplay(
  display: ZiweiDisplayFactPack,
): BaselineLensLine[] {
  const lines: BaselineLensLine[] = [];
  const topic = display.topicPalace;
  const palaceLabel = displayAtomLabel(topic.palace);
  if (palaceLabel) {
    const stars = joinDisplayLabels(topic.majorStars);
    lines.push({
      label: palaceLabel,
      value: stars || topic.earthlyBranch || "—",
    });
  }
  const oppField = displayAtomLabel(topic.oppositeFieldLabel);
  if (oppField) {
    const oppPalace = displayAtomLabel(topic.oppositePalace);
    const oppositeStars = joinDisplayLabels(topic.oppositeMajorStars);
    lines.push({
      label: oppPalace ? `${oppField} · ${oppPalace}` : oppField,
      value: oppositeStars || "—",
    });
  }

  const core = displayAtomLabel(display.mingShen.coreDriverLabel);
  const action = displayAtomLabel(display.mingShen.actionDriverLabel);
  if (core || action) {
    lines.push({
      label: [core, action].filter(Boolean).join(" / ") || "—",
      value: `${atomOrDash(display.mingShen.soul)} / ${atomOrDash(display.mingShen.body)}`,
    });
  }

  const actionDomain = displayAtomLabel(display.mingShen.actionDomainLabel);
  if (actionDomain) {
    lines.push({
      label: actionDomain,
      value: `${atomOrDash(display.mingShen.shenPalace)} · ${display.mingShen.shenBranch || "—"}`,
    });
  }

  const elemLabel = displayAtomLabel(display.mingShen.elementalConfigLabel);
  if (elemLabel) {
    lines.push({
      label: elemLabel,
      value: atomOrDash(display.mingShen.fiveElementsClass),
    });
  }

  const longCycle = displayAtomLabel(display.daxian.label);
  if (longCycle) {
    const stars = joinDisplayLabels(display.daxian.majorStars);
    const palace = atomOrDash(display.daxian.palace);
    lines.push({
      label: longCycle,
      value: `${palace} ${display.daxian.startAge}–${display.daxian.endAge}${stars ? ` · ${stars}` : ""}`,
    });
  }

  const sihuaLabel = displayAtomLabel(display.sihuaLabel);
  if (sihuaLabel && display.sihua.length) {
    const parts = display.sihua.map((hit) => {
      const m = displayAtomLabel(hit.mutagen);
      const s = displayAtomLabel(hit.star);
      const p = displayAtomLabel(hit.palace);
      return [m, s, p].filter(Boolean).join("·");
    }).filter(Boolean);
    if (parts.length) {
      lines.push({ label: sihuaLabel, value: parts.join("  ") });
    }
  }

  return lines.filter((l) => l.label.trim().length > 0);
}

/**
 * Palace, stars, soul/body, decadal, and natal sihua — soft labels only.
 * @param locale Term locale for soft labels (default zh).
 */
export function baselineZiweiLensLines(
  pack: Pick<ZiweiFactPack, "topicPalace" | "mingShen" | "daxian" | "sihua">,
  locale: string = "zh",
): BaselineLensLine[] {
  // Display adapter expects full pack fields used by projection; fill stubs for unused.
  const full = pack as ZiweiFactPack;
  const display = buildZiweiDisplayFactPack(
    {
      topicPalace: full.topicPalace,
      sihua: full.sihua ?? [],
      daxian: full.daxian,
      mingShen: full.mingShen,
      otherChart: null,
      patternHits: full.patternHits ?? [],
      palaces: full.palaces ?? [],
      source: full.source ?? {
        library: "iztro",
        version: "lens",
        license: "MIT",
        solarDate: "",
        timeIndex: 0,
        gender: "女",
        fixLeap: true,
        clock: "civil",
        asOf: "",
      },
    },
    locale,
  );
  return baselineZiweiLensLinesFromDisplay(display);
}
