/**
 * DI2 Personalized Understanding-Driven turn.
 * Model produces: Current Understanding narrative, Need labels, chat response,
 * next question wording (bound to a legal candidate), and exactly 3 suggested replies.
 * Code retains Blueprint/DC/budget/intake-layer/report-coverage authority;
 * templates must not be user-visible replies.
 * Model chooses among legal candidates — code rank is a non-authoritative hint.
 */

import { openRouterChatCompletion } from "@/lib/llm/openrouter-shared";
import { buildUserFacingExpressionContractBlock } from "@/lib/llm/prompts/user-facing-expression-contract";
import type { POJUSessionState } from "@/lib/poju/types";
import type { AdaptiveQuestionPlan, IntakeLayerFocus, UnderstandingState } from "./types";
import {
  buildPersonalProfileContext,
  personalProfileContextForPrompt,
  type PersonalProfileContext,
} from "./personal-profile-context";
import { formatReportPurposeForPrompt } from "./investigation-report-map";

export const UNDERSTANDING_RESPONSE_MODEL_VERSION =
  "understanding_response_report_driven_r1" as const;
export const UNDERSTANDING_RESPONSE_TIMEOUT_MS = 90_000;

export type SuggestedReply = { label: string; value: string };

export type LayerAssessmentProposal = {
  statement: string;
  supporting_fact_ids: string[];
  unresolved_ambiguities: string[];
  sufficient_proposal: boolean;
};

export type ReportCoverageAssessmentProposal = {
  missing_required_sections: string[];
  notes: string;
};

export type DecisionUnderstandingModelOutput = {
  current_understanding_narrative: string;
  understood_labels: Array<{ label: string; fact_ids: string[] }>;
  need_to_understand: Array<{
    label: string;
    priority: "P0" | "P1" | "P2";
    necessity: "required" | "optional";
    why_it_matters: string;
    related_dir_ids: string[];
  }>;
  personal_pattern_insight: {
    status: "available" | "none" | "unavailable";
    insights: Array<{
      text: string;
      traditional_basis: string;
      source_fields: string[];
    }>;
  };
  problem_understanding_assessment: LayerAssessmentProposal;
  desired_outcome_assessment: LayerAssessmentProposal;
  report_coverage_assessment: ReportCoverageAssessmentProposal;
  current_intake_layer: IntakeLayerFocus | null;
  next_question: {
    selected_candidate_id: string | null;
    question_text: string | null;
    rationale: string;
  };
  suggested_replies: [SuggestedReply, SuggestedReply, SuggestedReply];
  response_text: string;
};

export type UnderstandingModelCallMeta = {
  source: "openrouter" | "test_hook";
  provider: string | null;
  model: string | null;
  latency_ms: number;
};

export type UnderstandingModelResult =
  | {
      ok: true;
      output: DecisionUnderstandingModelOutput;
      profile: PersonalProfileContext;
      call_meta: UnderstandingModelCallMeta;
    }
  | {
      ok: false;
      reason: string;
      detail?: string;
      profile: PersonalProfileContext;
      call_meta: UnderstandingModelCallMeta;
    };

export type LegalUnderstandingCandidate = {
  candidate_id: string;
  direction_id: string;
  dir_ids: string[];
  ddr_ids?: string[];
  intake_layer?: string | null;
  report_page_ids?: string[];
  report_section_ids?: string[];
  missing_info: string;
  decision_value: string;
  expected_info: string;
  decision_value_detail?: string;
  evidence_requirements?: string;
  why_it_matters?: string;
  template_question: string;
};

export type UnderstandingModelTestHook = (input: {
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  legal_candidate_ids: string[];
  legal_candidates?: LegalUnderstandingCandidate[];
  profile: PersonalProfileContext;
  locale: string;
  init_only: boolean;
  user_statement: string;
}) => Promise<DecisionUnderstandingModelOutput> | DecisionUnderstandingModelOutput;

