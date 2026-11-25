/**
 * Batch2 local handler-adapter runtime for tests.
 *
 * IMPORTANT (Batch2 R2): This does NOT execute the Inngest platform Function
 * handler registered via inngest.createFunction. It:
 *  1) asserts the Function id is present in reportBatch2InngestFunctions;
 *  2) invokes the same step body those Functions call (adapter path).
 *
 * Coverage boundary:
 *  - Proves: shared-KV handler collaboration + event→adapter routing
 *  - Does NOT prove: deployed Vercel/Inngest invocation or 300s budgets
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
  { id: "report-page-recovery", event: REPORT_BATCH2_EVENTS.RECOVER },
] as const;

export type Batch2AdapterInvocationRecord = {
  /** Local test adapter id — NOT an Inngest platform run id. */
  adapter_invocation_id: string;
  function_id: string;
  event_name: string;
  started_at: string;
  ended_at: string;
  path: "handler_adapter";
};

/** @deprecated Use Batch2AdapterInvocationRecord — kept for R1 test imports. */
export type Batch2InvocationRecord = Batch2AdapterInvocationRecord;

const invocationRecords: Batch2AdapterInvocationRecord[] = [];
const pendingInvocations: Promise<unknown>[] = [];

export function getBatch2InvocationRecords(): readonly Batch2AdapterInvocationRecord[] {
  return invocationRecords;
}

export function getBatch2AdapterInvocationRecords(): readonly Batch2AdapterInvocationRecord[] {
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

async function invokeHandlerAdapterBody(
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
    case REPORT_BATCH2_EVENTS.RECOVER: {
      const { runReportBatch3Recovery } = await import("../batch3/recovery");
      const report_id = String(data.report_id ?? "").trim();
      const generation_id = String(data.generation_id ?? "").trim();
      const generation_epoch = Number(data.generation_epoch);
      const locale = String(data.locale ?? "en");
      if (!report_id || !generation_id || !Number.isFinite(generation_epoch)) {
        return { skipped: true, reason: "invalid_recover_event" };
      }
      return runReportBatch3Recovery({
        report_id,
        generation_id,
        generation_epoch,
        locale,
      });
    }
    default:
      throw new Error(`unknown batch2 event: ${eventName}`);
  }
}

/**
 * Invoke the shared step body used by registered Functions (adapter path).
 * Does not call Inngest SDK execute / serve.
 */
export async function invokeBatch2HandlerAdapter(input: {
  name: string;
  data: Record<string, unknown>;
  adapter_invocation_id: string;
}): Promise<unknown> {
  const function_id = resolveFunctionId(input.name);
  if (!function_id) {
    throw new Error(`no Batch2 Function meta for event ${input.name}`);
  }
  const registered = reportBatch2InngestFunctions.find(
    (fn) => fn.id() === function_id,
  );
  if (!registered) {
    throw new Error(
      `Batch2 Function ${function_id} is not in reportBatch2InngestFunctions`,
    );
  }

  const report_id = String(input.data.report_id ?? "").trim();
  const generation_id = String(input.data.generation_id ?? "").trim();
  if (report_id && generation_id) {
    clearBatch2JobMemoryOverlay(report_id, generation_id);
  }

  const started_at = new Date().toISOString();
  try {
    return await invokeHandlerAdapterBody(input.name, input.data);
  } finally {
    invocationRecords.push({
      function_id,
      event_name: input.name,
      adapter_invocation_id: input.adapter_invocation_id,
      started_at,
      ended_at: new Date().toISOString(),
      path: "handler_adapter",
    });
  }
}

/** @deprecated Prefer invokeBatch2HandlerAdapter */
export async function invokeRegisteredBatch2Event(input: {
  name: string;
  data: Record<string, unknown>;
  invocation_id: string;
}): Promise<unknown> {
  return invokeBatch2HandlerAdapter({
    name: input.name,
    data: input.data,
    adapter_invocation_id: input.invocation_id,
  });
}

function scheduleAdapter(input: {
  name: string;
  data: Record<string, unknown>;
  adapter_invocation_id: string;
}): void {
  const work = invokeBatch2HandlerAdapter(input);
  pendingInvocations.push(work);
}

export function createBatch2HandlerAdapterEventSender(): {
  send(
    events: Array<{ name: string; data: Record<string, unknown> }>,
  ): Promise<{ ok: true } | { ok: false; code: string; detail: string }>;
  drain(): Promise<void>;
} {
  return {
    send: async (events) => {
      const crypto = await import("node:crypto");
      for (const e of events) {
        scheduleAdapter({
          name: e.name,
          data: e.data,
          adapter_invocation_id: `adapter_${crypto.randomUUID()}`,
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

/** @deprecated Prefer createBatch2HandlerAdapterEventSender */
export function createRegisteredBatch2EventSender(): ReturnType<
  typeof createBatch2HandlerAdapterEventSender
> {
  return createBatch2HandlerAdapterEventSender();
}

export type ReportBatch2FunctionRegistrationCheck = {
  id: string;
  event: string;
  registered: boolean;
  has_id_method: boolean;
};

/** Static/structured check of the four registered Functions (not platform execution). */
export function inspectReportBatch2FunctionRegistration(): ReportBatch2FunctionRegistrationCheck[] {
  const byId = new Map(
    reportBatch2InngestFunctions.map((fn) => [fn.id(), fn] as const),
  );
  return REPORT_BATCH2_FUNCTION_META.map((meta) => {
    const fn = byId.get(meta.id);
    return {
      id: meta.id,
      event: meta.event,
      registered: !!fn,
      has_id_method: typeof fn?.id === "function",
    };
  });
}

export function assertReportBatch2FunctionRegistration(): void {
  for (const row of inspectReportBatch2FunctionRegistration()) {
    if (!row.registered) {
      throw new Error(`missing inngest registration for ${row.id}`);
    }
  }
}

/** Source-level checks: generate vs repair are distinct Functions / events. */
export function assertReportBatch2GenerateRepairSeparation(): void {
  const gen = REPORT_BATCH2_FUNCTION_META.find(
    (m) => m.id === "report-page-generate",
  );
  const repair = REPORT_BATCH2_FUNCTION_META.find(
    (m) => m.id === "report-page-repair",
  );
  if (!gen || !repair) throw new Error("generate/repair meta missing");
  const genId: string = gen.id;
  const repairId: string = repair.id;
  const genEvent: string = gen.event;
  const repairEvent: string = repair.event;
  if (genId === repairId) throw new Error("generate/repair share Function id");
  if (genEvent === repairEvent) {
    throw new Error("generate/repair share the same event name");
  }
  if (genEvent !== REPORT_BATCH2_EVENTS.GENERATE) {
    throw new Error("generate Function must trigger on GENERATE");
  }
  if (repairEvent !== REPORT_BATCH2_EVENTS.REPAIR) {
    throw new Error("repair Function must trigger on REPAIR");
  }
}
