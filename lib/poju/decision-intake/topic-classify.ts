/**
 * Deterministic topic classification for Blueprint init (Phase 2 Topic Applicability).
 * Model may refine later; formal seed only accepts Catalog-validated topic packs.
 * Uncertain → strategic_choice / other (core DDRs only; no fake topic applicability).
 */

import {
  ACTIVE_TOPIC_APPLICABILITY_VERSION,
  loadTopicApplicability,
  type TopicApplicabilityRuleDefinition,
} from "@/lib/poju/decision-context/catalog";

export type TopicTag =
  | "career"
  | "entrepreneurship"
  | "relationship"
  | "relocation"
  | "education"
  | "timing"
  | "strategic_choice"
  | "other";

export type TopicClassifyResult = {
  topic_tags: TopicTag[];
  page_07_emit: boolean;
  topic_dir_ids: string[];
  confidence: "high" | "low";
  classifier: "deterministic_m23_v1";
  notes: string[];
  /** True when no domain tag matched — controlled core-only fallback. */
  used_uncertain_fallback: boolean;
};

const RULES: Array<{ tag: TopicTag; re: RegExp }> = [
  {
    tag: "career",
    re: /离职|跳槽|工作机会|offer|入职|辞职|career|job\b|resign|employer|老板|升职|转岗|雇佣/i,
  },
  {
    tag: "entrepreneurship",
    re: /创业|融资|创业公司|startup|venture|生意|开公司|合伙做|商业模式|runway/i,
  },
  {
    tag: "relationship",
    re: /恋爱|婚姻|分手|结婚|伴侣|配偶|相亲|relationship|boyfriend|girlfriend|离婚|复合/i,
  },
  {
    tag: "relocation",
    re: /搬迁|搬家|移民|出国|签证|relocation|visa|移居|外派|定居/i,
  },
  {
    tag: "education",
    re: /考研|留学|读研|学位|培训|education|degree|硕士|博士|课程|考证/i,
  },
  {
    tag: "timing",
    re: /什么时候|何时|时机|timing|deadline|窗口期|赶在/i,
  },
];

function topicDirsFromRules(
  tags: TopicTag[],
  rules: readonly TopicApplicabilityRuleDefinition[],
): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    for (const rule of rules) {
      if (rule.topic_code === tag && !out.includes(rule.target_dir_id)) {
        out.push(rule.target_dir_id);
      }
    }
  }
  return out;
}

/**
 * Classify decision question (+ optional definition text) into topic tags.
 * Only Catalog topic rules authorize topic DIR seeding.
 */
export function classifyDecisionTopic(input: {
  decision_question: string | null | undefined;
  extra_text?: string | null;
}): TopicClassifyResult {
  const text = [input.decision_question ?? "", input.extra_text ?? ""]
    .join("\n")
    .trim();
  const notes: string[] = [];
  const matched = new Set<TopicTag>();

  if (!text) {
    notes.push("empty_question");
    return {
      topic_tags: ["other"],
      page_07_emit: false,
      topic_dir_ids: [],
      confidence: "low",
      classifier: "deterministic_m23_v1",
      notes,
      used_uncertain_fallback: true,
    };
  }

  for (const rule of RULES) {
    if (rule.re.test(text)) matched.add(rule.tag);
  }

  const domainTagsAll = ([...matched] as TopicTag[]).filter(
    (t): t is Exclude<TopicTag, "timing" | "strategic_choice" | "other"> =>
      t === "career" ||
      t === "entrepreneurship" ||
      t === "relationship" ||
      t === "relocation" ||
      t === "education",
  );
  // Seed one primary topic pack to avoid multi-tag explosion blocking Freeze;
  // notes retain all matched tags for Understanding.
  // career keywords are broad (离职/辞职); prefer more specific domain tags first.
  type DomainTag = (typeof domainTagsAll)[number];
  const PRIMARY_ORDER: DomainTag[] = [
    "entrepreneurship",
    "relationship",
    "relocation",
    "education",
    "career",
  ];
  const primary: DomainTag | undefined =
    PRIMARY_ORDER.find((t) => domainTagsAll.includes(t)) ?? domainTagsAll[0];
  const domainTags = primary ? [primary] : [];
  if (domainTagsAll.length > 1) {
    notes.push(`multi_tag_matched:${domainTagsAll.join(",")};primary:${primary}`);
  }

  const topicLoad = loadTopicApplicability(ACTIVE_TOPIC_APPLICABILITY_VERSION);
  const catalogRules = topicLoad.ok ? topicLoad.rules : [];

  if (domainTags.length === 0) {
    const fallback: TopicTag = matched.has("timing")
      ? "timing"
      : "strategic_choice";
    notes.push("no_domain_tag_matched", `fallback:${fallback}`);
    return {
      topic_tags: [fallback],
      page_07_emit: false,
      topic_dir_ids: [],
      confidence: "low",
      classifier: "deterministic_m23_v1",
      notes,
      used_uncertain_fallback: true,
    };
  }

  if (!topicLoad.ok) {
    notes.push(`topic_catalog_${topicLoad.reason_code}`);
    return {
      topic_tags: domainTags,
      page_07_emit: false,
      topic_dir_ids: [],
      confidence: "low",
      classifier: "deterministic_m23_v1",
      notes,
      used_uncertain_fallback: true,
    };
  }

  const topic_dir_ids = topicDirsFromRules(domainTags, catalogRules);
  // Validate every topic DIR id is authorized by a catalog rule.
  const illegal = topic_dir_ids.filter(
    (id) => !catalogRules.some((r) => r.target_dir_id === id),
  );
  if (illegal.length) {
    notes.push(`illegal_topic_dirs_rejected:${illegal.join(",")}`);
  }
  const legalDirs = topic_dir_ids.filter((id) =>
    catalogRules.some((r) => r.target_dir_id === id),
  );

  const tags: TopicTag[] = [...domainTagsAll];
  if (matched.has("timing") && !tags.includes("timing")) tags.push("timing");

  return {
    topic_tags: tags,
    page_07_emit: legalDirs.length > 0,
    topic_dir_ids: legalDirs,
    confidence: "high",
    classifier: "deterministic_m23_v1",
    notes,
    used_uncertain_fallback: false,
  };
}

/** Reject model-proposed DDR/DIR ids that are not in Catalog. */
export function filterCatalogLegalIds(input: {
  proposed_dir_ids?: readonly string[];
  proposed_ddr_ids?: readonly string[];
  legal_dir_ids: ReadonlySet<string>;
  legal_ddr_ids: ReadonlySet<string>;
}): { dir_ids: string[]; ddr_ids: string[]; rejected: string[] } {
  const rejected: string[] = [];
  const dir_ids: string[] = [];
  const ddr_ids: string[] = [];
  for (const id of input.proposed_dir_ids ?? []) {
    if (input.legal_dir_ids.has(id)) dir_ids.push(id);
    else rejected.push(id);
  }
  for (const id of input.proposed_ddr_ids ?? []) {
    if (input.legal_ddr_ids.has(id)) ddr_ids.push(id);
    else rejected.push(id);
  }
  return { dir_ids, ddr_ids, rejected };
}

