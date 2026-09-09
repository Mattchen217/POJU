/**
 * Browser-only: pull Dexie session + stored profile into Delivery Lab create form fields.
 * Server never has these (Never Stored) — must run in the same origin that holds the chat.
 */

import { getPojuDeviceId } from "@/lib/poju/client-device-id";
import { buildCoveredAgendaEvidence } from "@/lib/poju/investigation-agenda";
import {
  listPOJUV4SessionRowsForDevice,
  loadPOJUSession,
} from "@/lib/poju/session-manager";
import { loadSessionProfileBundle } from "@/lib/poju/session-profile";
import { listStoredProfiles, getStoredProfile } from "@/lib/profile/stored-profiles-service";

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
};

export type LabLocalProfileOption = {
  profile_id: string;
  display_name: string;
  has_base_analysis: boolean;
  has_structured: boolean;
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

/** List this browser's POJU sessions (newest first). */
export async function listLocalSessionsForLab(): Promise<LabLocalSessionOption[]> {
  if (typeof window === "undefined") return [];
  const deviceId = getPojuDeviceId();
  const rows = await listPOJUV4SessionRowsForDevice(deviceId);
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(b.last_interaction_at).getTime() - new Date(a.last_interaction_at).getTime(),
  );

  const out: LabLocalSessionOption[] = [];
  for (const row of sorted.slice(0, 40)) {
    const state = await loadPOJUSession(row.session_id);
    const agent = state?.agent_v2;
    const covered = buildCoveredAgendaEvidence(agent);
    out.push({
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
    });
  }
  return out;
}

/** Profiles with base_analysis — chart-only fallback when no full session. */
export async function listLocalProfilesForLab(): Promise<LabLocalProfileOption[]> {
  if (typeof window === "undefined") return [];
  const list = await listStoredProfiles();
  const out: LabLocalProfileOption[] = [];
  for (const p of list.filter((x) => x.has_base_analysis).slice(0, 30)) {
    const data = await getStoredProfile(p.profile_id);
    out.push({
      profile_id: p.profile_id,
      display_name: p.display_name || p.profile_id.slice(0, 8),
      has_base_analysis: true,
      has_structured: tryHasStructured(data?.base_analysis),
    });
  }
  return out;
}

/** Import session → lab create fields (question, agenda, core, base_analysis). */
export async function importLocalSessionForLab(
  session_id: string,
): Promise<{ ok: true; payload: LabImportPayload } | { ok: false; reason: string }> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "browser_only" };
  }
  const state = await loadPOJUSession(session_id.trim());
  if (!state) return { ok: false, reason: "session_not_found_this_browser" };

  const agent = state.agent_v2;
  const warnings: string[] = [];
  if (!agent) {
    warnings.push("无 agent_v2：会话可能未走到收集/综合阶段，agenda/core 会空");
  }

  const { base_analysis, resolved_profile_id } = await loadSessionProfileBundle(state);
  if (base_analysis == null) {
    return {
      ok: false,
      reason: "no_base_analysis_on_bound_profile — 会话未绑定有底座的盘，或本机无该 profile",
    };
  }
  if (!tryHasStructured(base_analysis)) {
    warnings.push("base_analysis 可能缺 structured，bootstrap 会失败");
  }

  const covered_agenda = buildCoveredAgendaEvidence(agent);
  if (covered_agenda.length === 0) {
    warnings.push("covered_agenda 为空：1–3 阶段未收齐或未标 covered，P3/P4 feed 会偏薄");
  }
  if (!agent?.breakthrough_core) {
    warnings.push("无 breakthrough_core：建议先跑完 synthesis/破局核，否则 P3/P4 菜单不全");
  }

  const original_question =
    agent?.original_question?.trim() ||
    state.original_question?.trim() ||
    "";
  if (original_question.length < 2) {
    return { ok: false, reason: "missing_original_question" };
  }

  const desiredRaw = agent?.context_collected?.desired_outcome;
  const desiredFromAgent = typeof desiredRaw === "string" ? desiredRaw : "";
  const desiredFromSession =
    typeof state.context_collected?.desired_outcome === "string"
      ? state.context_collected.desired_outcome
      : "";
  const desired = desiredFromAgent || desiredFromSession || "";

  return {
    ok: true,
    payload: {
      locale: "zh",
      session_id: state.session_id,
      original_question,
      desired_outcome: desired.trim(),
      base_analysis,
      breakthrough_core: agent?.breakthrough_core ?? null,
      covered_agenda,
      warnings: resolved_profile_id
        ? warnings
        : [...warnings, "未解析到 profile_id（仍用到了 base_analysis）"],
    },
  };
}

/** Chart-only: profile base_analysis + manually typed question later. */
export async function importLocalProfileForLab(
  profile_id: string,
): Promise<{ ok: true; payload: LabImportPayload } | { ok: false; reason: string }> {
  if (typeof window === "undefined") {
    return { ok: false, reason: "browser_only" };
  }
  const data = await getStoredProfile(profile_id.trim());
  if (!data?.base_analysis) {
    return { ok: false, reason: "profile_missing_base_analysis" };
  }
  const warnings = [
    "仅导入盘（base_analysis），请自行填写问题/期望；无 agenda/core 时 P3/P4 feed 会弱",
  ];
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
