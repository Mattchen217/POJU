/**
 * Offline guards for v2 translate layer (no OpenRouter).
 *   pnpm exec tsx scripts/test-v2-translate-guards.ts
 */
import fs from "node:fs";
import path from "node:path";
import { NARRATIVE_TASKS } from "@/lib/base-analysis-v2/narrative/narrative-call";
import { buildMarkerDictionary } from "@/lib/base-analysis-v2/translate/marker-dictionary";
import {
  buildTranslatePersona,
  buildTranslatePrompt,
  NATIVE_PERSONA,
  resolveNativePersona,
} from "@/lib/base-analysis-v2/translate/translate-prompt";
import {
  extractMarkers,
  findMarkerDrift,
  pickTextPaths,
  restoreMarkersInOrder,
} from "@/lib/base-analysis-v2/translate/translate-call";
import type { ReportSegmentTextTree } from "@/lib/base-analysis-v2/segment-text";

const failures: string[] = [];
const assert = (label: string, ok: boolean) => {
  if (!ok) failures.push(label);
  console.log(`[${ok ? "PASS" : "FAIL"}] ${label}`);
};

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

assert("NATIVE_PERSONA en=美国", NATIVE_PERSONA.en?.nationality === "美国");
assert("NATIVE_PERSONA es=西班牙", NATIVE_PERSONA.es?.nationality === "西班牙");
assert("NATIVE_PERSONA de=德国", NATIVE_PERSONA.de?.nationality === "德国");
assert("NATIVE_PERSONA fr=法国", NATIVE_PERSONA.fr?.nationality === "法国");
assert("resolveNativePersona fallback en", resolveNativePersona("pt").nationality === "美国");

const persona = buildTranslatePersona("en");
assert("人设含美国人", persona.includes("美国人"));
assert("人设含英语", persona.includes("英语"));
assert("人设含易经八字", persona.includes("易经") && persona.includes("八字"));

const dict = buildMarkerDictionary("en");
assert("词典含代号 yong_shen", dict.includes("代号 yong_shen："));
assert("词典含真词用神", dict.includes("「用神」"));
assert("词典不含完整标记形态", !dict.includes("⟦t:"));
assert("词典不含自造软译锚元行", !dict.includes("锚元"));

const { system, user } = buildTranslatePrompt("en", {
  narrative: { energy_map: { day_master_nature: "你像一株藤蔓。" } },
  evidence: {
    energy_map: { day_master_nature: "因⟦t:day_master|⟧偏弱。" },
  },
});
assert("translate 禁粘贴中文依据", system.includes("绝对禁止") && system.includes("evidence"));
assert("translate 岛外必须译", system.includes("标记以外") || system.includes("岛以外"));
assert("translate 形态含空竖线", system.includes("⟦t:yong_shen|⟧") || system.includes("⟦t:xxxx|⟧"));
assert("translate system 注入代号表", system.includes("代号 day_master："));
assert("translate user 含 payload", user.includes("你像一株藤蔓"));
assert("translate user 禁 evidence 粘贴中文", user.includes("禁止 evidence 粘贴中文"));

assert(
  "extractMarkers 排序稳定",
  JSON.stringify(extractMarkers("a⟦t:b|⟧x⟦t:a|⟧")) ===
    JSON.stringify(["⟦t:a|⟧", "⟦t:b|⟧"]),
);

{
  const src = { energy_map: { day_master_nature: "因⟦t:day_master|本元|x⟧弱。" } };
  const ok = { energy_map: { day_master_nature: "Due to ⟦t:day_master|本元|x⟧ weakness." } };
  const bad = { energy_map: { day_master_nature: "Due to Core weakness." } };
  assert(
    "marker 保留通过",
    findMarkerDrift(src, ok, ["energy_map.day_master_nature"]) === null,
  );
  assert(
    "marker 丢失可抓",
    findMarkerDrift(src, bad, ["energy_map.day_master_nature"])?.includes("marker_drift") ===
      true,
  );
}

assert(
  "restoreMarkersInOrder 回填岛",
  restoreMarkersInOrder(
    "因⟦t:day_master|⟧与⟦t:yong_shen|⟧。",
    "Because ⟦t:DAY|x⟧ and ⟦t:wrong|⟧.",
  ) === "Because ⟦t:day_master|⟧ and ⟦t:yong_shen|⟧.",
);

{
  const tree = {
    energy_map: {
      day_master_nature: "a",
      wuxing_distribution: "b",
      cognitive_archetype: "c",
      regulator: "d",
    },
  } as unknown as ReportSegmentTextTree;
  const picked = pickTextPaths(tree, NARRATIVE_TASKS[0]!.paths);
  assert("pickTextPaths 只含 energy_map", Object.keys(picked).join() === "energy_map");
}

const orch = read("lib/base-analysis-v2/orchestrate/run-report.ts");
assert("orchestrate 固定 PIPELINE_LOCALE=zh", orch.includes('PIPELINE_LOCALE = "zh"'));
assert("orchestrate 调用 runTranslate", orch.includes("runTranslate"));
assert("orchestrate translate 失败 stage", orch.includes('"translate"'));

