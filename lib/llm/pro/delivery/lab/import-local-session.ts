/**
 * Browser-only: pull Dexie session + stored profile into Delivery Lab create form.
 * Ops scan ignores owner_key / device_id filters — same-browser guest vs login
 * partitions often hid "empty" lists even when disks existed.
 */

import { decryptJson } from "@/lib/crypto";
import { getPojuDb } from "@/lib/db/poju-db";
import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import { ensureSessionCycles } from "@/lib/poju/cycle-manager";
import type { StoredProfileData } from "@/lib/db/poju-db";
import type { POJUSessionState } from "@/lib/poju/types";
import { resolveLocalOwnerKey } from "@/lib/storage/local-owner";

const SESSION_SECRET = "pojulife_v4_poju_session";
const STORED_PROFILES_SECRET = "pojulife_v4_stored_profiles";

export type LabLocalScanMeta = {
  owner_key: string;
  device_id: string;
  origin: string;
  session_rows_total: number;
  profile_rows_total: number;
  profiles_with_base: number;
};

export type LabLocalSessionOption = {
  session_id: string;
  original_question: string;
  status: string;
  phase: string | null;
  last_interaction_at: string;
  has_agent_v2: boolean;
  has_breakthrough_core: boolean;
  covered_agenda_count: number;
  profile_id: string | null;
  owner_key: string | null;
  device_id: string;
  owner_mismatch: boolean;
};

export type LabLocalProfileOption = {
  profile_id: string;
  display_name: string;
  has_base_analysis: boolean;
  has_structured: boolean;
  owner_key: string | null;
  owner_mismatch: boolean;
};

export type LabImportPayload = {
  locale: string;
  session_id: string;
  original_question: string;
  desired_outcome: string;
  base_analysis: unknown;
  breakthrough_core: unknown | null;
  covered_agenda: Array<{ label: string; answer?: string }>;
  warnings: string[];
};

export type LabLocalLists = {
  sessions: LabLocalSessionOption[];
  profiles: LabLocalProfileOption[];
  meta: LabLocalScanMeta;
};

function tryHasStructured(base: unknown): boolean {
  if (!base || typeof base !== "object") return false;
  const o = base as Record<string, unknown>;
  const s = (o.structured ?? o) as Record<string, unknown>;
  return (
    typeof s.yong_shen === "string" ||
    Array.isArray(s.da_yun) ||
    (s.pillars_detail != null && typeof s.pillars_detail === "object")
  );
}

async function decryptSessionRow(row: {
  session_id: string;
  iv: string;
  encrypted_data: string;
}): Promise<POJUSessionState | null> {
  try {
    const raw = await decryptJson<POJUSessionState>(SESSION_SECRET, {
      iv: row.iv,
      cipher: row.encrypted_data,
    });
    return ensureSessionCycles(raw);
  } catch {
    return null;
  }
}

async function decryptProfileRow(row: {
  profile_id: string;
  iv: string;
  encrypted_data: string;
}): Promise<StoredProfileData | null> {
  try {
    return await decryptJson<StoredProfileData>(STORED_PROFILES_SECRET, {
      iv: row.iv,
      cipher: row.encrypted_data,
    });
  } catch {
    return null;
  }
}

/** Ops scan: all IndexedDB sessions/profiles on this origin (not owner-filtered). */
export async function listLocalDataForLab(): Promise<LabLocalLists> {
  if (typeof window === "undefined") {
    return {
      sessions: [],
      profiles: [],
      meta: {
        owner_key: "",
        device_id: "",
        origin: "",
        session_rows_total: 0,
        profile_rows_total: 0,
        profiles_with_base: 0,
      },
    };
  }

  const db = getPojuDb();
  const owner_key = await resolveLocalOwnerKey();
  const device_id = getPojuDeviceId();
  const sessionRows = await db.pojuSessionRecords.toArray();
  const profileRows = await db.stored_profiles.toArray();

  const sessions: LabLocalSessionOption[] = [];
  const sortedSessions = [...sessionRows].sort(
    (a, b) =>
      new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime(),
  );

  for (const row of sortedSessions.slice(0, 50)) {
    const state = await decryptSessionRow(row);
    const agent = state?.agent_v2;
    const covered = buildCoveredAgendaEvidence(agent);
    const rowOwner = row.owner_key?.trim() || null;
    sessions.push({
      session_id: row.session_id,
      original_question: row.original_question || state?.original_question || "(无题)",
      status: row.status,
      phase: agent?.current_phase ?? row.current_state_hint ?? null,
      last_interaction_at: new Date(row.last_interaction_at).toISOString(),
      has_agent_v2: Boolean(agent),
      has_breakthrough_core: Boolean(agent?.breakthrough_core),
      covered_agenda_count: covered.length,
      profile_id:
        state?.selected_stored_profile_id?.trim() ||
        agent?.selected_profile_id?.trim() ||
        null,
      owner_key: rowOwner,
      device_id: row.device_id,
      owner_mismatch: Boolean(rowOwner && rowOwner !== owner_key),
    });
  }

  const profiles: LabLocalProfileOption[] = [];
  let profiles_with_base = 0;
  for (const row of profileRows.slice(0, 40)) {
    const data = await decryptProfileRow(row);
    const hasBase = Boolean(data?.base_analysis) || Boolean(row.has_base_analysis);
    if (hasBase) profiles_with_base += 1;
    if (!hasBase) continue;
    const rowOwner = row.owner_key?.trim() || null;
    profiles.push({
      profile_id: row.profile_id,
      display_name: row.display_name || row.profile_id.slice(0, 8),
      has_base_analysis: true,
      has_structured: tryHasStructured(data?.base_analysis),
      owner_key: rowOwner,
      owner_mismatch: Boolean(rowOwner && rowOwner !== owner_key),
    });
  }

  return {
    sessions,
    profiles,
    meta: {
      owner_key,
      device_id,
      origin: window.location.origin,
      session_rows_total: sessionRows.length,
      profile_rows_total: profileRows.length,
      profiles_with_base,
    },
  };
}

