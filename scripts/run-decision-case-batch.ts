/**
 * Decision-report case batch. Legacy pipeline only.
 * Non-LLM Lab steps: bootstrap → thesis → prealloc.
 * Model fill is recorded as not_run when OpenRouter is absent.
 *
 *   NODE_ENV=development pnpm batch:decision-cases
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getBaziChart } from "shunshi-bazi-core";

import { buildProfileStructured } from "../lib/calculations/build-profile-structured";
import { textHitsScareRedline } from "../lib/llm/compliance/audit-output";
import { approveLabStep, runLabStep } from "../lib/llm/pro/delivery/lab/run-step";
import { createDeliveryLab } from "../lib/llm/pro/delivery/lab/store";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import { DECISION_PAGE_SCHEMAS } from "../lib/llm/pro/delivery/page-schema/decision-pages";
import { buildChartFactPack } from "../lib/llm/pro/delivery/page-schema/chart-fact-pack";
import { replayObservedP0Shapes } from "../lib/llm/pro/delivery/page-schema/p0-fill-shape-replay";
import { runPageSchemaFill } from "../lib/llm/pro/delivery/page-schema/fill-call";
import type { DeliveryComputed } from "../lib/llm/pro/delivery/delivery-schema";
import { resolveDeliveryPipeline } from "../lib/llm/pro/delivery/pipeline-v3/flag";
import {
  sliceDumpKeys,
  sliceStaysInAllowlist,
  type DecisionPageId,
} from "../lib/llm/pro/delivery/page-feed-matrix";
import { composePage07Markdown } from "../lib/llm/pro/delivery/page-07-face";
import {
  deliveryTopicFromSignals,
  readingOrderForTopic,
  sliceForPage,
} from "../lib/llm/pro/delivery/slice-for-page";
import { hourToHourPeriod, shunshiParamsFromBirthInfo } from "../lib/profile/birth-info-utils";
import type { BirthInfo, UserProfile } from "../lib/profile/types";
import { getStemInfo } from "../lib/poju/bazi-matrix-mappings";
import { buildZiweiFactPack } from "../lib/ziwei/fact-pack";
import { DECISION_CASES, type DecisionCaseSpec } from "./decision-case-matrix";

const AS_OF = "2026-10-27";
const OUT_DIR = path.join(".cursor/docs/decision-report/batches/2026-10-27");
const ELEMENT_ZH = {
  Wood: "木",
  Fire: "火",
  Earth: "土",
  Metal: "金",
  Water: "水",
} as const;

type GateRow = { step: string; passed: boolean | "not_run"; detail: string };

type CaseResult = {
  id: string;
  title: string;
  role: DecisionCaseSpec["role"];
  verdict: "PASS" | "PARTIAL" | "FAIL";
  reason: string;
  topic: string | null;
  shelf: string[];
  gates: GateRow[];
  abstracts: Record<string, string>;
  gaps: string[];
  lab_id: string | null;
};

function birthOf(spec: DecisionCaseSpec): BirthInfo {
  const b = spec.birth;
  return {
    year: b.year,
    month: b.month,
    day: b.day,
    hour: b.hour,
    minute: b.minute,
    hour_period: hourToHourPeriod(b.hour),
    gender: b.gender,
    timezone: b.timezone,
    birth_location: {
      name: b.place,
      latitude: b.latitude,
      longitude: b.longitude,
      timezone: b.timezone,
      use_defaults: false,
    },
  };
}

function chartFor(birth: BirthInfo) {
  const params = shunshiParamsFromBirthInfo(birth);
  const chart = getBaziChart({
    year: params.year,
    month: params.month,
    day: params.day,
    hour: params.hour,
    minute: params.minute,
    gender: params.gender,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
    standardMeridian: params.standardMeridian,
    useTrueSolarTime: true,
    sect: 1,
  });
  const stub: UserProfile = {
    id: "case-batch",
    birth,
    bazi: {
      yearPillar: "甲子",
      monthPillar: "甲子",
      dayPillar: "甲子",
      hourPillar: "甲子",
    },
    diagnosis: {
      dayMaster: "甲",
      favorableElements: [],
      challengingElements: [],
      patternSummary: "",
    },
    createdAt: 0,
    updatedAt: 0,
    source: "shunshi",
  };
  const first = buildProfileStructured({ profile: stub, chart });
  const detail = first.pillars_detail;
  const stem = detail?.day.stem || "甲";
  const element = getStemInfo(stem)?.element;
  const dayMaster = `${stem}${element ? ELEMENT_ZH[element] : ""}`;
  const profile: UserProfile = {
    ...stub,
    bazi: {
      yearPillar: detail?.year.ganzhi || stub.bazi.yearPillar,
      monthPillar: detail?.month.ganzhi || stub.bazi.monthPillar,
      dayPillar: detail?.day.ganzhi || stub.bazi.dayPillar,
      hourPillar: detail?.hour.ganzhi || stub.bazi.hourPillar,
    },
    diagnosis: {
      ...stub.diagnosis,
      dayMaster,
    },
  };
  const structured = buildProfileStructured({ profile, chart });
  const pack = buildChartFactPack(structured, {
    as_of: new Date(`${AS_OF}T12:00:00Z`),
    timezone: birth.timezone,
  });
  return { structured, pack };
}

function schemaOk(): string | null {
  const page02 = DECISION_PAGE_SCHEMAS["02"];
  const page05 = DECISION_PAGE_SCHEMAS["05"];
  const page06 = DECISION_PAGE_SCHEMAS["06"];
  const ids = (page: typeof page02) => page.segments.map((segment) => segment.id).join("");
  const duty06 = page06.segments.map((segment) => `${segment.label} ${segment.duty}`).join("\n");
  if (page02.dualTrack !== "abc" || !ids(page02).startsWith("ABC")) return "02 dual-track";
  if (!page02.segments.some((segment) => segment.id === "D" && /短锚/.test(segment.duty))) return "02-D";
  if (!page05.segments.some((segment) => segment.id === "D" && /切轨/.test(segment.label))) return "05-D";
  if (!/近步|完成样貌/.test(duty06) || !/调频/.test(duty06)) return "06 principles";
  if (/勾选/.test(duty06)) return "06 checkbox duty";
  return null;
}

async function labGates(spec: DecisionCaseSpec, structured: unknown): Promise<{
  lab_id: string | null;
  gates: GateRow[];
}> {
  const gates: GateRow[] = [];
  let lab: DeliveryLabSession;
  try {
    lab = await createDeliveryLab({
      ops_user: "case-batch-2026-10-27",
      source: {
        locale: "zh",
        original_question: spec.question,
        desired_outcome: spec.expect,
        base_analysis: { structured, content: spec.id },
        covered_agenda: [{ label: "细节", answer: spec.detail }],
        pivot_chart_path: spec.pivotChartPath,
        partner_bazi: spec.partnerBazi,
        joint_decision: spec.joint,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { lab_id: null, gates: [{ step: "lab.create", passed: false, detail: message }] };
  }

  const steps = ["bootstrap", "thesis.gen", "prealloc"] as const;
  let current = lab;
  for (const step of steps) {
    const run = await runLabStep(current, step);
    current = run.lab;
    const verdict = run.attempt?.gate_verdict;
    const passed = Boolean(run.ok && verdict?.passed);
    gates.push({
      step,
      passed,
      detail: verdict?.detail || verdict?.failed_rule || run.reason || (passed ? "ok" : "fail"),
    });
    if (!passed) break;
    const approved = await approveLabStep(current, step);
    current = approved.lab;
    if (!approved.ok) {
      gates.push({ step: `${step}.approve`, passed: false, detail: approved.reason ?? "approve_failed" });
      break;
    }
  }
  return { lab_id: lab.lab_id, gates };
}

async function modelFillGates(
  spec: DecisionCaseSpec,
  chartText: string,
  topic: string | null,
): Promise<GateRow[]> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return [
      {
        step: "model.fill",
        passed: "not_run",
        detail: "OPENROUTER_API_KEY unset",
      },
    ];
  }
  const gates: GateRow[] = [];
  for (const key of ["situation_analysis", "execution_guidance"] as const) {
    const filled = await runPageSchemaFill({
      key,
      finalize: {} as DeliveryComputed,
      locale: "zh",
      chart_fact_pack: chartText,
      topic,
      question_expectation: `${spec.question}\n${spec.expect}`,
      fill_mode: "full",
      deep_evidence_plan: null,
      thinking_effort: "high",
    });
    gates.push({
      step: `model.fill.${key}`,
      passed: filled.ok,
      detail: filled.ok ? `attempts=${filled.attempts}` : filled.reason,
    });
    if (!filled.ok) break;
  }
  return gates;
}

function runCase(spec: DecisionCaseSpec, structured: ReturnType<typeof chartFor>["structured"], pack: ReturnType<typeof chartFor>["pack"], ziwei: ReturnType<typeof buildZiweiFactPack>): Omit<CaseResult, "lab_id" | "gates"> & { gaps: string[] } {
  const topic = deliveryTopicFromSignals({
    topic: spec.topic,
    question: spec.question,
    pivotChartPath: spec.pivotChartPath,
    partnerBazi: spec.partnerBazi,
    joint: spec.joint,
  });
  const shelf = readingOrderForTopic(topic);
  const gaps: string[] = [];
  const abstracts: Record<string, string> = {};
  const schemaIssue = schemaOk();
  if (schemaIssue) gaps.push(`schema:${schemaIssue}`);
  if (shelf.join(",") !== spec.expectedFaces.join(",")) {
    gaps.push(`shelf:${shelf.join(",")}≠${spec.expectedFaces.join(",")}`);
  }

  const packs = {
    chart: pack,
    cfp: {
      pathTags: spec.pathTags,
      conflictAnchors: spec.conflictAnchors,
    },
    zfp: ziwei,
    user: { Q: spec.question, expect: spec.expect, detail: spec.detail },
    sci: { hooks: spec.sciHook },
    topic,
  };
  const produced: string[] = [spec.question, spec.expect, spec.detail];
  for (const pageId of shelf) {
    const sliced = sliceForPage(pageId as DecisionPageId, packs);
    const dumped = sliceDumpKeys(sliced.slice);
    if (!sliceStaysInAllowlist(pageId as DecisionPageId, sliced.slice) || dumped.length) {
      gaps.push(`slice:${pageId}`);
    }
    const palace =
      sliced.slice.zfp && typeof sliced.slice.zfp.topicPalace === "object"
        ? sliced.slice.zfp.topicPalace.palace
        : "";
    const other = sliced.slice.zfp?.otherChart;
    abstracts[pageId] = [
      sliced.zfpOmitted ? "zfp omitted" : `zfp ${Object.keys(sliced.slice.zfp ?? {}).join(",")}`,
      `cfp ${Object.keys(sliced.slice.cfp ?? {}).join(",") || "—"}`,
      palace ? `palace ${palace}` : "",
      other ? "otherChart present" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    if (pageId === "07" && other) gaps.push("joint:otherChart_built");
    produced.push(abstracts[pageId] ?? "");
  }
  if (spec.role === "thin") {
    const page07 = sliceForPage("07", packs);
    if (page07.slice.zfp?.otherChart) gaps.push("joint:otherChart_built");
    abstracts["07-other"] = page07.slice.zfp?.otherChart ? "present" : "omitted";
  }

  const page07 = composePage07Markdown({
    topic,
    question: spec.question,
    packs,
  });
  if (shelf.includes("07")) {
    if (!page07 || !page07.includes("场域与关系") || !page07.includes(spec.question)) {
      gaps.push("07:unreadable");
    } else {
      abstracts["07-text"] = page07.split("\n").slice(0, 8).join(" / ");
      produced.push(page07);
    }
  } else if (page07) {
    gaps.push("07:composed_while_closed");
  }

  if (produced.some((text) => textHitsScareRedline(text))) gaps.push("scare");

  const ming = ziwei.topicPalace;
  abstracts.chart = `日主 ${structured.day_master} · 命宫 ${ming.palace} ${ming.majorStars.join("、")}`;

  let verdict: CaseResult["verdict"] = "PARTIAL";
  let reason = "结构闸过了。模型正文没跑，硬度、05 成句、06 成稿未检。";
  if (gaps.length) {
    verdict = "FAIL";
    reason = gaps.join("; ");
  } else if (spec.role === "thin") {
    reason = "Thin。07 按 joint 插入，otherChart 省略。模型正文没跑。";
  }
  return { id: spec.id, title: spec.title, role: spec.role, verdict, reason, topic, shelf, abstracts, gaps };
}

function writeReport(results: CaseResult[], pipeline: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const result of results) {
    const file = path.join(OUT_DIR, `${result.id}.json`);
    writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`);
    const md = [
      `# ${result.title}`,
      "",
      `${result.verdict} · ${result.reason}`,
      "",
      `活闸 topic：${result.topic ?? "（无）"}`,
      "",
      `书架：${result.shelf.join(" → ")}`,
      "",
      "## 闸",
      "",
      ...result.gates.map((gate) => `- ${gate.step}: ${String(gate.passed)} · ${gate.detail}`),
      "",
      "## 摘要",
      "",
      ...Object.entries(result.abstracts).map(([key, value]) => `- ${key}: ${value}`),
      "",
      result.gaps.length ? `缺口：${result.gaps.join("; ")}` : "结构缺口：无",
      "",
      `lab ${result.lab_id ?? "—"}`,
      "",
    ].join("\n");
    writeFileSync(path.join(OUT_DIR, `${result.id}.md`), md);
  }
  const lines = [
    "# 案例批跑 2026-10-27",
    "",
    `管线：${pipeline}。模型 fill：${results.some((result) => result.gates.some((gate) => gate.step.startsWith("model.fill") && gate.passed !== "not_run")) ? "已调用" : "未调用（无 OPENROUTER_API_KEY）。下表是结构与清洗，不是成稿。"}`,
    "",
    "| 案 | 判定 | 原因 |",
    "|----|------|------|",
    ...results.map((result) => `| ${result.title} | ${result.verdict} | ${result.reason} |`),
    "",
    "人审先读 §3.5 离职创业，再读亲密、迁移、一般决定、joint 薄壳。",
    "",
  ];
  writeFileSync(path.join(OUT_DIR, "README.md"), lines.join("\n"));
}

async function main() {
  const pipeline = resolveDeliveryPipeline();
  if (pipeline !== "legacy") {
    console.error(`refusing batch: DELIVERY_PIPELINE resolved to ${pipeline}`);
    process.exit(1);
  }
  const results: CaseResult[] = [];
  for (const spec of DECISION_CASES) {
    const birth = birthOf(spec);
    const { structured, pack } = chartFor(birth);
    const ziwei = buildZiweiFactPack(birth, { asOf: AS_OF });
    const structural = runCase(spec, structured, pack, ziwei);
    const lab = await labGates(spec, structured);
    const replay = replayObservedP0Shapes(pack.text);
    const replayGates: GateRow[] = [
      {
        step: "sanitize.02",
        passed: replay.situation.ok,
        detail: replay.situation.ok
          ? replay.lines02.join(" | ")
          : `${replay.situation.reason} ${replay.situation.notes.slice(0, 4).join(" | ")}`,
      },
      {
        step: "sanitize.06",
        passed: replay.execution.ok,
        detail: replay.execution.ok
          ? replay.lines06.join(" | ")
          : `${replay.execution.reason} ${replay.execution.notes.slice(0, 4).join(" | ")}`,
      },
    ];
    const modelGates = await modelFillGates(spec, pack.text, structural.topic);
    const labFail = lab.gates.filter((gate) => gate.passed === false);
    const replayFail = replayGates.filter((gate) => gate.passed === false);
    const modelFail = modelGates.filter((gate) => gate.passed === false);
    const modelRan = modelGates.some((gate) => gate.passed !== "not_run");
    const gaps = [...structural.gaps];
    if (labFail.length) gaps.push(`lab:${labFail.map((gate) => gate.step).join(",")}`);
    if (replayFail.length) gaps.push(`sanitize:${replayFail.map((gate) => gate.detail).join(" | ")}`);
    let verdict = structural.verdict;
    let reason = structural.reason;
    if (gaps.length) {
      verdict = "FAIL";
      reason = gaps.join("; ");
    } else if (spec.role === "thin") {
      verdict = "PARTIAL";
      reason = modelRan
        ? "Thin。07 按 joint 插入，otherChart 省略。结构与清洗过了。"
        : "Thin。07 按 joint 插入，otherChart 省略。结构与清洗过了。模型正文未跑。";
    } else if (modelFail.length) {
      verdict = "FAIL";
      reason = modelFail.map((gate) => `${gate.step} ${gate.detail}`).join(" | ");
    } else if (!modelRan) {
      verdict = "PASS";
      reason = "结构与清洗过了。OPENROUTER 未设置，模型正文未跑。";
    } else {
      verdict = "PASS";
      reason = "结构、清洗和本页 fill 过了。成稿硬度仍等人审。";
    }
    results.push({
      ...structural,
      verdict,
      reason,
      gaps,
      gates: [...lab.gates, ...replayGates, ...modelGates],
      lab_id: lab.lab_id,
    });
    console.log(`${spec.id} ${verdict} topic=${structural.topic ?? "-"} shelf=${structural.shelf.join(",")}`);
  }
  writeReport(results, pipeline);
  console.log(`wrote ${OUT_DIR}`);
}

void main();
