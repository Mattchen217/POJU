import { NextResponse } from "next/server";
import { baseAnalysisCacheSessionId, pojuCacheSessionId } from "@/lib/llm/cache-session-id";
import {
  buildBreakthroughCorePrompt,
  mapBreakthroughCorePayload,
  parseBreakthroughCoreResponseText,
} from "@/lib/llm/deepseek/breakthrough-core";
import { callLLM } from "@/lib/llm/router";
import { isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";
import { normalizeAgentPhase, type POJUAgentState } from "@/lib/poju/agent-state";

export const maxDuration = 300;

const CORE_MAX_TOKENS_INITIAL = 16_000;
const CORE_MAX_TOKENS_RETRY = 16_000;

class BreakthroughCoreRetryableError extends Error {
  constructor(
    readonly reason: "truncated" | "parse_failed",
    message: string,
  ) {
    super(message);
    this.name = "BreakthroughCoreRetryableError";
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}

function isLooseAgentState(x: unknown): x is POJUAgentState {
  if (!isRecord(x)) return false;
  if (typeof x.current_phase !== "string" || !normalizeAgentPhase(x.current_phase)) return false;
  if (!isRecord(x.context_collected)) return false;
  return true;
}

function resolveProfileId(body: {
  selected_stored_profile_id?: unknown;
  agent_v2?: POJUAgentState | null;
}): string | null {
  if (typeof body.selected_stored_profile_id === "string" && body.selected_stored_profile_id.trim()) {
    return body.selected_stored_profile_id.trim();
  }
  const fromAgent = body.agent_v2?.selected_profile_id;
  if (typeof fromAgent === "string" && fromAgent.trim() && fromAgent !== "active_user_profile") {
    return fromAgent.trim();
  }
  return null;
}

function retryableResponse(reason: "truncated" | "parse_failed", error: string) {
  return NextResponse.json({ ok: false, retryable: true, reason, error }, { status: 200 });
}

async function callCoreLLM(input: {
  system: string;
  userContent: string;
  max_tokens: number;
  sessionId: string;
  profileId: string | null;
}) {
  return callLLM({
    call_type: "deep_analysis",
    system: input.system,
    messages: [{ role: "user", content: input.userContent }],
    max_tokens: input.max_tokens,
    thinking_effort: "xhigh",
    response_format: "json",
    timeout_ms: 180_000,
    session_id: input.profileId
      ? baseAnalysisCacheSessionId(input.profileId)
      : pojuCacheSessionId(input.sessionId),
  });
}

async function fetchCoreContent(input: {
  system: string;
  userContent: string;
  sessionId: string;
  profileId: string | null;
}): Promise<
  | { ok: true; content: string; tokens_used: number; model: string; finish_reason: string | null }
  | { ok: false; reason: "truncated" | "parse_failed"; error: string }
> {
  let result = await callCoreLLM({ ...input, max_tokens: CORE_MAX_TOKENS_INITIAL });
  if (result.meta.finish_reason === "length") {
    console.warn("[breakthrough-core] truncated at 16000, retrying at 16000 (cleaner regen)");
    result = await callCoreLLM({ ...input, max_tokens: CORE_MAX_TOKENS_RETRY });
  }

  const finish = result.meta.finish_reason ?? null;
  if (finish === "length") {
    console.warn("[breakthrough-core] truncated by length cap");
    return {
      ok: false,
      reason: "truncated",
      error: "deep analysis output was truncated",
    };
  }

  try {
    parseBreakthroughCoreResponseText(result.content);
  } catch (e) {
    console.warn("[breakthrough-core] parse failed:", e);
    return {
      ok: false,
      reason: "parse_failed",
      error: "deep analysis JSON was incomplete",
    };
  }

  return {
    ok: true,
    content: result.content,
    tokens_used: result.meta.tokens_used,
    model: result.actual_model,
    finish_reason: finish,
  };
}

export async function POST(req: Request) {
  try {
    if (!isOpenRouterConfigured()) {
      return NextResponse.json(
        { ok: false, error: "OpenRouter is not configured (OPENROUTER_API_KEY)." },
        { status: 503 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      session_id?: unknown;
      original_question?: unknown;
      agent_v2?: unknown;
      base_analysis?: unknown;
      locale?: unknown;
      selected_stored_profile_id?: unknown;
    };

    if (typeof body.session_id !== "string" || !body.session_id.trim()) {
      return NextResponse.json({ ok: false, error: "Missing session_id" }, { status: 400 });
    }
    if (typeof body.original_question !== "string") {
      return NextResponse.json({ ok: false, error: "Missing original_question" }, { status: 400 });
    }

    let agent_v2 = body.agent_v2 === null || body.agent_v2 === undefined ? null : body.agent_v2;
    if (agent_v2 !== null && !isLooseAgentState(agent_v2)) {
      agent_v2 = null;
    }

    const base_analysis =
      body.base_analysis === undefined || body.base_analysis === null ? null : body.base_analysis;

    if (base_analysis == null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "[breakthrough-core] 命主基础分析缺失，无法锚定深测算（必锚命盘）。selected_stored_profile_id=" +
            String(body.selected_stored_profile_id ?? "null"),
        },
        { status: 422 },
      );
    }

    const locale = typeof body.locale === "string" ? body.locale : "en";
    const sessionId = body.session_id.trim();
    const profileId = resolveProfileId({ selected_stored_profile_id: body.selected_stored_profile_id, agent_v2 });

    const { system, user } = buildBreakthroughCorePrompt({
      base_analysis,
      agent_v2: agent_v2 ?? undefined,
      original_question: body.original_question,
      locale,
    });

    const fetched = await fetchCoreContent({
      system,
      userContent: user,
      sessionId,
      profileId,
    });
    if (!fetched.ok) {
      return retryableResponse(fetched.reason, fetched.error);
    }

    const rawContent = fetched.content;
    const tokens_used = fetched.tokens_used;
    const model = fetched.model;

    let mapped: ReturnType<typeof mapBreakthroughCorePayload>;
    try {
      mapped = mapBreakthroughCorePayload(parseBreakthroughCoreResponseText(rawContent));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid breakthrough core payload";
      console.warn("[breakthrough-core] map failed:", msg);
      return retryableResponse("parse_failed", "deep analysis JSON was incomplete");
    }

    return NextResponse.json({
      ok: true,
      breakthrough_core: mapped.breakthrough_core,
      investigation_agenda: mapped.investigation_agenda,
      model,
      tokens_used,
    });
  } catch (e: unknown) {
    if (e instanceof BreakthroughCoreRetryableError) {
      return retryableResponse(e.reason, e.message);
    }
    const msg = e instanceof Error ? e.message : "Breakthrough core failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
