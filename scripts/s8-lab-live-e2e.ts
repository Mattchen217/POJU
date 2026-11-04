/**
 * S8 — LAB full_pipeline live E2E (real OpenRouter).
 *
 *   pnpm exec tsx scripts/s8-lab-live-e2e.ts
 *
 * Stages: Opening chat → understanding confirm → Call A/B → Collecting →
 * Synthesis → delivery unlock → dump DC/observation evidence.
 * Does NOT merge/deploy. Stage 4 product quality remains unaccepted.
 *
 * Env MUST load before any `@/lib/kv` import (KV client binds at module init).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";
import type { BirthInfo } from "../lib/profile/types";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "temp/s8-live");

function loadEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
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

loadEnvLocal();

function log(msg: string, extra?: unknown) {
  const line = `[s8] ${new Date().toISOString()} ${msg}`;
  console.log(line);
  if (extra !== undefined) console.log(extra);
}

function dump(name: string, payload: unknown) {
  mkdirSync(OUT_DIR, { recursive: true });
  const file = resolve(OUT_DIR, `${name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  log(`wrote ${file}`);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error("OPENROUTER_API_KEY missing in .env.local");
  }
  const kvOk = Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
  );
  if (!kvOk) throw new Error("KV_REST_API_* / UPSTASH_REDIS_REST_* missing — refuse in-memory for S8");

  const { isRemoteKvConfigured } = await import("../lib/kv/memory-kv");
  if (!isRemoteKvConfigured()) {
    throw new Error("isRemoteKvConfigured() false after env load — abort");
  }

  const { calculateProfile } = await import("../lib/calculations/profile");
  const { buildStreamLocalDataFromProfile } = await import(
    "../lib/base-analysis/build-stream-local-data"
  );
  const { createDeliveryLab, loadDeliveryLab, saveDeliveryLab } = await import(
    "../lib/llm/pro/delivery/lab/store"
  );
  const { labContinueAfterDyadGate, runLabPipelineChatTurn } = await import(
    "../lib/llm/pro/delivery/lab/pipeline-chat"
  );
  const {
    labPollPipelineJob,
    labRunSegment2AJob,
    labRunSegment2BJob,
    labRunSynthesisJob,
    labSynthesisConfirm,
    labUnderstandingConfirm,
    labDyadSkip,
  } = await import("../lib/llm/pro/delivery/lab/pipeline-jobs");
  const { derivePipelineCursor } = await import("../lib/llm/pro/delivery/lab/pipeline-cursor");
  const { normalizeAgentPhase } = await import("../lib/poju/agent-state");

  function dcSnap(lab: DeliveryLabSession) {
    const dc = lab.chat_session?.decision_context;
    return {
      lab_id: lab.lab_id,
      cursor: derivePipelineCursor(lab),
      phase: normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase),
      pending_job: lab.pipeline_pending_job ?? null,
      delivery_unlocked: Boolean(lab.pipeline_delivery_unlocked),
      dc: dc
        ? {
            context_id: dc.context_id,
            version: dc.version,
            status: dc.status,
            content_hash: dc.content_hash,
            facts: dc.reality_facts?.length ?? 0,
            constraints: dc.constraints?.length ?? 0,
            hypotheses: dc.hypotheses?.length ?? 0,
            dirs: dc.dirs?.length ?? 0,
            conflicts: dc.conflicts?.length ?? 0,
            definition: dc.definition,
          }
        : null,
      binding:
        lab.chat_session?.last_delivery_context_binding ??
        lab.source.decision_context_binding ??
        null,
      turns: (lab.pipeline_turns ?? []).map((t) => ({
        turn_id: t.turn_id,
        phase: t.phase,
        kind: t.kind,
        gate: t.gate ?? null,
        attempts: (t.attempts ?? []).map((a) => ({
          n: a.attempt_number,
          err: a.error ?? null,
          obs_stage: a.observation?.stage ?? null,
          obs_prompt_chars: a.observation?.prompt
            ? {
                system: a.observation.prompt.system_chars,
                user: a.observation.prompt.user_chars,
                feed: a.observation.prompt.user_feed_chars,
                has_formal_dc: a.observation.prompt.has_formal_dc,
              }
            : null,
          obs_model: a.observation?.model ?? null,
          obs_validation: a.observation?.validation ?? null,
          generation_id:
            a.observation?.generation_id ?? a.call_trace?.meta?.generation_id ?? null,
        })),
      })),
    };
  }

  async function pollUntilIdle(
    lab: DeliveryLabSession,
    opts: { label: string; timeoutMs: number },
  ): Promise<DeliveryLabSession> {
    const t0 = Date.now();
    let working = lab;
    while (working.pipeline_pending_job) {
      if (Date.now() - t0 > opts.timeoutMs) {
        throw new Error(`${opts.label}_timeout stage=${working.pipeline_pending_job.stage}`);
      }
      const stage = working.pipeline_pending_job.stage;
      const jobId = working.pipeline_pending_job.job_id;
      if (stage === "segment2_a") {
        try {
          await labRunSegment2AJob(jobId);
        } catch (e) {
          log(`segment2_a runner warn`, e instanceof Error ? e.message : e);
        }
      } else if (stage === "segment2_b") {
        try {
          await labRunSegment2BJob(jobId);
        } catch (e) {
          log(`segment2_b runner warn`, e instanceof Error ? e.message : e);
        }
      } else if (stage === "synthesis") {
        try {
          await labRunSynthesisJob(jobId);
        } catch (e) {
          log(`synthesis runner warn`, e instanceof Error ? e.message : e);
        }
      }

      const next = await labPollPipelineJob(working);
      if (next !== working) {
        working = next;
        await saveDeliveryLab(working);
        dump(`poll-${opts.label}-${Date.now()}`, dcSnap(working));
        log(`poll advanced`, {
          stage_before: stage,
          stage_after: working.pipeline_pending_job?.stage ?? null,
          cursor: derivePipelineCursor(working),
        });
        continue;
      }
      await sleep(4000);
    }
    return working;
  }

  async function chat(lab: DeliveryLabSession, message: string): Promise<DeliveryLabSession> {
    log(`chat → ${message.slice(0, 80)}`);
    const next = await runLabPipelineChatTurn({ lab, userMessage: message });
    await saveDeliveryLab(next);
    dump(`chat-${Date.now()}`, {
      ...dcSnap(next),
      last_assistant: [...(next.chat_session?.messages ?? [])]
        .reverse()
        .find((m) => m.role === "assistant")
        ?.content?.slice(0, 500),
    });
    return next;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const question =
    "我在北美考虑要不要离开现在的全职工作，去做更有自主权但收入波动更大的独立顾问。家里有房贷，另有一个学龄孩子。请帮我判断近半年该不该动、什么条件下能动。";

  const birth: BirthInfo = {
    year: 1990,
    month: 6,
    day: 15,
    hour_period: "wu",
    hour: 12,
    minute: 30,
    gender: "M",
    timezone: "America/Chicago",
    birth_location: {
      name: "Austin, US",
      latitude: 30.2672,
      longitude: -97.7431,
      timezone: "America/Chicago",
    },
  };

  log("calculating profile / base_analysis…");
  const profile = await calculateProfile(birth);
  const local = buildStreamLocalDataFromProfile(profile, {
    user_input: question,
    output_language: "zh",
  });

  let lab = await createDeliveryLab({
    ops_user: "s8-live",
    mode: "full_pipeline",
    source: {
      locale: "zh",
      original_question: question,
      desired_outcome: "近半年可逆条件下再动；不该动时说清边界",
      base_analysis: { structured: local.structured },
      birth_info: birth,
      breakthrough_core: null,
      covered_agenda: [],
      question_category: "career",
    },
  });
  await saveDeliveryLab(lab);
  dump("00-create", dcSnap(lab));
  log(`created lab_id=${lab.lab_id} open=/ops/delivery-lab/${lab.lab_id}`);

  lab = await chat(
    lab,
    `${question} 现状是公司稳定但晋升停滞，独立顾问已有两个潜在客户口头意向，还没签合同。`,
  );

  const lastAsst = [...(lab.chat_session?.messages ?? [])]
    .reverse()
    .find((m) => m.role === "assistant");
  if (lastAsst?.meta?.dyad_gate_pending || lab.chat_session?.dyad_offer_status === "offered") {
    log("dyad gate → skip solo");
    lab = await labDyadSkip(lab);
    await saveDeliveryLab(lab);
    lab = await labContinueAfterDyadGate(lab);
    await saveDeliveryLab(lab);
    dump("01-dyad-skip", dcSnap(lab));
  }

  for (let i = 0; i < 4; i++) {
    const phase = normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase);
    const cursor = derivePipelineCursor(lab);
    log(`opening loop i=${i} phase=${phase} cursor=${cursor}`);
    if (phase === "awaiting_understanding_confirm" || cursor === "awaiting_understanding") break;
    lab = await chat(
      lab,
      i === 0
        ? "房贷月供大概占家庭税后收入三分之一，储蓄大概还能撑六到八个月。孩子明年要上小学，搬家成本也算进去了。"
        : i === 1
          ? "我更在意可逆性：希望先兼职试水三个月，而不是直接裸辞。如果客户意向落空，还能回到全职路径。"
          : "对，理解方向就是：先验证客户付费意愿，再决定是否缩减全职工时。请确认你抓到的重点。",
    );
  }

  {
    const phase = normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase);
    if (phase !== "awaiting_understanding_confirm") {
      dump("02-opening-stuck", dcSnap(lab));
      throw new Error(`expected awaiting_understanding_confirm, got ${phase}`);
    }
  }

  log("understanding_confirm → Call A");
  {
    const confirmed = await labUnderstandingConfirm(lab);
    lab = confirmed.lab;
    await saveDeliveryLab(lab);
    dump("03-after-understanding", dcSnap(lab));
    if (!confirmed.job_id) throw new Error("understanding_confirm produced no Call A job");
  }

  lab = await pollUntilIdle(lab, { label: "segment2", timeoutMs: 22 * 60_000 });
  dump("04-after-segment2", dcSnap(lab));
  {
    const dc = lab.chat_session?.decision_context;
    if (!dc || dc.status !== "draft") throw new Error("draft DC missing after Call A/B");
    if ((dc.hypotheses?.length ?? 0) < 1) throw new Error("Call A hypotheses not in DC");
    if ((dc.dirs?.length ?? 0) < 1) throw new Error("Call B dirs not in DC");
    log("DC after Call A/B OK", {
      hypotheses: dc.hypotheses.length,
      dirs: dc.dirs.length,
      facts: dc.reality_facts.length,
    });
  }

  const collectingFallbacks = [
    "目前有两个潜在客户：一个是前同事的创业公司要顾问支持，一个是行业社群里认识的人想做兼职咨询。",
    "如果试水三个月后月顾问收入能覆盖房贷一半，我会认真考虑缩减全职；否则继续全职并维持轻量副业。",
    "家人态度偏谨慎，希望我别裸辞；他们能接受先周末接单。",
    "公开表达是获客主渠道，目前没有付费投放；内容基本是行业文章和社群分享。",
    "公司合规上副业有书面限制，试水阶段会避开冲突客户，优先内容引流与离职后签约。",
    "近半年可接受最坏结果是顾问收入为零但仍保住全职；不能接受裸辞后客户全空且储蓄跌破六个月。",
    "主路径：先验证付费意愿再缩工时；辅路径：继续全职+轻量内容获客。信息够了，请进入汇总确认。",
    "请确认主辅路径并进入报告准备，我没有更多补充了。",
  ];
  for (let i = 0; i < 12; i++) {
    const phase = normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase);
    const cursor = derivePipelineCursor(lab);
    log(`collecting i=${i} phase=${phase} cursor=${cursor}`);
    if (phase === "awaiting_confirmation" || cursor === "awaiting_confirmation") break;
    const opts = [...(lab.chat_session?.messages ?? [])]
      .reverse()
      .find((m) => m.role === "assistant" && (m.options?.length ?? 0) > 0)?.options;
    const reply =
      opts?.[0] ?? collectingFallbacks[Math.min(i, collectingFallbacks.length - 1)]!;
    lab = await chat(lab, reply);
  }

  dump("05-after-collecting", dcSnap(lab));

  {
    const phase = normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase);
    if (phase !== "awaiting_confirmation") {
      log("not yet awaiting_confirmation — force one more nudge");
      lab = await chat(lab, "信息够了，请汇总主辅路径，我准备看报告。");
    }
  }

  if (normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase) === "awaiting_confirmation") {
    log("synthesis_confirm");
    const syn = await labSynthesisConfirm(lab);
    lab = syn.lab;
    await saveDeliveryLab(lab);
    dump("06-after-synthesis-kick", dcSnap(lab));
    if (syn.job_id) {
      lab = await pollUntilIdle(lab, { label: "synthesis", timeoutMs: 18 * 60_000 });
    }
  }

  dump("07-final-chat", dcSnap(lab));
  log("S8 chat pipeline finished", {
    lab_id: lab.lab_id,
    cursor: derivePipelineCursor(lab),
    unlocked: lab.pipeline_delivery_unlocked,
    open: `/ops/delivery-lab/${lab.lab_id}`,
  });

  const reloaded = await loadDeliveryLab(lab.lab_id);
  dump("08-reloaded", reloaded ? dcSnap(reloaded) : { missing: true });
}

main().catch((e) => {
  console.error("[s8] FAILED", e);
  try {
    dump("99-error", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
  } catch {
    /* ignore */
  }
  process.exit(1);
});