/** @deprecated use listLocalDataForLab */
export async function listLocalSessionsForLab(): Promise<LabLocalSessionOption[]> {
  return (await listLocalDataForLab()).sessions;
}

/** @deprecated use listLocalDataForLab */
export async function listLocalProfilesForLab(): Promise<LabLocalProfileOption[]> {
  return (await listLocalDataForLab()).profiles;
}

async function loadBaseAnalysisForSession(
  state: POJUSessionState,
): Promise<{ base_analysis: unknown | null; resolved_profile_id: string | null }> {
  const ids = [
    state.selected_stored_profile_id,
    state.agent_v2?.selected_profile_id,
    state.matrix_payload?.profile_id,
  ]
    .map((x) => x?.trim())
    .filter((x): x is string => Boolean(x));

  const db = getPojuDb();
  for (const id of ids) {
    const row = await db.stored_profiles.get(id);
    if (!row) continue;
    const data = await decryptProfileRow(row);
    if (data?.base_analysis != null) {
      return { base_analysis: data.base_analysis, resolved_profile_id: id };
    }
  }

  // Fallback: any profile with structured on this browser
  const all = await db.stored_profiles.toArray();
  for (const row of all) {
    const data = await decryptProfileRow(row);
    if (data?.base_analysis != null && tryHasStructured(data.base_analysis)) {
      return { base_analysis: data.base_analysis, resolved_profile_id: row.profile_id };
    }
  }

  return { base_analysis: null, resolved_profile_id: null };
}

const CONFIRM_CHIP_RE =
  /^(?:确认并继续|可以[，,、]?\s*没有补充了|没有补充了|补充并修正|我还要补充|Confirm and continue|Yes,?\s*nothing more to add|好的?|可以|行|继续|ok|yes)[。！!？?…~]*$/i;

function normalizeCmp(s: string): string {
  return s.replace(/\s+/g, "").replace(/[，。！？、—\-·…]/g, "").toLowerCase();
}

/** First substantive user message (opening narrative), skipping chips / system. */
function firstUserNarrative(state: POJUSessionState): string {
  for (const m of state.messages ?? []) {
    if (m.role !== "user") continue;
    const t = (m.content ?? "").trim();
    if (!t || t === "__OPENING__" || t.startsWith("[SYSTEM:")) continue;
    if (CONFIRM_CHIP_RE.test(t)) continue;
    if (t.length < 12) continue;
    return t;
  }
  return "";
}

/**
 * Resolve question vs desired for Lab import.
 * Opening locks `opening_problem_statement` into agent.original_question — often a
 * direction/outcome sentence. Prefer first user narrative when locked ≈ desired.
 */
function resolveImportQuestions(state: POJUSessionState): {
  original_question: string;
  desired_outcome: string;
  locked_problem: string;
  first_user_narrative: string;
  warnings: string[];
} {
  const agent = state.agent_v2;
  const warnings: string[] = [];
  const locked =
    agent?.original_question?.trim() ||
    state.original_question?.trim() ||
    state.cycles?.[0]?.original_question?.trim() ||
    "";
  const desiredRaw = agent?.context_collected?.desired_outcome;
  const desiredFromAgent = typeof desiredRaw === "string" ? desiredRaw.trim() : "";
  const desiredFromSession =
    typeof state.context_collected?.desired_outcome === "string"
      ? state.context_collected.desired_outcome.trim()
      : "";
  let desired = desiredFromAgent || desiredFromSession;
  const narrative = firstUserNarrative(state);

  const lockedN = normalizeCmp(locked);
  const desiredN = normalizeCmp(desired);
  const lockedLooksLikeDesire =
    Boolean(lockedN) &&
    Boolean(desiredN) &&
    (desiredN.includes(lockedN) ||
      lockedN.includes(desiredN) ||
      (lockedN.length >= 8 && desiredN.startsWith(lockedN.slice(0, Math.min(24, lockedN.length)))));

  let original_question = locked;
  if (lockedLooksLikeDesire && narrative.length > locked.length + 20) {
    original_question = narrative;
    warnings.push(
      "第1阶段开局把 opening_problem_statement 锁进了 original_question，内容很像「期望/方向」。Lab 已改用首条用户叙述作问题；交付正式链路仍可能用锁定句——可手工改回。",
    );
    if (!desired) desired = locked;
  } else if (!original_question && narrative) {
    original_question = narrative;
    warnings.push("无锁定问题，用了首条用户叙述");
  }

  if (!desired && lockedLooksLikeDesire) desired = locked;

  return {
    original_question,
    desired_outcome: desired,
    locked_problem: locked,
    first_user_narrative: narrative,
    warnings,
  };
}

