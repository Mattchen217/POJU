/**
 * M2.4-R2 — shared harness for REAL OpenRouter runs (scripts/** only).
 *
 * - Loads .env.local into unset env vars; never prints values.
 * - No interpretation hooks: handleUserMessage reaches the production
 *   interpreter, whose browser transport posts to /api/poju/answer-interpretation.
 *   That URL is served by the real route handler in-process, which calls
 *   OpenRouter over the network.
 * - Only /api/poju/chat (legacy phase chat, replaced by the adaptive plan
 *   question on intake turns) is stubbed, because no Next server runs here.
 * - OpenRouter traffic is recorded without headers (no API key).
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

export type RecordedOpenRouterCall = {
  at: string;
  via_route: boolean;
  request: {
    model: unknown;
    temperature: unknown;
    max_tokens: unknown;
    response_format: unknown;
    provider_pref: unknown;
    system_prompt_chars: number;
    user_content_excerpt: string;
  };
  response: {
    http_status: number | null;
    provider: string | null;
    model: string | null;
    finish_reason: string | null;
    content: string | null;
    usage: unknown;
    error: string | null;
  };
};

type RouteHandler = (req: Request) => Promise<Response>;

export function installRealFetch(input: {
  routeHandler: RouteHandler;
  chatStubText?: string;
}): { calls: RecordedOpenRouterCall[]; restore: () => void; routeHits: () => number } {
  const originalFetch = globalThis.fetch;
  const calls: RecordedOpenRouterCall[] = [];
  let routeDepth = 0;
  let routeHitCount = 0;
  globalThis.fetch = async (req: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
    if (url === "/api/poju/chat") {
      return new Response(
        JSON.stringify({
          response: input.chatStubText ?? "LEGACY PHASE CHAT STUB — must be replaced by the adaptive plan question",
          collection_progress: "advancing",
          question_status: "asked",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/poju/answer-interpretation") {
      routeHitCount += 1;
      routeDepth += 1;
      try {
        return await input.routeHandler(
          new Request("http://localhost/api/poju/answer-interpretation", {
            method: init?.method ?? "POST",
            headers: init?.headers,
            body: init?.body,
            signal: init?.signal ?? undefined,
          }),
        );
      } finally {
        routeDepth -= 1;
      }
    }
    if (url.startsWith("https://openrouter.ai/")) {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
      const messages = Array.isArray(parsed.messages)
        ? (parsed.messages as Array<{ role?: string; content?: unknown }>)
        : [];
      const system = messages.find((m) => m.role === "system");
      const user = messages.find((m) => m.role === "user");
      const record: RecordedOpenRouterCall = {
        at: new Date().toISOString(),
        via_route: routeDepth > 0,
        request: {
          model: parsed.model,
          temperature: parsed.temperature,
          max_tokens: parsed.max_tokens,
          response_format: parsed.response_format,
          provider_pref: parsed.provider ?? null,
          system_prompt_chars: typeof system?.content === "string" ? system.content.length : 0,
          user_content_excerpt:
            typeof user?.content === "string" ? user.content.slice(0, 4000) : "",
        },
        response: {
          http_status: null,
          provider: null,
          model: null,
          finish_reason: null,
          content: null,
          usage: null,
          error: null,
        },
      };
      calls.push(record);
      try {
        const res = await originalFetch(req, init);
        record.response.http_status = res.status;
        const text = await res.clone().text().catch(() => "");
        try {
          const json = JSON.parse(text) as Record<string, unknown>;
          const choice = Array.isArray(json.choices)
            ? (json.choices[0] as Record<string, unknown> | undefined)
            : undefined;
          const message = choice?.message as Record<string, unknown> | undefined;
          record.response.provider = typeof json.provider === "string" ? json.provider : null;
          record.response.model = typeof json.model === "string" ? json.model : null;
          record.response.finish_reason =
            typeof choice?.finish_reason === "string" ? choice.finish_reason : null;
          record.response.content =
            typeof message?.content === "string" ? message.content : null;
          record.response.usage = json.usage ?? null;
          if (json.error) record.response.error = JSON.stringify(json.error).slice(0, 300);
        } catch {
          record.response.error = `non_json_body:${text.slice(0, 200)}`;
        }
        return res;
      } catch (e) {
        record.response.error = e instanceof Error ? `${e.name}:${e.message}` : String(e);
        throw e;
      }
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    routeHits: () => routeHitCount,
  };
}

type Session = import("../../lib/poju/types").POJUSessionState;

export function lastUserTurnId(s: Session): string | null {
  const u = [...s.messages].reverse().find((m) => m.role === "user" && !m.is_rejected);
  return u?.client_id ?? null;
}

export function lastAssistant(s: Session) {
  return [...s.messages].reverse().find((m) => m.role === "assistant") ?? null;
}

export function snapshot(s: Session) {
  const dc = s.decision_context;
  const u = s.decision_understanding;
  const a = lastAssistant(s);
  const meta = (a?.meta ?? {}) as Record<string, unknown>;
  const m1Meta = Object.fromEntries(
    Object.entries(meta).filter(([k]) => k.startsWith("m1_") || k.startsWith("m21_")),
  );
  return {
    phase: s.agent_v2?.current_phase ?? null,
    dc: dc
      ? {
          context_id: dc.context_id,
          version: dc.version,
          status: dc.status,
          content_hash: dc.content_hash ?? null,
          fact_count: dc.reality_facts.length,
          constraint_count: dc.constraints.length,
          conflict_count: dc.conflicts.length,
        }
      : null,
    blueprint: s.decision_blueprint
      ? {
          version: s.decision_blueprint.blueprint_version,
          decision_question: s.decision_blueprint.decision_question,
          history_len: s.decision_blueprint_history?.length ?? 0,
          change_log_len: s.blueprint_change_log?.length ?? 0,
        }
      : null,
    understanding: u
      ? {
          context_version: u.context_version,
          blueprint_version: u.blueprint_version,
          readiness: u.readiness,
          budget: {
            session_asked_count: u.budget.session_asked_count,
            remaining_hard_budget: u.budget.remaining_hard_budget,
            depth_by_dir: u.budget.depth_by_dir,
            ineffective_plan_ids: u.budget.ineffective_plan_ids ?? [],
          },
          last_sent_question: u.last_sent_question
            ? {
                plan_id: u.last_sent_question.plan_id,
                dir_ids: u.last_sent_question.dir_ids,
                fact_role_codes: u.last_sent_question.fact_role_codes ?? [],
                question_text: u.last_sent_question.question_text,
              }
            : null,
          answered_pending_confirmation: (u.answered_pending_confirmation?.items ?? []).map(
            (i) => ({ dir_id: i.dir_id, statuses: i.answer_statuses, boundary: i.information_boundary }),
          ),
        }
      : null,
    pending_answer_resolution: s.pending_answer_resolution
      ? {
          status: s.pending_answer_resolution.status,
          resolving_item_id: s.pending_answer_resolution.resolving_item_id,
          items: s.pending_answer_resolution.unresolved_items.map((i) => ({
            item_id: i.item_id,
            reason: i.reason,
            status: i.status,
            source_turn_id: i.source_turn_id ?? null,
          })),
          rejected: s.pending_answer_resolution.rejected_items.length,
        }
      : null,
    pending_intake_control: s.pending_intake_control
      ? {
          status: s.pending_intake_control.status,
          items: s.pending_intake_control.items.map((i) => ({
            item_id: i.item_id,
            kind: i.kind,
            status: i.status,
            proposed_decision_target: i.proposed_decision_target ?? null,
          })),
          blueprint_update: s.pending_intake_control.blueprint_update ?? null,
        }
      : null,
    answer_sources: s.intake_answer_sources?.length ?? 0,
    assistant: a ? { content: a.content.slice(0, 600), meta: m1Meta } : null,
  };
}

export function factsFromTurn(s: Session, turnId: string) {
  return (s.decision_context?.reality_facts ?? [])
    .filter((f) => f.source_turn_id === turnId)
    .map((f) => ({
      fact_id: f.fact_id,
      statement: f.statement,
      status: f.status,
      verification_level: f.verification_level,
      roles: f.fact_roles,
      dirs: f.related_dir_ids,
      corrects_fact_ids: f.corrects_fact_ids ?? [],
    }));
}

/** Immutable raw answer + persisted interpretation audit (locators) for one turn. */
export function answerSourceAudit(s: Session, turnId: string) {
  const r = (s.intake_answer_sources ?? []).find((x) => x.source_turn_id === turnId);
  if (!r) return null;
  return {
    raw_user_statement: r.raw_user_statement,
    turn_kind: r.turn_kind,
    sent_question_id: r.sent_question_id,
    authorized_role_codes: r.authorized_role_codes,
    interpretation: r.interpretation
      ? {
          classification: r.interpretation.classification,
          model_provider: r.interpretation.model_provider,
          model: r.interpretation.model,
          writes: r.interpretation.writes.map((w) => ({
            kind: w.kind,
            status: w.status,
            verification_level: w.verification_level,
            role: `${w.dir_id}/${w.fact_role}`,
            corrects_fact_ids: w.corrects_fact_ids,
            locators: w.locators.map((p) => ({
              extracted_text: p.extracted_text,
              source_quote: p.source_quote,
              located: [p.located_start, p.located_end],
            })),
          })),
          rejections: r.interpretation.rejections,
          unresolved: r.interpretation.unresolved,
        }
      : null,
  };
}