const computePrompt = read("lib/base-analysis-v2/compute/compute-prompt.ts");
assert("compute 无 COMPUTE_SYSTEM_EN", !computePrompt.includes("COMPUTE_SYSTEM_EN"));
assert("compute 无 Summary block language", !computePrompt.includes("# Summary block language"));

const narPrompt = read("lib/base-analysis-v2/narrative/narrative-prompt.ts");
assert("narrative 无 NARRATIVE_SYSTEM_EN", !narPrompt.includes("NARRATIVE_SYSTEM_EN"));

const evPrompt = read("lib/base-analysis-v2/evidence/evidence-prompt.ts");
assert("evidence 无 EVIDENCE_SYSTEM_EN", !evPrompt.includes("EVIDENCE_SYSTEM_EN"));
assert(
  'evidence 打标块固定 zh',
  evPrompt.includes('buildTermMarkingPromptBlock("zh"'),
);

const stages = read("lib/base-analysis/progress-stages.ts");
assert("progress 含 v2_translate", stages.includes('"v2_translate"'));
assert("progress 含 v2_semantic_text", stages.includes('"v2_semantic_text"'));
assert("progress 含 v2_final_audit", stages.includes('"v2_final_audit"'));

const sseClient = read("lib/base-analysis/stream-sse-client.ts");
assert(
  "translate artifact 不在 finalize 起点与 v2_translate 同发",
  !/emit\([^)]*"v2_translate",\s*"translate"\)/.test(sseClient),
);
assert(
  "60s 发 semantic_text + translate artifact",
  sseClient.includes("WAIT_SEMANTIC_ARTIFACT_MS") &&
    sseClient.includes('"v2_semantic_text"') &&
    /"translate"/.test(sseClient),
);
assert("120s final audit", sseClient.includes("WAIT_FINAL_AUDIT_MS"));
assert("入场仪式 INTRO_TOTAL", sseClient.includes("WAIT_ARTIFACT_INTRO_TOTAL_MS"));

const waitConstants = read("lib/wait-ritual/constants.ts");
assert(
  "center hold 5000",
  waitConstants.includes("WAIT_ARTIFACT_CENTER_HOLD_MS = 5000"),
);

const artifactUi = read("components/wait-ritual/WaitArtifactDocs.tsx");
assert("spawn hold seated", artifactUi.includes('"spawn"') && artifactUi.includes('"hold"') && artifactUi.includes('"seated"'));

const artifactCss = read("styles/wait-ritual.css");
assert(
  "left 2x2 seat slots",
  artifactCss.includes("wait-artifact-doc--seated") &&
    artifactCss.includes("--artifact-col") &&
    artifactCss.includes("--artifact-row"),
);
assert(
  "cover caption on paper",
  artifactUi.includes("wait-artifact-doc__cover") &&
    artifactUi.includes("wait-artifact-doc__caption"),
);
assert("dog-ear fold face", artifactUi.includes("wait-artifact-doc__fold-face"));
assert("center hold size enlarged", artifactCss.includes("--artifact-hold-w"));
assert("completed check badge", artifactUi.includes("wait-artifact-doc__done"));
assert("deeper dog-ear fold", artifactCss.includes("width: 40%"));
assert("cluster toward center", artifactCss.includes("--artifact-cluster-x"));

const enProgress = read("messages/en.json");
assert(
  "en 无 Translating into your language",
  !enProgress.includes("Translating into your language"),
);
assert("en convert 用 Converting", enProgress.includes("Converting high-dimensional"));
assert("en semantic construction copy", enProgress.includes("deep semantic construction"));

const zhProgress = read("messages/zh.json");
assert("zh 语义构建", zhProgress.includes("深度语义构建"));
assert("zh 终审", zhProgress.includes("交叉校验与推演终审"));
const translateCall = read("lib/base-analysis-v2/translate/translate-call.ts");
assert('translate reasoning=medium', translateCall.includes('reasoning_effort: "medium"'));
assert("translate 压回空槽", translateCall.includes("collapseMarkersToEmptySlots"));
assert("marker 漂移代码回填不重试", translateCall.includes("已代码回填标记,不重试"));
assert(
  "无因 drift continue",
  !/findMarkerDrift[\s\S]{0,280}continue/.test(translateCall),
);
assert("translate 用 V2_HARD_MAX_ATTEMPTS", translateCall.includes("V2_HARD_MAX_ATTEMPTS"));
assert("translate MAX=16000", translateCall.includes("V2_OUTPUT_MAX_TOKENS"));
assert("translate 无 retryHint", !translateCall.includes("retryHint"));
assert(
  "translate-prompt 无纠错重译",
  !read("lib/base-analysis-v2/translate/translate-prompt.ts").includes("纠错"),
);

const evidenceCall = read("lib/base-analysis-v2/evidence/evidence-call.ts");
assert(
  "evidence polish 不预填 forceSsot",
  !/polishEvidenceSegment[\s\S]{0,200}forceSsotPlainInMarkers/.test(evidenceCall),
);

console.log(failures.length ? "❌ translate guards failed" : "✅ translate guards ready");
if (failures.length) {
  console.error(failures);
  process.exit(1);
}