export async function importLocalSessionForLab(
  session_id: string,
): Promise<{ ok: true; payload: LabImportPayload } | { ok: false; reason: string }> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "browser_only" };
  }

  const row = await getPojuDb().pojuSessionRecords.get(session_id.trim());
  if (!row) return { ok: false, reason: "session_not_found_this_origin" };

  const state = await decryptSessionRow(row);
  if (!state) return { ok: false, reason: "session_decrypt_failed" };

  const agent = state.agent_v2;
  const warnings: string[] = [];
  const ownerNow = await resolveLocalOwnerKey();
  if (row.owner_key && row.owner_key !== ownerNow) {
    warnings.push(
      `会话 owner=${row.owner_key}，当前登录分区=${ownerNow}（已强制读取，可继续测）`,
    );
  }
  if (!agent) {
    warnings.push("无 agent_v2：会话可能未走到收集/综合阶段，agenda/core 会空");
  }

  const { base_analysis, resolved_profile_id } = await loadBaseAnalysisForSession(state);
  if (base_analysis == null) {
    return {
      ok: false,
      reason:
        "no_base_analysis — 会话未绑定盘，且本机 IndexedDB 也没有带 structured 的 stored_profiles",
    };
  }
  if (!tryHasStructured(base_analysis)) {
    warnings.push("base_analysis 可能缺 structured，bootstrap 会失败");
  }
  if (resolved_profile_id && !idsInclude(state, resolved_profile_id)) {
    warnings.push(`用了回退盘 profile=${resolved_profile_id.slice(0, 8)}…（会话未绑定该盘）`);
  }

  const covered_agenda = buildCoveredAgendaEvidence(agent);
  if (covered_agenda.length === 0) {
    warnings.push("covered_agenda 为空：1–3 阶段未收齐，P3/P4 feed 会偏薄");
  }
  if (!agent?.breakthrough_core) {
    warnings.push("无 breakthrough_core：P3/P4 菜单会不全");
  }

  const q = resolveImportQuestions(state);
  warnings.push(...q.warnings);
  if (q.original_question.length < 2) {
    return { ok: false, reason: "missing_original_question" };
  }
  if (q.locked_problem && q.locked_problem !== q.original_question) {
    warnings.push(`会话锁定句（交付默认）: 「${q.locked_problem.slice(0, 48)}…」`);
  }

  return {
    ok: true,
    payload: {
      locale: "zh",
      session_id: state.session_id,
      original_question: q.original_question,
      desired_outcome: q.desired_outcome,
      base_analysis,
      breakthrough_core: agent?.breakthrough_core ?? null,
      covered_agenda,
      warnings,
    },
  };
}

function idsInclude(state: POJUSessionState, profileId: string): boolean {
  const ids = [
    state.selected_stored_profile_id,
    state.agent_v2?.selected_profile_id,
    state.matrix_payload?.profile_id,
  ]
    .map((x) => x?.trim())
    .filter(Boolean);
  return ids.includes(profileId);
}

export async function importLocalProfileForLab(
  profile_id: string,
): Promise<{ ok: true; payload: LabImportPayload } | { ok: false; reason: string }> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "browser_only" };
  }
  const row = await getPojuDb().stored_profiles.get(profile_id.trim());
  if (!row) return { ok: false, reason: "profile_not_found_this_origin" };
  const data = await decryptProfileRow(row);
  if (!data?.base_analysis) {
    return { ok: false, reason: "profile_missing_base_analysis" };
  }
  const warnings = [
    "仅导入盘（base_analysis），请自行填写问题/期望；无 agenda/core 时 P3/P4 feed 会弱",
  ];
  const ownerNow = await resolveLocalOwnerKey();
  if (row.owner_key && row.owner_key !== ownerNow) {
    warnings.push(`盘 owner=${row.owner_key}，当前分区=${ownerNow}`);
  }
  if (!tryHasStructured(data.base_analysis)) {
    warnings.push("缺 structured");
  }
  return {
    ok: true,
    payload: {
      locale: "zh",
      session_id: `profile-${profile_id}`,
      original_question: "",
      desired_outcome: "",
      base_analysis: data.base_analysis,
      breakthrough_core: null,
      covered_agenda: [],
      warnings,
    },
  };
}
