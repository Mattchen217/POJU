import { detectComplianceViolations } from "@/lib/llm/sanitize/compliance-terms";

export type SyncroHourAdviceCell = {
  short_advice: string;
  detailed_advice: string;
  rationale: string;
};

export type SyncroOutputViolation = {
  category: "compliance" | "syncro_framing" | "prediction" | "internal_key";
  label: string;
  snippet: string;
};

const INTERNAL_KEYS_BLACKLIST = [
  "qimen",
  "yong_shen_direction",
  "yongShen",
  "yong_shen",
  "hour_yong_shen",
  "day_master_direction",
  "dayMaster",
  "day_master",
  "hour_pillar",
  "key_factors",
  "task_direction",
];

const ZH_QIMEN_FENGSHUI_REGEX =
  /奇门|遁甲|八门|九星|三奇六仪|飞宫|风水|罗盘|吉凶时辰/g;
const ZH_JIXIONG_REGEX = /大吉|大凶|上吉|下凶|吉利|不利|吉运|凶运|好运|会成功|必成功|一定成功/g;
const ZH_SHICHEN_FORTUNE_REGEX = /吉时|凶时|良辰|凶辰/g;

const EN_QIMEN_FENGSHUI_REGEX =
  /\b(?:qimen|dunjia|feng\s*shui|divination\s+board|oracle\s+compass)\b/gi;
const EN_AUSPICIOUS_REGEX = /\b(?:auspicious|ominous|good\s+luck|bad\s+luck|lucky|unlucky)\b/gi;

const EN_PREDICTION_PATTERNS: RegExp[] = [
  /\bwill\s+succeed\b/i,
  /\bwill\s+bring\s+(?:you\s+)?(?:luck|success)\b/i,
  /\bbrings?\s+(?:you\s+)?(?:luck|good\s+luck)\b/i,
  /\bthis\s+time\s+will\s+bring\b/i,
  /\bguaranteed\s+(?:success|outcome|win)\b/i,
  /\bdestined\s+to\s+(?:win|succeed)\b/i,
  /\bfortune\s+favors\b/i,
];

const ZH_PREDICTION_PATTERNS: RegExp[] = [
  /会成功|必将成功|一定成功|必成|带来好运|带来吉利|财运亨通|必定顺利/,
  /此时.*必|此向.*必/,
];

function snippetAround(text: string, index: number, len: number): string {
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + len + 24);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function pushRegex(
  text: string,
  regex: RegExp,
  category: SyncroOutputViolation["category"],
  label: string,
  out: SyncroOutputViolation[],
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    out.push({
      category,
      label,
      snippet: snippetAround(text, match.index, match[0].length),
    });
  }
}

function pushPatterns(
  text: string,
  patterns: RegExp[],
  category: SyncroOutputViolation["category"],
  labelPrefix: string,
  out: SyncroOutputViolation[],
): void {
  for (const p of patterns) {
    const flags = p.flags.includes("g") ? p.flags : `${p.flags}g`;
    const regex = new RegExp(p.source, flags);
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      out.push({
        category,
        label: labelPrefix,
        snippet: snippetAround(text, match.index, match[0].length),
      });
    }
  }
}

function collectInternalKeyViolations(text: string, out: SyncroOutputViolation[]): void {
  for (const key of INTERNAL_KEYS_BLACKLIST) {
    const re = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      out.push({
        category: "internal_key",
        label: `internal:${key}`,
        snippet: snippetAround(text, match.index, match[0].length),
      });
    }
  }
  if (/主要因素[：:]/i.test(text) || /key factors[：:]/i.test(text)) {
    out.push({
      category: "internal_key",
      label: "key_factors_phrase",
      snippet: snippetAround(text, text.search(/主要因素|key factors/i), 20),
    });
  }
}

/** Detect Syncro user-visible copy violations (audit only). */
export function detectSyncroOutputViolations(text: string, locale = "en"): SyncroOutputViolation[] {
  if (!text?.trim()) return [];

  const violations: SyncroOutputViolation[] = [];
  const isZh = locale.startsWith("zh");

  for (const cv of detectComplianceViolations(text, locale)) {
    violations.push({
      category: "compliance",
      label: cv.label,
      snippet: cv.snippet,
    });
  }

  if (isZh) {
    pushRegex(text, ZH_QIMEN_FENGSHUI_REGEX, "syncro_framing", "qimen_fengshui", violations);
    pushRegex(text, ZH_JIXIONG_REGEX, "syncro_framing", "jixiong_luck", violations);
    pushRegex(text, ZH_SHICHEN_FORTUNE_REGEX, "syncro_framing", "fortune_shichen", violations);
    pushPatterns(text, ZH_PREDICTION_PATTERNS, "prediction", "prediction_zh", violations);
  } else {
    pushRegex(text, EN_QIMEN_FENGSHUI_REGEX, "syncro_framing", "qimen_fengshui", violations);
    pushRegex(text, EN_AUSPICIOUS_REGEX, "syncro_framing", "auspicious_ominous", violations);
    pushPatterns(text, EN_PREDICTION_PATTERNS, "prediction", "prediction_en", violations);
  }

  collectInternalKeyViolations(text, violations);

  const seen = new Set<string>();
  return violations.filter((v) => {
    const key = `${v.category}:${v.label}:${v.snippet}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function logSyncroOutputViolations(
  violations: SyncroOutputViolation[],
  context = "syncro-output",
): void {
  if (violations.length === 0) return;
  console.error(`[${context}] Syncro OUTPUT FRAMING violations (${violations.length}):`, violations);
}

export function auditSyncroText(text: string, locale: string, context?: string): SyncroOutputViolation[] {
  const violations = detectSyncroOutputViolations(text, locale);
  if (violations.length > 0) {
    logSyncroOutputViolations(violations, context ?? "syncro-audit");
  }
  return violations;
}

/** Audit-only — returns text unchanged. */
export function sanitizeSyncroText(text: string, locale: string): string {
  auditSyncroText(text, locale, "syncro-sanitize");
  return text;
}

export function auditSyncroHourAdvice(
  advice: Record<string, SyncroHourAdviceCell>,
  locale: string,
): SyncroOutputViolation[] {
  const all: SyncroOutputViolation[] = [];
  for (const [key, cell] of Object.entries(advice)) {
    for (const field of ["short_advice", "detailed_advice", "rationale"] as const) {
      const text = cell[field];
      if (!text) continue;
      const hits = detectSyncroOutputViolations(text, locale);
      for (const h of hits) {
        all.push({ ...h, label: `${key}.${field}:${h.label}` });
      }
    }
  }
  if (all.length > 0) {
    logSyncroOutputViolations(all, "syncro-hour-audit");
  }
  return all;
}

/** Audit-only — returns advice unchanged. */
export function sanitizeSyncroHourAdvice(
  advice: Record<string, SyncroHourAdviceCell>,
  locale: string,
): Record<string, SyncroHourAdviceCell> {
  auditSyncroHourAdvice(advice, locale);
  return advice;
}