const SYSTEM_PROMPT = [
  "你是 POJU 的个性化决策理解引擎（Report-Driven Intake）。",
  "每一轮你必须结合：用户原始决策问题、全部历史回答、完整 Decision Context、当前 Understanding、",
  "当前调查层次与 Gate 状态、报告章节覆盖、合法候选及其报告映射、本地 ProfileStructured。",
  "",
  "## 调查三层（硬顺序由代码 Gate 控制；你不可跳层）",
  "1) problem_understanding — 搞清用户真正的问题与情境边界",
  "2) desired_outcome — 搞清期望结果/不可接受结果/评价标准",
  "3) report_details — 按 8 页报告真实章节缺口采集事实/选项/约束/证据",
  "代码给出的 current_intake_layer 是权威焦点；你的 assessment 只是提议，不能单凭 sufficient_proposal=true 推进。",
  "",
  "## 职责边界（硬）",
  "- 代码已经给出本层合法调查候选（candidate_id）与报告页/节映射；你必须比较候选后自主选择最重要缺口。",
  "- code_rank_hint / previous_plan 只是参考，不是本轮必须沿用的最终选择；禁止照抄 code_rank_hint。",
  "- 禁止为了填 DIR/字段空值而提问；每题必须能说明服务哪一页/哪一节/哪个 DDR、缺什么、为何影响报告判断。",
  "- 调查只服务 8 页交付报告真正需要的信息：用户问题 / 用户期望 / 相关细节。无报告用途的候选不要选。",
  "- 首轮若期望结果尚未明确、且会改变后续调查与报告分析，优先选期望/结果类候选，而不是细节深挖。",
  "- 命理资料只作传统分析框架与待核实假设；禁止写成已确认现实事实；禁止自行推算或改写干支/星曜。",
  "- 没有足够 Profile 字段支撑时，personal_pattern_insight.status 必须为 none；禁止为了显示而编造行为比较结论。",
  "- Current Understanding 必须是综合理解，禁止只重复用户原话，禁止输出 Decision:/Open needs: 统计摘要。",
  "- understood_labels 必须从用户已给出的明确现实信息提取，并尽量引用 DC 已有 fact_ids；有有效事实时不得无理由返回空数组。",
  "- 聊天气泡用 response_text：先回应本轮处境与判断，再自然衔接下一个问题；不要把信息框整段粘进聊天；不要输出内部推理过程。",
  "- suggested_replies 必须恰好 3 个，彼此有实质区别，可点击当作用户回答。",
  "- 用户可见正文零命理专名（十神/干支报幕/用喜忌/合冲刑害/神煞宫星原名）；传统依据只放 traditional_basis。",
  "- Page 03 图表附录不向用户追问本地真算已掌握的信息；Page 07 仅在适用时追问。",
  "",
  "## 输出",
  "只输出一个 JSON 对象，不要 markdown 围栏：",
  "{",
  '  "current_understanding_narrative": "……",',
  '  "understood_labels": [{"label":"……","fact_ids":["…"]}],',
  '  "need_to_understand": [{"label":"……","priority":"P0|P1|P2","necessity":"required|optional","why_it_matters":"……","related_dir_ids":["…"]}],',
  '  "personal_pattern_insight": {"status":"available|none|unavailable","insights":[{"text":"……","traditional_basis":"……","source_fields":["…"]}]},',
  '  "problem_understanding_assessment": {"statement":"……","supporting_fact_ids":["…"],"unresolved_ambiguities":["…"],"sufficient_proposal":false},',
  '  "desired_outcome_assessment": {"statement":"……","supporting_fact_ids":["…"],"unresolved_ambiguities":["…"],"sufficient_proposal":false},',
  '  "report_coverage_assessment": {"missing_required_sections":["01:A"],"notes":"……"},',
  '  "current_intake_layer": "problem_understanding|desired_outcome|report_details|final_understanding_review",',
  '  "next_question": {"selected_candidate_id":"候选id或null","question_text":"下一题或null","rationale":"简短结论性理由（非推理过程）"},',
  '  "suggested_replies": [{"label":"短标签","value":"完整可发送回答"}, {"label":"…","value":"…"}, {"label":"…","value":"…"}],',
  '  "response_text": "给用户看的自然语言回应（含衔接下题）"',
  "}",
  "若本轮已达充分性、不应再问：next_question.question_text=null 且 selected_candidate_id=null，response_text 做理解确认。",
].join("\n");

