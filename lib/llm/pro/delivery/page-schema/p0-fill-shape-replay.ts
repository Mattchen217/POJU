/**
 * Replay the two raw-fill shapes that failed §3.5:
 * 02 why_cards with empty chart_anchors, and 06 toolkit as a string
 * with angles on the page root. Uses this chart's page slice only.
 */
import { sanitizePageJson } from "@/lib/llm/pro/delivery/page-schema/sanitize";
import {
  chartFactPackFromText,
  pageSliceAnchorLines,
} from "@/lib/llm/pro/delivery/slice-for-page";

const ESSENCE =
  "这一层只说明眼前的阻力从本页短锚来，不写下一步清单。删掉这些短锚之后，这句话不该对谁都成立，因为它只对着这一页已经裁好的短事实。";

function whyCard(index: number) {
  return {
    title: `结构${index}`,
    surface: "眼前的阻力停在同一层结构上，换一种说法仍是这件事。",
    essence: ESSENCE,
    chart_anchors: [] as string[],
  };
}

function angle(index: number) {
  return {
    name: `原则${index}`,
    strategy: "先定这一步的原则，再写做成什么样。不改成打卡清单。",
    means: ["完成样貌是一个能核对的结果"],
    chart_anchors: [] as string[],
  };
}

export type P0ReplayRow = { ok: boolean; reason: string; notes: string[] };

export function replayObservedP0Shapes(chartText: string): {
  lines02: string[];
  lines06: string[];
  situation: P0ReplayRow;
  execution: P0ReplayRow;
} {
  const chart = chartFactPackFromText(chartText);
  const lines02 = pageSliceAnchorLines("02", { chart });
  const lines06 = pageSliceAnchorLines("06", { chart });
  const situation = sanitizePageJson(
    "situation_analysis",
    {
      page_title: "为何是这个断",
      page_subtitle: "短锚可以核对",
      why_cards: [whyCard(1), whyCard(2), whyCard(3), whyCard(4)],
    },
    { sliceAnchorLines: lines02 },
  );
  const angles = [angle(1), angle(2), angle(3)];
  const execution = sanitizePageJson(
    "execution_guidance",
    {
      page_title: "近步原则",
      page_subtitle: "完成样貌与调频",
      primary_toolkit: "主轨原则",
      backup_toolkit: "守住现岗",
      angles,
    },
    { sliceAnchorLines: lines06 },
  );
  const row = (result: typeof situation): P0ReplayRow =>
    result.ok
      ? { ok: true, reason: "stamped", notes: result.notes }
      : { ok: false, reason: result.reason, notes: result.notes };
  return {
    lines02,
    lines06,
    situation: row(situation),
    execution: row(execution),
  };
}
