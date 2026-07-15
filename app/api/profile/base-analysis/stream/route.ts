import { NextRequest } from "next/server";

import { baseAnalysisCacheSessionId } from "@/lib/llm/cache-session-id";
import { extractMetaFromStreamContent } from "@/lib/base-analysis/extract-meta";
import type { BaseAnalysisJob } from "@/lib/base-analysis/job-types";
import {
  acquireLock,
  appendChunk,
  createJob,
  failJob,
  finalizeJob,
  findLatestJobForProfile,
  getJob,
  releaseLock,
  setJobContent,
  updateJobStatus,
} from "@/lib/base-analysis/job-store";
import { auditBaseAnalysisDelivery } from "@/lib/base-analysis/delivery-gate";
import { generateCoreJudgmentsForProfile } from "@/lib/base-analysis/generate-core-judgments";
import { streamBaseAnalysisWithDeliveryGate } from "@/lib/base-analysis/stream-llm-with-gate";
import { applyComplianceSanitize } from "@/lib/llm/sanitize/compliance-terms";
import { getOpenRouterDefaultModel, isOpenRouterConfigured } from "@/lib/llm/openrouter-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** If KV job has not progressed this long, treat as zombie and restart LLM. */
const STALE_STREAMING_MS = 3 * 60 * 1000;

type RequestBody = {
  profile_id: string;
  locale: string;
  local_data: BaseAnalysisJob["local_data"];
  resume_job_id?: string;
};

function sseEncode(encoder: TextEncoder, type: string, data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}