function languageLine(locale: string): string {
  const lang = locale.toLowerCase();
  if (lang.startsWith("zh")) return "输出语言：简体中文。";
  if (lang.startsWith("es")) return "Output language: Spanish.";
  if (lang.startsWith("fr")) return "Output language: French.";
  if (lang.startsWith("de")) return "Output language: German.";
  return "Output language: English.";
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* try fence strip */
  }
  const m = /\{[\s\S]*\}/.exec(raw);
  if (!m) return null;
  try {
    const v = JSON.parse(m[0]!) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    return null;
  }
  return null;
}

function asString(v: unknown, max = 4000): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asStringArray(v: unknown, maxItems = 12, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseLayerAssessment(raw: unknown): LayerAssessmentProposal {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    statement: asString(o.statement, 800),
    supporting_fact_ids: asStringArray(o.supporting_fact_ids, 16, 120),
    unresolved_ambiguities: asStringArray(o.unresolved_ambiguities, 12, 200),
    sufficient_proposal: o.sufficient_proposal === true,
  };
}

function validateFactIdsExist(
  ids: string[],
  session: POJUSessionState,
): string[] {
  const known = new Set(
    (session.decision_context?.reality_facts ?? []).map((f) => f.fact_id),
  );
  return ids.filter((id) => known.has(id));
}

