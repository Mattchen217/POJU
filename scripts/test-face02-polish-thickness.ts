/**
 * Face 02 body_polish: latin A+B+C ≥280 words (es/en/fr).
 * Run: node node_modules/tsx/dist/cli.mjs scripts/test-face02-polish-thickness.ts
 */
import assert from "node:assert/strict";
import {
  gateBodyPolishThickness,
  gateFace02PolishThickness,
} from "../lib/llm/pro/delivery/pipeline-v3/body-polish";
import {
  FACE02_POLISH_FLOOR,
  assemblePolishLocaleSystem,
  face02ReportSlotTemplate,
} from "../lib/llm/pro/delivery/pipeline-v3/polish-locale-blocks";
import type { DeliveryPageData } from "../lib/llm/pro/delivery/page-schema/types";
import type { Face02 } from "../lib/llm/pro/delivery/page-schema/face-types";

function face02(partial: {
  destiny: string;
  science: string;
  convergence: string;
  anchors?: string[];
}): Face02 {
  return {
    page: "02",
    face: "02",
    page_title: "Por qué",
    page_subtitle: "doble vía",
    destiny_reason: partial.destiny,
    science_mechanism: partial.science,
    convergence: partial.convergence,
    verifiable_anchors: partial.anchors ?? ["d04", "d05", "d06", "d07"],
  };
}

function asPage(p: Face02): DeliveryPageData {
  return p as unknown as DeliveryPageData;
}

function words(n: number, seed = "carga"): string {
  return Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ");
}

/** Prompt exposes ≥280 for latin face 02 */
{
  const tpl = face02ReportSlotTemplate("es");
  assert.match(tpl, /≥280/);
  assert.match(tpl, /words/);
  const sys = assemblePolishLocaleSystem({ locale: "es", key: "02" });
  assert.match(sys, /≥280/);
  assert.match(sys, /destiny_reason|science_mechanism|convergence/);
}

const draftZh = asPage(
  face02({
    destiny: "庚金承压偏高。",
    science: "现状偏差抬高负荷。",
    convergence: "承压与负荷同向。",
  }),
);

/** es thin ~243 style → FAIL */
{
  const thin = asPage(
    face02({
      destiny: words(80, "destino"),
      science: words(80, "ciencia"),
      convergence: words(83, "cruce"),
    }),
  );
  const abc = [thin.destiny_reason, thin.science_mechanism, thin.convergence]
    .join(" ")
    .trim()
    .split(/\s+/).length;
  assert.ok(abc < FACE02_POLISH_FLOOR.latin_words, `abc=${abc}`);
  const g = gateBodyPolishThickness({
    key: "02",
    draft: draftZh,
    polished: thin,
    locale: "es",
  });
  assert.equal(g?.passed, false);
  assert.equal(g?.failed_rule, "gate_polish_thin_synonym");
  assert.match(String(g?.detail ?? ""), /280|words/);
}

/** 272 with titles still fails if ABC < 280 */
{
  const almost = asPage(
    face02({
      destiny: words(90, "a"),
      science: words(90, "b"),
      convergence: words(92, "c"),
    }),
  );
  const g = gateFace02PolishThickness({
    draft: draftZh,
    polished: almost,
    locale: "es",
  });
  assert.equal(g.passed, false);
}

/** es thick ≥280 → PASS */
{
  const thick = asPage(
    face02({
      destiny: words(100, "destino"),
      science: words(100, "ciencia"),
      convergence: words(100, "cruce"),
    }),
  );
  const g = gateBodyPolishThickness({
    key: "02",
    draft: draftZh,
    polished: thick,
    locale: "es",
  });
  assert.equal(g, null, g?.detail);
}

/** zh skip latin floor (不动 zh 尺) */
{
  const zhPage = asPage(
    face02({
      destiny: "命理承压偏高，开口窗口收窄，岁运冲突下用神承压。",
      science: "现状与目标偏差抬高认知负荷，决策拖延随之加重。",
      convergence: "承压与负荷同向，把开口成本一起抬高。",
    }),
  );
  const g = gateFace02PolishThickness({
    draft: draftZh,
    polished: zhPage,
    locale: "zh",
  });
  assert.equal(g.passed, true, g.detail);
}

console.log("face02-polish-thickness ok", {
  latin_floor: FACE02_POLISH_FLOOR.latin_words,
});
