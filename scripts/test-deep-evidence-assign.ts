/**
 * Unit tests: deep-evidence assign distribution + chunking (no LLM).
 * Run: pnpm exec tsx scripts/test-deep-evidence-assign.ts
 */
import assert from "node:assert/strict";
import {
  chunkPaths,
  distributeP4MoatTargets,
  parseDeepEvidenceAssignment,
  planDeepEvidenceSlots,
  resolveDeepEvidenceUnitCount,
} from "../lib/llm/pro/delivery/page-schema/deep-evidence-assign";
import { formatDeepEvidencePlanForCompress } from "../lib/llm/pro/delivery/page-schema/deep-evidence-call";

{
  const targets = distributeP4MoatTargets(new Set(["polarity", "archetype"]), 4);
  assert.equal(targets.length, 4);
  assert.ok(targets.includes("polarity"));
  assert.ok(targets.includes("archetype"));
  assert.equal(targets[0], "polarity");
  assert.equal(targets[1], "archetype");
}

{
  const n = resolveDeepEvidenceUnitCount("metaphysics_action", 2);
  assert.ok(n >= 3 && n <= 6);
  const planned = planDeepEvidenceSlots(
    "metaphysics_action",
    "yong: 水\npack_polarity: yong=水 ji=火\ncurrent_da_yun_cycle: 甲子\ntiming_ripeness: 中\n【十神语义】正印",
  );
  // eligible may include timing+polarity+archetype depending on slice heuristics
  assert.ok(planned.length >= 2);
  const moats = new Set(planned.map((p) => p.moat_class).filter(Boolean));
  assert.ok(moats.size >= 1, "at least one moat assigned");
}

{
  const p5 = planDeepEvidenceSlots("risk_guard");
  assert.equal(p5.length, 6);
  assert.equal(p5[0]!.path, "red_lights[0]");
  assert.equal(p5[3]!.path, "switch_to_backup");
}

{
  const chunks = chunkPaths([1, 2, 3, 4, 5, 6], 2);
  assert.deepEqual(chunks, [
    [1, 2],
    [3, 4],
    [5, 6],
  ]);
}

{
  const planned = [
    { path: "dimensions[0]", moat_class: "polarity" as const },
    { path: "dimensions[1]", moat_class: "archetype" as const },
  ];
  const parsed = parseDeepEvidenceAssignment(
    "metaphysics_action",
    {
      page: "metaphysics_action",
      units: [
        { path: "dimensions[0]", chart_anchors: ["用神"] },
        { path: "dimensions[1]", chart_anchors: ["正印"] },
      ],
    },
    planned,
  );
  assert.ok(parsed);
  assert.equal(parsed!.units[0]!.moat_class, "polarity");
  assert.equal(parsed!.units[1]!.chart_anchors[0], "正印");
}

{
  const dump = formatDeepEvidencePlanForCompress({
    page: "metaphysics_action",
    units: [
      {
        path: "dimensions[0]",
        chart_anchors: ["用神"],
        evidence: "⟦w:用神⟧ 补泄机制。",
        moat_class: "polarity",
      },
      {
        path: "dimensions[1]",
        chart_anchors: ["正印"],
        evidence: "⟦w:正印⟧ 角色定位。",
        moat_class: "archetype",
      },
    ],
  });
  assert.ok(dump.includes("moat_class=polarity"), "compress dump polarity lock");
  assert.ok(dump.includes("moat_class=archetype"), "compress dump archetype lock");
  assert.ok(dump.includes('type="archetype"'), "compress dump means type hint");
}

console.log("test-deep-evidence-assign: ok");

{
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    "lib/llm/pro/delivery/page-schema/deep-evidence-assign.ts",
    "utf8",
  );
  assert.ok(src.includes('thinking_effort: "high"'), "assign keeps high thinking (no degrade)");
  assert.ok(!src.includes('thinking_effort: "off"'), "assign must not turn thinking off");
  assert.ok(!src.includes('? "low" : "off"'), "assign must not low/off degrade path");
  assert.ok(src.includes("ASSIGN_MAX_TOKENS = 20_000"), "assign max_tokens 20k");
}