function validateOutput(
  raw: Record<string, unknown>,
  legalCandidateIds: Set<string>,
  readinessCanAsk: boolean,
  session: POJUSessionState,
  codeLayer: IntakeLayerFocus | null,
): { ok: true; output: DecisionUnderstandingModelOutput } | { ok: false; reason: string; detail?: string } {
  const narrative = asString(raw.current_understanding_narrative, 2000);
  if (narrative.length < 12) {
    return { ok: false, reason: "empty_narrative" };
  }
  if (/^Decision:\s*/i.test(narrative) || /Open needs:\s*\d+/i.test(narrative)) {
    return { ok: false, reason: "stats_summary_forbidden" };
  }

  const response_text = asString(raw.response_text, 4000);
  if (response_text.length < 8) {
    return { ok: false, reason: "empty_response_text" };
  }

  const repliesRaw = raw.suggested_replies;
  if (!Array.isArray(repliesRaw) || repliesRaw.length !== 3) {
    return { ok: false, reason: "suggested_replies_count" };
  }
  const suggested_replies = repliesRaw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { label: "", value: "" };
    }
    const o = item as Record<string, unknown>;
    const value = asString(o.value ?? o.text ?? o.label, 500);
    const label = asString(o.label, 80) || value.slice(0, 24);
    return { label, value };
  }) as [SuggestedReply, SuggestedReply, SuggestedReply];
  if (suggested_replies.some((r) => !r.value)) {
    return { ok: false, reason: "suggested_replies_empty" };
  }
  const uniq = new Set(suggested_replies.map((r) => r.value.toLowerCase()));
  if (uniq.size < 3) {
    return { ok: false, reason: "suggested_replies_duplicate" };
  }

  const nq = (raw.next_question && typeof raw.next_question === "object"
    ? (raw.next_question as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  let selected =
    typeof nq.selected_candidate_id === "string" ? nq.selected_candidate_id.trim() : null;
  if (selected === "") selected = null;
  let question_text = asString(nq.question_text, 500) || null;
  if (question_text === "") question_text = null;

  if (readinessCanAsk) {
    if (!selected || !legalCandidateIds.has(selected)) {
      return { ok: false, reason: "illegal_candidate", detail: selected ?? "null" };
    }
    if (!question_text) {
      return { ok: false, reason: "empty_question_text" };
    }
  } else {
    selected = null;
    question_text = null;
  }

  const understood_labels = Array.isArray(raw.understood_labels)
    ? raw.understood_labels
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const label = asString(o.label, 200);
          if (!label) return null;
          const fact_ids = validateFactIdsExist(asStringArray(o.fact_ids, 8, 120), session);
          return { label, fact_ids };
        })
        .filter((x): x is { label: string; fact_ids: string[] } => Boolean(x))
        .slice(0, 12)
    : [];

  const need_to_understand = Array.isArray(raw.need_to_understand)
    ? raw.need_to_understand
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const label = asString(o.label, 200);
          if (!label) return null;
          const priority =
            o.priority === "P0" || o.priority === "P1" || o.priority === "P2" ? o.priority : "P1";
          const necessity = o.necessity === "optional" ? "optional" : "required";
          const why_it_matters = asString(o.why_it_matters, 300);
          const related_dir_ids = asStringArray(o.related_dir_ids, 6, 64);
          return { label, priority, necessity, why_it_matters, related_dir_ids };
        })
        .filter(
          (
            x,
          ): x is {
            label: string;
            priority: "P0" | "P1" | "P2";
            necessity: "required" | "optional";
            why_it_matters: string;
            related_dir_ids: string[];
          } => Boolean(x),
        )
        .slice(0, 10)
    : [];

  const ppiRaw =
    raw.personal_pattern_insight && typeof raw.personal_pattern_insight === "object"
      ? (raw.personal_pattern_insight as Record<string, unknown>)
      : {};
  const ppiStatus =
    ppiRaw.status === "available" || ppiRaw.status === "unavailable" || ppiRaw.status === "none"
      ? ppiRaw.status
      : "none";
  const insights = Array.isArray(ppiRaw.insights)
    ? ppiRaw.insights
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const o = item as Record<string, unknown>;
          const text = asString(o.text, 400);
          if (!text) return null;
          return {
            text,
            traditional_basis: asString(o.traditional_basis, 500),
            source_fields: asStringArray(o.source_fields, 8, 80),
          };
        })
        .filter(
          (x): x is { text: string; traditional_basis: string; source_fields: string[] } =>
            Boolean(x),
        )
        .slice(0, 3)
    : [];

  const problem = parseLayerAssessment(raw.problem_understanding_assessment);
  problem.supporting_fact_ids = validateFactIdsExist(problem.supporting_fact_ids, session);
  const desired = parseLayerAssessment(raw.desired_outcome_assessment);
  desired.supporting_fact_ids = validateFactIdsExist(desired.supporting_fact_ids, session);
  const covRaw =
    raw.report_coverage_assessment && typeof raw.report_coverage_assessment === "object"
      ? (raw.report_coverage_assessment as Record<string, unknown>)
      : {};
  const report_coverage_assessment: ReportCoverageAssessmentProposal = {
    missing_required_sections: asStringArray(covRaw.missing_required_sections, 20, 40),
    notes: asString(covRaw.notes, 600),
  };

  let current_intake_layer: IntakeLayerFocus | null = codeLayer;
  const proposedLayer = asString(raw.current_intake_layer, 64);
  if (
    proposedLayer === "problem_understanding" ||
    proposedLayer === "desired_outcome" ||
    proposedLayer === "report_details" ||
    proposedLayer === "final_understanding_review"
  ) {
    // Model may echo layer; code layer remains authoritative for scheduling.
    current_intake_layer = codeLayer ?? proposedLayer;
  }

  return {
    ok: true,
    output: {
      current_understanding_narrative: narrative,
      understood_labels,
      need_to_understand,
      personal_pattern_insight: {
        status: ppiStatus === "available" && insights.length === 0 ? "none" : ppiStatus,
        insights: ppiStatus === "available" ? insights : [],
      },
      problem_understanding_assessment: problem,
      desired_outcome_assessment: desired,
      report_coverage_assessment,
      current_intake_layer,
      next_question: {
        selected_candidate_id: selected,
        question_text,
        rationale: asString(nq.rationale, 400),
      },
      suggested_replies,
      response_text,
    },
  };
}

