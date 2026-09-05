/**
 * Thinking-effort tiering + compress jargon guard.
 * Run: pnpm exec tsx scripts/test-thinking-effort-tiering.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  SEGMENT_HEAVY_MIN_INVOKE_MS,
  SEGMENT_LIGHT_FILL_KEYS,
  SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS,
  segmentAdmitMinMs,
  segmentFillThinkingEffort,
} from "../lib/llm/pro/delivery/run-segment-chain";
import { sanitizePageJson } from "../lib/llm/pro/delivery/page-schema/sanitize";
import { repairCompressPageJargon } from "../lib/llm/pro/delivery/page-schema/compress-jargon-repair";

assert.equal(SEGMENT_LIGHT_FILL_KEYS.size, 0);
assert.equal(segmentFillThinkingEffort("direct_answer"), "high");
assert.equal(segmentFillThinkingEffort("foundation"), "high");
assert.equal(segmentFillThinkingEffort("science_action"), "high");
assert.equal(segmentFillThinkingEffort("metaphysics_action"), "high");
assert.equal(SEGMENT_HEAVY_MIN_INVOKE_MS, 180_000);
assert.equal(SEGMENT_DEEP_EVIDENCE_MIN_INVOKE_MS, 180_000);
assert.equal(segmentAdmitMinMs("direct_answer"), 40_000);
assert.equal(segmentAdmitMinMs("foundation"), 180_000);
assert.equal(segmentAdmitMinMs("risk_guard"), 180_000);

const chainSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/run-segment-chain.ts"),
  "utf8",
);
assert.ok(!/"medium"/.test(chainSrc), "run-segment-chain must not use medium");
assert.ok(!/"low"/.test(chainSrc), "run-segment-chain must not use low");
assert.ok(chainSrc.includes("DELIVERY_FINALIZE_TIMEOUT_XHIGH_MS"));

const deepSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/deep-evidence-call.ts"),
  "utf8",
);
assert.ok(deepSrc.includes("thinking_effort: currentEffort"));
assert.ok(deepSrc.includes('currentEffort: "xhigh" | "high" = "xhigh"'));
assert.ok(deepSrc.includes('call_site: "deep_evidence"'));

const translateSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/translate-delivery-segment.ts"),
  "utf8",
);
assert.ok(!/"medium"/.test(translateSrc), "translate must not use medium");
assert.ok(!/"low"/.test(translateSrc), "translate must not use low");
assert.ok(/thinking_effort:\s*"high"/.test(translateSrc));

const xhighSrc = readFileSync(
  resolve(__dirname, "../lib/poju/xhigh-job-runner.ts"),
  "utf8",
);
assert.ok(xhighSrc.includes('reasoning_effort: "xhigh"')); // dims/spine
assert.ok(xhighSrc.includes('reasoning_effort: "high"')); // A0 / voice

const fillSrc = readFileSync(
  resolve(__dirname, "../lib/llm/pro/delivery/page-schema/fill-call.ts"),
  "utf8",
);
assert.ok(fillSrc.includes("fillMode: fill_mode"));
assert.ok(!fillSrc.includes("compress prose pollution"));

// --- compress jargon auto-repair ---
{
  const notes: string[] = [];
  const candidate = {
    page: "foundation",
    page_title: "测",
    page_subtitle: "",
    why_cards: [
      {
        title: "卡点",
        surface: "睡不好",
        essence: "这是用神不足带来的耗竭",
        chart_anchors: ["用神"],
      },
    ],
  };
  const r = repairCompressPageJargon("foundation", candidate, notes);
  assert.equal(r.ok, true);
  assert.ok(
    String((candidate.why_cards[0] as { essence: string }).essence).includes("关键补给") ||
      String((candidate.why_cards[0] as { essence: string }).essence).includes("【"),
  );
  assert.ok(notes.some((n) => n.includes("compress_body_jargon_auto_repaired:用神")));
  console.log("ok compress jargon auto-repair");
}

{
  const r = sanitizePageJson(
    "foundation",
    {
      page: "foundation",
      page_title: "测标题",
      page_subtitle: "",
      dashboard: [
        { key: "body", label: "身", score: 50 },
        { key: "mind", label: "心", score: 40 },
      ],
      why_cards: [
        {
          title: "卡点一",
          surface: "反复拖延推进关键事项",
          essence:
            "结构上用神偏弱，外部压力叠加导致推进成本升高，需要先稳住补给再谈扩张，否则会一直卡在启动门槛，连小步验证都开不了口，整周都会空转。",
          chart_anchors: ["用神", "身弱"],
        },
        {
          title: "卡点二",
          surface: "一谈边界就退缩不敢硬刚",
          essence:
            "并肩同行的力量过强时容易让位，边界感被稀释成讨好习惯，短线看起来省事，长线会失掉自己的节奏，合作也会越来越不对等，最后只剩疲惫。",
          chart_anchors: ["比肩"],
        },
        {
          title: "卡点三",
          surface: "恢复节奏总被打断",
          essence:
            "内在滋养不足时，恢复窗口一被占用就回不到基线，第二天又要用硬扛补缺口，形成循环透支，身体与情绪都会一起报警，周末也修不好。",
          chart_anchors: ["正印"],
        },
        {
          title: "卡点四",
          surface: "决策拖到最后一刻",
          essence:
            "稳健资源线索不清时，会用拖延换安全感，但窗口一过成本更高，需要把可验证的小步决策前置，并用明确完成态收口，避免无限悬置。",
          chart_anchors: ["正财"],
        },
      ],
    },
    { fillMode: "compress" },
  );
  assert.equal(r.ok, true, (r as { reason?: string }).reason ?? "sanitize fail");
  if (r.ok) {
    assert.ok(r.notes.some((n) => n.includes("compress_body_jargon_auto_repaired")));
    const essence = r.page.page === "foundation" ? r.page.why_cards[0]!.essence : "";
    assert.ok(!essence.includes("用神"));
  }
  console.log("ok sanitize compress fillMode jargon path");
}

console.log("\ntest-thinking-effort-tiering: ok\n");
