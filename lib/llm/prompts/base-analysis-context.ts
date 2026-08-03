import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import {
  buildCoreJudgmentsFromStructured,
  isCoreJudgments,
  type CoreJudgments,
} from "@/lib/base-analysis/core-judgments";
import { stripRedlineShenshaFromStructured } from "@/lib/glossary/strip-redline-shensha";

/** Normalized base_analysis payload for prompts + local calculations. */
export type BaseAnalysisBundle = {
  structured?: ProfileStructured;
  /** Layer 2 — user-facing narrative. NEVER inject into downstream product prompts. */
  display_text?: string;
  /** Layer 1 — condensed judgments for machines. */
  core_judgments?: CoreJudgments;
  content?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Accepts StoredProfileBaseAnalysis row, legacy content JSON, markdown string, or bundle.
 */
export function normalizeBaseAnalysisInput(input: unknown): BaseAnalysisBundle {
  if (input == null) return {};

  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed ? { content: trimmed, display_text: trimmed } : {};
  }

  if (!isRecord(input)) {
    return { content: input };
  }

  const structured = input.structured as ProfileStructured | undefined;
  const display_text =
    typeof input.display_text === "string" ? input.display_text.trim() : undefined;
  const content = input.content;
  const core_judgments = isCoreJudgments(input.core_judgments)
    ? input.core_judgments
    : undefined;

  if (structured || display_text || core_judgments || "content" in input) {
    return { structured, display_text, core_judgments, content };
  }

  // Legacy v3: whole object is LLM JSON content
  return { content: input };
}

export function hasBaseAnalysisPayload(bundle: BaseAnalysisBundle): boolean {
  if (bundle.structured) return true;
  if (bundle.core_judgments) return true;
  if (bundle.display_text?.trim()) return true;
  if (bundle.content == null) return false;
  if (typeof bundle.content === "string") return bundle.content.trim().length > 0;
  return true;
}

/**
 * How much Step 7 JSON to inject into chat system prompts.
 * Default: full JSON (0 = no truncate). Set POJU_BASE_ANALYSIS_CONTEXT_MAX_CHARS to cap.
 */
export function getBaseAnalysisContextMaxChars(): number {
  const raw = process.env.POJU_BASE_ANALYSIS_CONTEXT_MAX_CHARS?.trim();
  if (!raw || raw === "0") return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function applyMaxChars(text: string): string {
  const max = getBaseAnalysisContextMaxChars();
  if (max > 0 && text.length > max) {
    return `${text.slice(0, max)}\n\n…(能量底座已截断：全文约 ${text.length} 字，仅保留前 ${max} 字。)`;
  }
  return text;
}

/** Recursively sort object keys for byte-stable JSON in prompts. */
function stableSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableSortKeys);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = stableSortKeys(obj[key]);
    }
    return sorted;
  }
  return value;
}

export function stableJsonStringify(value: unknown, indent = 2): string {
  return JSON.stringify(stableSortKeys(value), null, indent);
}

/** Downstream injection banner — neutral base must not be read as scenario typing. */
export const BASE_ANALYSIS_DOWNSTREAM_BANNER_ZH =
  "(以下为中立能量底座 Layer1：structured + core_judgments；不含用户叙事，不得推断具体职业/关系/事件。)";

export const BASE_ANALYSIS_DOWNSTREAM_BANNER_EN =
  "(Neutral Layer-1 energy base: structured + core_judgments—no user narrative; must not infer career, relationship, or events.)";

/**
 * 下游拿【原始真词】—— 不打标。core_judgments 是给机器的中间数据，
 * 真词真算最准；打标是叙事【输出端】给用户时才做的事。
 * （此函数从"打标"降为"透传"，保留签名以免动所有调用点。）
 */
export function softMarkJudgmentsForDownstream(
  judgments: CoreJudgments,
  _locale: string,
): CoreJudgments {
  return judgments;
}

/**
 * Resolve Layer-1 judgments: prefer stored, else expand from structured (deterministic).
 */