function emptyAssessment(): LayerAssessmentProposal {
  return {
    statement: "",
    supporting_fact_ids: [],
    unresolved_ambiguities: [],
    sufficient_proposal: false,
  };
}

function buildUserPayload(input: {
  locale: string;
  init_only: boolean;
  user_statement: string;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  previous_plan: AdaptiveQuestionPlan | null;
  code_rank_hint_candidate_id: string | null;
  legal_candidates: LegalUnderstandingCandidate[];
  profile: PersonalProfileContext;
  session: POJUSessionState;
}): string {
  const contract = buildUserFacingExpressionContractBlock({
    locale: input.locale,
    preset: "collecting",
  });
  const history = (input.session.messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => ({
      role: m.role,
      content: String(m.content ?? "").slice(0, 500),
    }));
  const original_question =
    input.session.original_question ||
    input.understanding.current_understanding.decision_question ||
    "";
  const realityFacts = (input.session.decision_context?.reality_facts ?? [])
    .filter(
      (f) =>
        f.verification_level === "user_asserted" &&
        f.status !== "declined" &&
        f.status !== "unknown",
    )
    .slice(0, 24)
    .map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      fact_roles: f.fact_roles,
      related_dir_ids: f.related_dir_ids,
    }));
  const candidatesWithPurpose = input.legal_candidates.map((c) => {
    const purpose = formatReportPurposeForPrompt(c.dir_ids, input.locale);
    return {
      ...c,
      investigation_layer: purpose.layer,
      report_pages: purpose.report_pages,
      report_purpose: purpose.report_purpose,
      required_precondition: purpose.required_precondition,
    };
  });
  const dc = {
    understanding_id: input.understanding.understanding_id,
    decision_question: input.understanding.current_understanding.decision_question,
    code_summary_do_not_copy: input.understanding.current_understanding.summary,
    current_intake_layer: input.understanding.current_intake_layer ?? null,
    intake_layer_gates: input.understanding.intake_layer_gates ?? null,
    report_coverage: input.understanding.report_coverage
      ? {
          missing_required_count:
            input.understanding.report_coverage.missing_required_count,
          optional_missing_count:
            input.understanding.report_coverage.optional_missing_count,
          delivery_ready: input.understanding.report_coverage.delivery_ready,
          reasons: input.understanding.report_coverage.reasons.slice(0, 12),
          items: input.understanding.report_coverage.items.slice(0, 16),
        }
      : null,
    reality_facts_user_asserted: realityFacts,
    understood_items: input.understanding.understood.items.slice(0, 20).map((i) => ({
      label: i.label,
      fact_ids: i.fact_ids,
      status: i.status,
      user_confirmed_any: i.user_confirmed_any,
    })),
    need_items: input.understanding.need_to_understand.items.slice(0, 16).map((n) =>
      n.kind === "dir_based"
        ? {
            kind: n.kind,
            dir_id: n.dir_id,
            priority: n.priority,
            why: n.why,
            missing_content: n.missing_content,
            gap_type: n.gap_type,
          }
        : {
            kind: n.kind,
            ddr_id: n.ddr_id,
            priority: n.priority,
            why: n.why,
          },
    ),
    readiness: input.understanding.readiness,
    budget: {
      session_asked_count: input.understanding.budget.session_asked_count,
      remaining_hard_budget: input.understanding.budget.remaining_hard_budget,
      depth_by_dir: input.understanding.budget.depth_by_dir,
    },
    definition: input.session.decision_context?.definition ?? null,
  };
  return [
    languageLine(input.locale),
    contract,
    "",
    input.init_only
      ? "本轮是 Fresh Session 首问：用户刚提出决策问题。先从 user_statement 提取明确现实信息到 understood_labels（引用 reality_facts_user_asserted 的 fact_ids），再在本层合法候选中自主选题。若期望结果未明，优先期望层候选。"
      : "本轮是用户回答之后：请更新理解（补齐 understood_labels），并在本层合法候选中自主选题。",
    "",
    "original_decision_question:",
    original_question.slice(0, 2000),
    "",
    "user_statement (本轮):",
    input.user_statement.slice(0, 2000),
    "",
    "qa_history (recent):",
    JSON.stringify(history),
    "",
    "legal_candidates (你只能从这些 candidate_id 中选择；含报告页/节映射与用途):",
    JSON.stringify(candidatesWithPurpose),
    "",
    "code_rank_hint_candidate_id (非权威排序参考，可偏离):",
    JSON.stringify(input.code_rank_hint_candidate_id),
    "",
    "previous_plan (上一轮已发送计划，若有；不是本轮必须沿用):",
    JSON.stringify(
      input.previous_plan
        ? {
            candidate_id: input.previous_plan.candidate_id,
            question_text: input.previous_plan.question_text,
            dir_ids: input.previous_plan.dir_ids,
            missing_info: input.previous_plan.missing_info,
          }
        : null,
    ),
    "",
    "decision_understanding_state (代码派生，含 Gate/覆盖；禁止原样输出统计摘要；Gate 由代码裁定):",
    JSON.stringify(dc),
    "",
    "personal_profile (本地真算，禁止改写/补算):",
    JSON.stringify(personalProfileContextForPrompt(input.profile)),
  ].join("\n");
}

