/**
 * Invoke registered Batch2 Inngest handlers in-process (tests / dry-run).
 */

import { reportBatch2InngestFunctions } from "@/lib/inngest/functions/report-batch2";
import { REPORT_BATCH2_EVENTS } from "./events";
import {
  runReportPageApplicabilityInngestStep,
  runReportPageGenerateInngestStep,
  runReportPageOrchestrateInngestStep,
  runReportPageRepairInngestStep,
} from "./handlers";
import { clearBatch2JobMemoryOverlay } from "./job-store";

export const REPORT_BATCH2_FUNCTION_META = [
  { id: "report-page-orchestrator", event: REPORT_BATCH2_EVENTS.ORCHESTRATE },
  { id: "report-page-generate", event: REPORT_BATCH2_EVENTS.GENERATE },
  { id: "report-page-repair", event: REPORT_BATCH2_EVENTS.REPAIR },
  { id: "report-page-applicability", event: REPORT_BATCH2_EVENTS.APPLICABILITY },
] as const;

export type Batch2InvocationRecord = {
  function_id: string;
  event_name: string;
  invocation_id: string;
  started_at: string;
  ended_at: string;
};

const invocationRecords: Batch2InvocationRecord[] = [];
const pendingInvocations: Promise<unknown>[] = [];

export function getBatch2InvocationRecords(): readonly Batch2InvocationRecord[] {
  return invocationRecords;
}

export function resetBatch2InvocationRecords(): void {
  invocationRecords.length = 0;
  pendingInvocations.length = 0;
}

function resolveFunctionId(eventName: string): string | null {
  return (
    REPORT_BATCH2_FUNCTION_META.find((m) => m.event === eventName)?.id ?? null
  );
}

const stepMock = {
  run: async <T>(_name: string, fn: () => Promise<T> | T): Promise<T> => fn(),
};

async function invokeHandlerBody(
  eventName: string,
  data: Record<string, unknown>,
): Promise<unknown> {
  const ctx = { event: { data } };
  switch (eventName) {
    case REPORT_BATCH2_EVENTS.ORCHESTRATE:
      return runReportPageOrchestrateInngestStep(ctx);
    case REPORT_BATCH2_EVENTS.GENERATE:
      return runReportPageGenerateInngestStep(ctx);
    case REPORT_BATCH2_EVENTS.REPAIR:
      return runReportPageRepairInngestStep(ctx);
    case REPORT_BATCH2_EVENTS.APPLICABILITY:
      return runReportPageApplicabilityInngestStep(ctx);
    default:
      throw new Error(`unknown batch2 event: ${eventName}`);
  }
}

export async function invokeRegisteredBatch2Event(input: {
  name: string;
  data: Record<string, unknown>;
  invocation_id: string;
}): Promise<unknown> {
  const function_id = resolveFunctionId(input.name);
  if (!function_id) {
    throw new Error(`no registered Batch2 Function for event ${input.name}`);
  }
  const registered = reportBatch2InngestFunctions.find(
    (fn) => fn.id() === function_id,
  );
  if (!registered) {
    throw new Error(`Batch2 Function ${function_id} is not in reportBatch2InngestFunctions`);
  }

  const report_id = String(input.data.report_id ?? "").trim();
  const generation_id = String(input.data.generation_id ?? "").trim();
  if (report_id && generation_id) {
    // Force durable KV read — no process-local overlay across Worker invocations.
    clearBatch2JobMemoryOverlay(report_id, generation_id);
  }

  const started_at = new Date().toISOString();
  try {
    const result = await stepMock.run(input.name, () =>
      invokeHandlerBody(input.name, input.data),
    );
    return result;
  } finally {
    invocationRecords.push({
      function_id,
      event_name: input.name,
      invocation_id: input.invocation_id,
      started_at,
      ended_at: new Date().toISOString(),
    });
  }
}

function scheduleInvocation(input: {
  name: string;
  data: Record<string, unknown>;
  invocation_id: string;
}): void {
  const work = invokeRegisteredBatch2Event(input).catch((err) => {
    throw err;
  });
  pendingInvocations.push(work);
}

export function createRegisteredBatch2EventSender(): {
  send(
    events: Array<{ name: string; data: Record<string, unknown> }>,
  ): Promise<{ ok: true } | { ok: false; code: string; detail: string }>;
  drain(): Promise<void>;
} {
  return {
    send: async (events) => {
      const crypto = await import("node:crypto");
      for (const e of events) {
        scheduleInvocation({
          name: e.name,
          data: e.data,
          invocation_id: crypto.randomUUID(),
        });
      }
      return { ok: true };
    },
    drain: async () => {
      const deadline = Date.now() + 120_000;
      let quietMs = 0;
      while (Date.now() < deadline) {
        if (pendingInvocations.length > 0) {
          const batch = pendingInvocations.splice(0);
          await Promise.all(batch);
          quietMs = 0;
          continue;
        }
        await new Promise((r) => setTimeout(r, 25));
        quietMs += 25;
        if (quietMs >= 200) break;
      }
    },
  };
}

/** Sanity: meta ids align with registered functions. */
export function assertReportBatch2FunctionRegistration(): void {
  const ids = new Set(reportBatch2InngestFunctions.map((fn) => fn.id()));
  for (const meta of REPORT_BATCH2_FUNCTION_META) {
    if (!ids.has(meta.id)) {
      throw new Error(`missing inngest registration for ${meta.id}`);
    }
  }
}