export function resolveCoreJudgments(
  bundle: BaseAnalysisBundle,
  locale = "zh",
): CoreJudgments | undefined {
  if (bundle.core_judgments && isCoreJudgments(bundle.core_judgments)) {
    return softMarkJudgmentsForDownstream(bundle.core_judgments, locale);
  }
  if (bundle.structured) {
    return softMarkJudgmentsForDownstream(
      buildCoreJudgmentsFromStructured(bundle.structured, locale),
      locale,
    );
  }
  return undefined;
}

/**
 * Downstream machine context: structured + core_judgments ONLY.
 * Never inject display_text / narrative (prevents metaphor contagion into products).
 */
export function formatBaseAnalysisForPrompt(
  baseAnalysis: unknown,
  locale?: string,
  opts?: { includeInterpretive?: boolean },
): string {
  const bundle = normalizeBaseAnalysisInput(baseAnalysis);
  const loc = locale ?? "zh";
  // 默认 true 保留既有行为；下游有自己问题的功能（POJU 第2段）传 false，
  // 剥掉 6 个 question-blind 解读字段与「以 identity_anchor 为准」锚，只留确定性技术事实。
  const includeInterpretive = opts?.includeInterpretive ?? true;

  if (!hasBaseAnalysisPayload(bundle) && !bundle.structured) {
    return "(能量底座尚未生成，可依据四柱与日主做下游推演。)";
  }

  const banner = loc.startsWith("zh")
    ? BASE_ANALYSIS_DOWNSTREAM_BANNER_ZH
    : BASE_ANALYSIS_DOWNSTREAM_BANNER_EN;

  const parts: string[] = [banner];

  if (bundle.structured) {
    const structuredForDump = includeInterpretive
      ? bundle.structured
      : stripRedlineShenshaFromStructured(bundle.structured);
    parts.push(`## 能量底座·结构数据（Layer1 · structured）

\`\`\`json
${stableJsonStringify(structuredForDump)}
\`\`\``);
  }

  const judgments = resolveCoreJudgments(bundle, loc);
  if (judgments) {
    if (includeInterpretive) {
      parts.push(`## 能量底座·核心判断（Layer1 · core_judgments · 以 structured 为准只展开不改判）

统一开口请以 identity_anchor 为准。

\`\`\`json
${stableJsonStringify(judgments)}
\`\`\``);
    } else {
      // 去锚：只保留确定性技术事实（refs + climate_now），剥离 6 个通用解读字段，
      // 下游自己结合「这个用户的问题」重新解读，不吃底座的 question-blind 读数。
      const {
        identity_anchor: _ia,
        drive_mechanism: _dm,
        structural_gap: _sg,
        balance_anchor: _ba,
        exchange_mode: _em,
        leverage_state: _ls,
        ...factsOnly
      } = judgments;
      void _ia;
      void _dm;
      void _sg;
      void _ba;
      void _em;
      void _ls;
      parts.push(`## 能量底座·技术事实（Layer1 · refs + climate · 确定性 · 无通用解读）

\`\`\`json
${stableJsonStringify(factsOnly)}
\`\`\``);
    }
  }

  // Legacy only if neither structured nor judgments — last resort (may be outdated).
  if (!bundle.structured && !judgments) {
    const legacyJsonOnly =
      bundle.content != null && typeof bundle.content === "object";
    if (legacyJsonOnly) {
      parts.push(`## 能量底座（legacy JSON · 可能过时）

\`\`\`json
${stableJsonStringify(bundle.content)}
\`\`\``);
    } else if (typeof bundle.content === "string" && bundle.content.trim()) {
      // Do NOT inject narrative as machine context — only note readiness gap.
      parts.push(
        loc.startsWith("zh")
          ? "(仅有用户向叙事、缺少 structured/core_judgments；下游勿把叙事当裁定依据。)"
          : "(User narrative only—missing structured/core_judgments; do not treat narrative as rulings.)",
      );
    }
  }

  if (parts.length <= 1 && !bundle.structured && !judgments) {
    return "(能量底座尚未生成，可依据四柱与日主做下游推演。)";
  }

  return applyMaxChars(parts.join("\n\n"));
}