export async function generateDecisionUnderstandingTurn(input: {
  session: POJUSessionState;
  understanding: UnderstandingState;
  plan: AdaptiveQuestionPlan | null;
  previous_plan?: AdaptiveQuestionPlan | null;
  code_rank_hint_candidate_id?: string | null;
  legal_candidate_ids: string[];
  legal_candidates: LegalUnderstandingCandidate[];
  locale?: string;
  init_only?: boolean;
  user_statement?: string;
  signal?: AbortSignal;
  testHook?: UnderstandingModelTestHook;
}): Promise<UnderstandingModelResult> {
  const nowIso = new Date().toISOString();
  const profile = buildPersonalProfileContext(input.session, nowIso);
  const locale =
    input.locale?.trim() ||
    input.session.locked_output_locale ||
    "zh";
  const init_only = Boolean(input.init_only);
  const user_statement =
    (input.user_statement ?? "").trim() ||
    input.understanding.current_understanding.decision_question ||
    input.session.original_question ||
    "";
  const legalSet = new Set(input.legal_candidate_ids);
  const readinessCanAsk =
    input.understanding.readiness.can_ask !== false &&
    legalSet.size > 0;
  const startedAt = Date.now();
  const codeLayer = input.understanding.current_intake_layer ?? null;

  const isRealBrowser =
    typeof window !== "undefined" &&
    typeof (globalThis as { process?: { versions?: { node?: string } } }).process
      ?.versions?.node !== "string";
  if (isRealBrowser && !input.testHook) {
    return {
      ok: false,
      reason: "must_run_server_side",
      profile,
      call_meta: {
        source: "openrouter",
        provider: null,
        model: null,
        latency_ms: 0,
      },
    };
  }

  if (profile.personalization_incomplete) {
    return {
      ok: false,
      reason: "profile_incomplete",
      detail: JSON.stringify(profile.field_coverage),
      profile,
      call_meta: {
        source: input.testHook ? "test_hook" : "openrouter",
        provider: null,
        model: null,
        latency_ms: Date.now() - startedAt,
      },
    };
  }

  if (input.testHook) {
    try {
      const hooked = await input.testHook({
        session: input.session,
        understanding: input.understanding,
        plan: input.plan,
        legal_candidate_ids: input.legal_candidate_ids,
        legal_candidates: input.legal_candidates,
        profile,
        locale,
        init_only,
        user_statement,
      });
      const asRaw = hooked as unknown as Record<string, unknown>;
      // Allow slim test hooks that omit new assessment fields.
      if (!("problem_understanding_assessment" in asRaw)) {
        asRaw.problem_understanding_assessment = emptyAssessment();
      }
      if (!("desired_outcome_assessment" in asRaw)) {
        asRaw.desired_outcome_assessment = emptyAssessment();
      }
      if (!("report_coverage_assessment" in asRaw)) {
        asRaw.report_coverage_assessment = {
          missing_required_sections: [],
          notes: "",
        };
      }
      if (!("current_intake_layer" in asRaw)) {
        asRaw.current_intake_layer = codeLayer;
      }
      const validated = validateOutput(
        asRaw,
        legalSet,
        readinessCanAsk,
        input.session,
        codeLayer,
      );
      const call_meta: UnderstandingModelCallMeta = {
        source: "test_hook",
        provider: null,
        model: null,
        latency_ms: Date.now() - startedAt,
      };
      if (!validated.ok) {
        return { ok: false, reason: validated.reason, detail: validated.detail, profile, call_meta };
      }
      return { ok: true, output: validated.output, profile, call_meta };
    } catch (e) {
      return {
        ok: false,
        reason: "test_hook_threw",
        detail: e instanceof Error ? e.message : String(e),
        profile,
        call_meta: {
          source: "test_hook",
          provider: null,
          model: null,
          latency_ms: Date.now() - startedAt,
        },
      };
    }
  }

  try {
    const result = await openRouterChatCompletion({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: buildUserPayload({
            locale,
            init_only,
            user_statement,
            session: input.session,
            understanding: input.understanding,
            plan: input.plan,
            previous_plan: input.previous_plan ?? null,
            code_rank_hint_candidate_id: input.code_rank_hint_candidate_id ?? null,
            legal_candidates: input.legal_candidates,
            profile,
            session: input.session,
          }),
        },
      ],
      json_mode: true,
      route_path: "chat",
      session_id: input.session.session_id,
      locked_provider: input.session.locked_provider ?? null,
      max_tokens: 3200,
      temperature: 0.3,
      timeout_ms: UNDERSTANDING_RESPONSE_TIMEOUT_MS,
      max_attempts: 1,
      reasoning_effort: "medium",
      signal: input.signal,
      call_type: "decision_intake_understanding_response",
      phase_name: "Decision Intake Understanding Response",
    });
    const call_meta: UnderstandingModelCallMeta = {
      source: "openrouter",
      provider: result.provider ?? null,
      model: result.model ?? null,
      latency_ms: Date.now() - startedAt,
    };
    const parsed = parseJsonObject(result.text ?? "");
    if (!parsed) {
      return { ok: false, reason: "invalid_json", profile, call_meta };
    }
    const validated = validateOutput(
      parsed,
      legalSet,
      readinessCanAsk,
      input.session,
      codeLayer,
    );
    if (!validated.ok) {
      return { ok: false, reason: validated.reason, detail: validated.detail, profile, call_meta };
    }
    return { ok: true, output: validated.output, profile, call_meta };
  } catch (e) {
    return {
      ok: false,
      reason: "openrouter_failed",
      detail: e instanceof Error ? e.message : String(e),
      profile,
      call_meta: {
        source: "openrouter",
        provider: null,
        model: null,
        latency_ms: Date.now() - startedAt,
      },
    };
  }
}

