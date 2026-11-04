/**
 * S8 resume — continue collecting → synthesis → unlock from an existing lab.
 *
 *   pnpm exec tsx scripts/s8-lab-resume-collect.ts lab_xxx
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { DeliveryLabSession } from "../lib/llm/pro/delivery/lab/types";

const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "temp/s8-live");
const LAB_ID = process.argv[2]?.trim();

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
  console.log(`[s8-resume] ${new Date().toISOString()} ${msg}`);
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
  if (!LAB_ID) throw new Error("usage: tsx scripts/s8-lab-resume-collect.ts <lab_id>");
  if (!process.env.OPENROUTER_API_KEY?.trim()) throw new Error("OPENROUTER_API_KEY missing");

  const { loadDeliveryLab, saveDeliveryLab } = await import(
    "../lib/llm/pro/delivery/lab/store"
  );
  const { runLabPipelineChatTurn } = await import("../lib/llm/pro/delivery/lab/pipeline-chat");
  const {
    labPollPipelineJob,
    labRunSynthesisJob,
    labSynthesisConfirm,
  } = await import("../lib/llm/pro/delivery/lab/pipeline-jobs");
  const { derivePipelineCursor } = await import("../lib/llm/pro/delivery/lab/pipeline-cursor");
  const { normalizeAgentPhase } = await import("../lib/poju/agent-state");
  const { isAgendaFullyCovered } = await import("../lib/poju/investigation-agenda");

  function agendaOf(lab: DeliveryLabSession) {
    return lab.chat_session?.agent_v2?.investigation_agenda ?? [];
  }

  function agendaSnap(lab: DeliveryLabSession) {
    const agenda = agendaOf(lab);
    return {
      lab_id: lab.lab_id,
      phase: normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase),
      cursor: derivePipelineCursor(lab),
      unlocked: Boolean(lab.pipeline_delivery_unlocked),
      fully_covered: isAgendaFullyCovered(agenda),
      items: agenda.map((a) => ({
        id: a.id,
        label: a.label,
        status: a.status,
        critical: a.critical,
      })),
      dc: lab.chat_session?.decision_context
        ? {
            status: lab.chat_session.decision_context.status,
            facts: lab.chat_session.decision_context.reality_facts?.length ?? 0,
            constraints: lab.chat_session.decision_context.constraints?.length ?? 0,
            hypotheses: lab.chat_session.decision_context.hypotheses?.length ?? 0,
            dirs: lab.chat_session.decision_context.dirs?.length ?? 0,
          }
        : null,
      binding:
        lab.chat_session?.last_delivery_context_binding ??
        lab.source.decision_context_binding ??
        null,
    };
  }

  let lab = await loadDeliveryLab(LAB_ID);
  if (!lab) throw new Error(`lab_not_found ${LAB_ID}`);
  dump("resume-00-start", agendaSnap(lab));

  const fallbacks = [
    "公开表达是获客主渠道，目前没有付费投放；内容基本是行业文章和社群分享。",
    "配偶支持先周末接单试水，不支持裸辞；若三个月后顾问收入覆盖房贷一半，会一起再议缩减全职。",
    "公司合规上：副业有书面限制，所以试水阶段会避开直接冲突客户，优先用内容引流与离职后签约。",
    "近半年可接受的最坏结果是顾问收入为零但仍保住全职；不能接受的是裸辞后客户全空且储蓄跌破六个月。",
    "主路径倾向：先验证付费意愿再缩工时；辅路径是继续全职+轻量内容获客。信息够了，请进入汇总确认。",
    "请确认主辅路径并进入报告准备，我没有更多补充了。",
  ];

  for (let i = 0; i < 12; i++) {
    const phase = normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase);
    const cursor = derivePipelineCursor(lab);
    const agenda = agendaOf(lab);
    log(`loop i=${i} phase=${phase} cursor=${cursor} covered=${agenda.filter((a) => a.status === "covered").length}/${agenda.length}`);
    dump(`resume-loop-${i}`, agendaSnap(lab));

    if (phase === "awaiting_confirmation" || cursor === "awaiting_confirmation") break;
    if (lab.pipeline_delivery_unlocked) break;

    const opts = [...(lab.chat_session?.messages ?? [])]
      .reverse()
      .find((m) => m.role === "assistant" && (m.options?.length ?? 0) > 0)?.options;
    const reply = opts?.[0] ?? fallbacks[Math.min(i, fallbacks.length - 1)]!;
    log(`chat → ${reply.slice(0, 80)}`);
    lab = await runLabPipelineChatTurn({ lab, userMessage: reply });
    await saveDeliveryLab(lab);
  }

  dump("resume-01-after-collect", agendaSnap(lab));

  if (normalizeAgentPhase(lab.chat_session?.agent_v2?.current_phase) === "awaiting_confirmation") {
    log("synthesis_confirm");
    const syn = await labSynthesisConfirm(lab);
    lab = syn.lab;
    await saveDeliveryLab(lab);
    dump("resume-02-synthesis-kick", agendaSnap(lab));
    if (syn.job_id) {
      const t0 = Date.now();
      while (lab.pipeline_pending_job) {
        if (Date.now() - t0 > 18 * 60_000) throw new Error("synthesis_timeout");
        try {
          await labRunSynthesisJob(lab.pipeline_pending_job.job_id);
        } catch (e) {
          log(`synthesis runner warn`, e instanceof Error ? e.message : e);
        }
        const next = await labPollPipelineJob(lab);
        if (next !== lab) {
          lab = next;
          await saveDeliveryLab(lab);
          dump(`resume-poll-${Date.now()}`, agendaSnap(lab));
          log("poll advanced", {
            pending: lab.pipeline_pending_job,
            unlocked: lab.pipeline_delivery_unlocked,
          });
          continue;
        }
        await sleep(4000);
      }
    }
  } else {
    log("still not awaiting_confirmation after resume loops", agendaSnap(lab));
  }

  dump("resume-03-final", agendaSnap(lab));
  const reloaded = await loadDeliveryLab(LAB_ID);
  dump("resume-04-reloaded", reloaded ? agendaSnap(reloaded) : { missing: true });
  log("done", {
    lab_id: LAB_ID,
    unlocked: reloaded?.pipeline_delivery_unlocked,
    phase: normalizeAgentPhase(reloaded?.chat_session?.agent_v2?.current_phase),
    open: `/ops/delivery-lab/${LAB_ID}`,
  });
}

main().catch((e) => {
  console.error("[s8-resume] FAILED", e);
  process.exit(1);
});
