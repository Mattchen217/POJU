import "server-only";

import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  BaseAnalysisAuditListItem,
  BaseAnalysisAuditRecord,
} from "@/lib/dev/base-analysis-audit-types";
import type { UserProfile } from "@/lib/profile/types";
import { HOUR_PERIOD_INFO } from "@/lib/profile/types";

export type { BaseAnalysisAuditListItem, BaseAnalysisAuditRecord } from "@/lib/dev/base-analysis-audit-types";

const AUDIT_DIR = path.join(process.cwd(), ".data", "base-analysis-audit");

export function isBaseAnalysisAuditEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.POJU_BASE_ANALYSIS_AUDIT === "1";
}

/** Vercel/serverless 写入的 .data 不跨实例持久化，线上审核台常为空。 */
export function isBaseAnalysisAuditEphemeralOnHost(): boolean {
  return process.env.VERCEL === "1";
}

export function baseAnalysisAuditEnvironmentHint(): string | null {
  if (!isBaseAnalysisAuditEnabled()) {
    return "生产环境默认关闭审核落盘。需在 Vercel 设置 POJU_BASE_ANALYSIS_AUDIT=1，且仅适合调试；正式环境请用本地 pnpm dev 查看 .data/base-analysis-audit/。";
  }
  if (isBaseAnalysisAuditEphemeralOnHost()) {
    return "当前部署在 Vercel：审核 JSON 只写在单次函数实例的临时磁盘，刷新列表可能看不到刚生成的记录。本地开发（pnpm dev）可稳定写入 pojulife/.data/base-analysis-audit/。";
  }
  return null;
}

export function baseAnalysisAuditPagePath(): string {
  return "/base-analysis-audit";
}

function formatBirthSummary(profile: UserProfile): string {
  const b = profile.birth;
  const hour = HOUR_PERIOD_INFO[b.hour_period]?.zh_label ?? b.hour_period;
  const gender = b.gender === "M" ? "男" : "女";
  return `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")} · ${hour} · ${gender} · ${b.timezone}`;
}

function formatFourPillars(profile: UserProfile): string {
  const z = profile.bazi;
  return `${z.yearPillar} ${z.monthPillar} ${z.dayPillar} ${z.hourPillar}`;
}

async function ensureAuditDir(): Promise<void> {
  await mkdir(AUDIT_DIR, { recursive: true });
}

function auditFilePath(id: string): string {
  return path.join(AUDIT_DIR, `${id}.json`);
}

export function buildBirthSummary(profile: UserProfile): string {
  return formatBirthSummary(profile);
}

export async function saveBaseAnalysisAudit(input: {
  user_profile: UserProfile;
  prompts: { system: string; user: string };
  analysis: unknown;
  model: string;
  tokens_used: number;
  stored_profile_id?: string | null;
  display_name?: string | null;
  latency_ms?: number;
  cost_usd?: number;
  reasoning?: string;
  raw_model_text?: string;
}): Promise<BaseAnalysisAuditRecord | null> {
  if (!isBaseAnalysisAuditEnabled()) return null;

  const id = randomUUID();
  const record: BaseAnalysisAuditRecord = {
    id,
    created_at: new Date().toISOString(),
    stored_profile_id: input.stored_profile_id?.trim() || input.user_profile.id || null,
    display_name: input.display_name?.trim() || null,
    birth_summary: formatBirthSummary(input.user_profile),
    user_profile: input.user_profile,
    prompts: input.prompts,
    analysis: input.analysis,
    model: input.model,
    tokens_used: input.tokens_used,
    latency_ms: input.latency_ms,
    cost_usd: input.cost_usd,
    reasoning: input.reasoning,
    raw_model_text: input.raw_model_text,
  };

  await ensureAuditDir();
  await writeFile(auditFilePath(id), JSON.stringify(record, null, 2), "utf8");
  return record;
}

function toListItem(record: BaseAnalysisAuditRecord): BaseAnalysisAuditListItem {
  return {
    id: record.id,
    created_at: record.created_at,
    stored_profile_id: record.stored_profile_id,
    display_name: record.display_name,
    birth_summary: record.birth_summary,
    four_pillars: formatFourPillars(record.user_profile),
    day_master: record.user_profile.diagnosis.dayMaster,
    model: record.model,
    tokens_used: record.tokens_used,
  };
}

export async function listBaseAnalysisAudits(): Promise<BaseAnalysisAuditListItem[]> {
  if (!isBaseAnalysisAuditEnabled()) return [];
  await ensureAuditDir();
  const files = (await readdir(AUDIT_DIR)).filter((f) => f.endsWith(".json"));
  const items: BaseAnalysisAuditListItem[] = [];

  for (const file of files) {
    try {
      const raw = await readFile(path.join(AUDIT_DIR, file), "utf8");
      const record = JSON.parse(raw) as BaseAnalysisAuditRecord;
      items.push(toListItem(record));
    } catch {
      // skip corrupt files
    }
  }

  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items;
}

export async function getBaseAnalysisAudit(id: string): Promise<BaseAnalysisAuditRecord | null> {
  if (!isBaseAnalysisAuditEnabled()) return null;
  const safe = id.replace(/[^a-f0-9-]/gi, "");
  if (!safe || safe !== id) return null;
  try {
    const raw = await readFile(auditFilePath(id), "utf8");
    return JSON.parse(raw) as BaseAnalysisAuditRecord;
  } catch {
    return null;
  }
}