/**
 * Merge model Understanding into the code-derived state.
 * Keeps DIR/DDR/layer/coverage structure; replaces user-facing summary / need labels / insights.
 */
export function applyUnderstandingModelToState(
  understanding: UnderstandingState,
  plan: AdaptiveQuestionPlan | null,
  output: DecisionUnderstandingModelOutput,
): { understanding: UnderstandingState; plan: AdaptiveQuestionPlan | null } {
  const needItems = understanding.need_to_understand.items.map((item, idx) => {
    const overlay = output.need_to_understand[idx];
    if (!overlay) return item;
    if (item.kind === "dir_based") {
      return {
        ...item,
        why: overlay.why_it_matters || item.why,
        missing_content: overlay.label || item.missing_content,
      };
    }
    return {
      ...item,
      why: overlay.label || overlay.why_it_matters || item.why,
    };
  });

  const projectedNeeds =
    needItems.length > 0
      ? needItems
      : output.need_to_understand.slice(0, 8).map((n, i) => ({
          kind: "source_only" as const,
          ddr_id: `model_need_${i}`,
          source_code: "model_need",
          source_state: "missing" as const,
          priority: n.priority,
          why: n.label || n.why_it_matters,
          may_affect_p5_ranking: n.priority !== "P2",
          gap_type: "source_pending" as const,
          user_askable: true,
          must_continue: n.necessity === "required",
        }));

  const labelOverlays = output.understood_labels
    .map((item) => ({
      label: (item.label ?? "").trim(),
      fact_ids: (item.fact_ids ?? []).filter((id) => typeof id === "string" && id.trim()),
    }))
    .filter((item) => item.label.length > 0);
  // Merge model labels onto existing Understood DIR items only.
  // Opening user_asserted facts are projected from DC RealityFacts (not invented here).
  const mergedUnderstood = understanding.understood.items.map((item) => {
    const overlay = labelOverlays.find(
      (o) =>
        o.label.toLowerCase() === item.label.trim().toLowerCase() ||
        o.fact_ids.some((id) => item.fact_ids.includes(id)),
    );
    if (!overlay) return item;
    return {
      ...item,
      fact_ids: [...new Set([...item.fact_ids, ...overlay.fact_ids])],
    };
  });

  const ppiInsights = output.personal_pattern_insight.insights.filter(
    (ins) =>
      Boolean(ins.text?.trim()) &&
      Array.isArray(ins.source_fields) &&
      ins.source_fields.length > 0 &&
      Boolean(ins.traditional_basis?.trim()),
  );
  const nextUnderstanding: UnderstandingState = {
    ...understanding,
    // Code gates remain authoritative; keep code layer.
    current_intake_layer: understanding.current_intake_layer,
    current_understanding: {
      ...understanding.current_understanding,
      summary: output.current_understanding_narrative,
      confidence: understanding.current_understanding.confidence,
    },
    understood: { items: mergedUnderstood },
    need_to_understand: { items: projectedNeeds },
    personal_pattern_insight:
      output.personal_pattern_insight.status === "available" && ppiInsights.length > 0
        ? {
            status: "available" as const,
            insights: ppiInsights.map((ins) => ({
              source: ins.source_fields.join(","),
              text: ins.text,
              related_dir_ids: [] as string[],
              epistemic: "traditional_interpretation" as const,
            })),
          }
        : {
            status:
              output.personal_pattern_insight.status === "unavailable"
                ? ("unavailable" as const)
                : ("none" as const),
            insights: [],
            reason:
              output.personal_pattern_insight.status === "unavailable"
                ? "profile_unavailable"
                : ppiInsights.length === 0
                  ? "insufficient_profile_evidence"
                  : "no_new_insight",
          },
  };

  let nextPlan = plan;
  if (
    plan &&
    output.next_question.selected_candidate_id === plan.candidate_id &&
    output.next_question.question_text
  ) {
    nextPlan = {
      ...plan,
      question_text: output.next_question.question_text,
      ask_now_reason: output.next_question.rationale || plan.ask_now_reason,
    };
    nextUnderstanding.next_question_plan = nextPlan;
  }

  return { understanding: nextUnderstanding, plan: nextPlan };
}