export async function POST(req: NextRequest) {
  if (!isOpenRouterConfigured()) {
    return new Response("OpenRouter is not configured", { status: 503 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.profile_id?.trim() || !body.locale?.trim() || !body.local_data) {
    return new Response("Missing required fields: profile_id, locale, local_data", { status: 400 });
  }

  const profileId = body.profile_id.trim();
  const locale = body.locale.trim();

  console.log("[base-analysis/stream] request:", {
    profile_id: profileId,
    locale,
    has_resume_id: Boolean(body.resume_job_id),
    local_data_preview: {
      output_language: body.local_data.output_language,
      day_master: body.local_data.structured?.day_master,
      da_yun_count: body.local_data.structured?.da_yun?.length,
    },
  });

  let job: BaseAnalysisJob | null = null;
  let lockHeld = false;

  if (body.resume_job_id) {
    const candidate = await getJob(body.resume_job_id);
    if (candidate && candidate.profile_id === profileId) {
      job = candidate;
      console.log(`[base-analysis/stream] resuming job ${job.job_id}, status=${job.status}`);
    }
  }

  if (!job) {
    const latest = await findLatestJobForProfile(profileId);
    if (latest && (latest.status === "streaming" || latest.status === "completed")) {
      job = latest;
      console.log(`[base-analysis/stream] auto-resuming job ${job.job_id}, status=${job.status}`);
    }
  }

  if (!job) {
    const locked = await acquireLock(profileId);
    if (!locked) {
      return new Response("Another analysis is in progress", { status: 409 });
    }
    lockHeld = true;

    try {
      job = await createJob({
        profile_id: profileId,
        locale,
        local_data: body.local_data,
      });
      console.log(`[base-analysis/stream] created new job ${job.job_id}`);
    } catch (e: unknown) {
      await releaseLock(profileId);
      const message = e instanceof Error ? e.message : "Create job failed";
      return new Response(`Create job failed: ${message}`, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const activeJob = job;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (type: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(sseEncode(encoder, type, data));
        } catch {
          // client disconnected
        }
      };

      try {
        if (activeJob.status === "completed") {
          const cached = applyComplianceSanitize(
            activeJob.accumulated_content,
            activeJob.locale,
          ).text;
          const gate = auditBaseAnalysisDelivery(
            cached,
            activeJob.locale,
            body.local_data.structured,
          );
          if (!gate.ok) {
            console.warn(
              `[base-analysis/stream] completed job ${activeJob.job_id} failed delivery gate — regenerating`,
              gate.violations.slice(0, 5),
            );
            await updateJobStatus(activeJob.job_id, "pending", {
              accumulated_content: "",
              error: undefined,
              error_detail: undefined,
            });
          } else {
            send("resumed", {
              job_id: activeJob.job_id,
              from_kv: true,
              accumulated: cached,
              meta: activeJob.meta,
            });
            send("done", { job_id: activeJob.job_id });
            return;
          }
        }

        if (activeJob.status === "streaming") {
          const staleFor = Date.now() - activeJob.updated_at;
          if (staleFor <= STALE_STREAMING_MS) {
            send("resumed_partial", {
              job_id: activeJob.job_id,
              accumulated: activeJob.accumulated_content,
              poll_only: true,
            });
            return;
          }

          console.warn(
            `[base-analysis/stream] stale streaming job ${activeJob.job_id} (${Math.round(staleFor / 1000)}s idle), restarting`,
          );
          await failJob(activeJob.job_id, "stale_stream", "Job stalled without progress");
          await updateJobStatus(activeJob.job_id, "pending", {
            accumulated_content: "",
            error: undefined,
            error_detail: undefined,
          });
        }

        send("start", { job_id: activeJob.job_id });

        const sessionId = baseAnalysisCacheSessionId(profileId);

        // Option ② — independent medium call for Layer-1 interpretive fields (refs from code).
        const cj = await generateCoreJudgmentsForProfile({
          structured: body.local_data.structured,
          locale: activeJob.locale,
          session_id: sessionId,
        });
        send("core_judgments", {
          job_id: activeJob.job_id,
          source: cj.source,
          judgments: cj.judgments,
        });

        const resetContent = activeJob.status === "failed" || activeJob.status === "pending";
        await updateJobStatus(activeJob.job_id, "streaming", {
          ...(resetContent ? { accumulated_content: "", error: undefined, error_detail: undefined } : {}),
        });

        const model = getOpenRouterDefaultModel();
        const gen = await streamBaseAnalysisWithDeliveryGate({
          profileId,
          locale: activeJob.locale,
          structured: body.local_data.structured,
          output_language: body.local_data.output_language,
          session_id: sessionId,
          model,
          max_tokens: 10_000,
          onAttemptStart: async (attempt) => {
            if (attempt > 0) {
              send("reset", { job_id: activeJob.job_id, attempt: attempt + 1 });
              await setJobContent(activeJob.job_id, "");
            }
          },
          onRepairStart: async (repairIndex) => {
            send("reset", {
              job_id: activeJob.job_id,
              attempt: `repair:${repairIndex + 1}`,
              repair: true,
            });
            await setJobContent(activeJob.job_id, "");
            console.warn(
              `[base-analysis/stream] surgical repair ${repairIndex + 1} — clearing draft for ${activeJob.job_id}`,
            );
          },
          onChunk: async (chunk: string) => {
            send("chunk", { text: chunk });
            try {
              await appendChunk(activeJob.job_id, chunk);
            } catch (e) {
              console.error("[base-analysis/stream] KV append failed:", e);
            }
          },
        });

        if (!gen.ok) {
          const detail =
            gen.error === "delivery_gate_failed"
              ? gen.violations.map((v) => v.label).join(", ")
              : gen.error;
          await failJob(activeJob.job_id, gen.error, detail);
          // Layer-1 still delivered so four products keep working even if narrative dies.
          send("error", {
            error: gen.error,
            gate_violations: gen.violations.slice(0, 8),
            core_judgments: cj.judgments,
            core_judgments_source: cj.source,
          });
          console.error(`[base-analysis/stream] failed ${activeJob.job_id}: ${detail}`);
          return;
        }

        await setJobContent(activeJob.job_id, gen.content);

        const glossed = gen.content;
        const meta = {
          ...extractMetaFromStreamContent(glossed),
          core_judgments: cj.judgments,
          core_judgments_source: cj.source,
          gate_attempts: gen.attempts,
          gate_repairs: gen.repairs,
        };

        await finalizeJob(activeJob.job_id, meta);

        send("done", {
          job_id: activeJob.job_id,
          meta,
          final_length: glossed.length,
          sanitized: true,
          gate_attempts: gen.attempts,
          gate_repairs: gen.repairs,
        });

        console.log(
          `[base-analysis/stream] completed ${activeJob.job_id}, length=${glossed.length}, attempts=${gen.attempts}, repairs=${gen.repairs}, cj=${cj.source}`,
        );
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "stream_error";
        console.error("[base-analysis/stream] outer error:", e);
        await failJob(activeJob.job_id, "stream_error", message);
        send("error", { error: message });
      } finally {
        if (lockHeld) {
          await releaseLock(profileId).catch(() => {});
        }
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
