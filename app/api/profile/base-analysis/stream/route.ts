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
  updateJobStatus,
} from "@/lib/base-analysis/job-store";
import { buildBaseAnalysisStreamPrompt } from "@/lib/llm/prompts/base-analysis-stream-prompt";
import { openRouterStream } from "@/lib/llm/openrouter-stream";
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
          send("resumed", {
            job_id: activeJob.job_id,
            from_kv: true,
            accumulated: activeJob.accumulated_content,
            meta: activeJob.meta,
          });
          send("done", { job_id: activeJob.job_id });
          return;
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

        const resetContent = activeJob.status === "failed" || activeJob.status === "pending";
        await updateJobStatus(activeJob.job_id, "streaming", {
          ...(resetContent ? { accumulated_content: "", error: undefined, error_detail: undefined } : {}),
        });

        const { system, user } = buildBaseAnalysisStreamPrompt({
          local_data: body.local_data,
        });

        await openRouterStream({
          system,
          user,
          model: getOpenRouterDefaultModel(),
          max_tokens: 8000,
          temperature: 0.7,
          session_id: baseAnalysisCacheSessionId(profileId),

          onChunk: async (chunk: string) => {
            send("chunk", { text: chunk });
            try {
              await appendChunk(activeJob.job_id, chunk);
            } catch (e) {
              console.error("[base-analysis/stream] KV append failed:", e);
            }
          },

          onDone: async () => {
            const finalJob = await getJob(activeJob.job_id);
            if (!finalJob) return;

            const fullContent = finalJob.accumulated_content;
            const meta = extractMetaFromStreamContent(fullContent);

            await finalizeJob(activeJob.job_id, meta);

            send("done", {
              job_id: activeJob.job_id,
              meta,
              final_length: fullContent.length,
            });

            console.log(
              `[base-analysis/stream] completed ${activeJob.job_id}, length=${fullContent.length}`,
            );
          },

          onError: async (error: string) => {
            await failJob(activeJob.job_id, "llm_error", error);
            send("error", { error });
            console.error(`[base-analysis/stream] failed ${activeJob.job_id}: ${error}`);
          },
        });
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
