/**
 * Atomic fenced page commit — active + task attempt + page fence + provenance
 * must all pass inside one MemoryKv/Redis transaction before page output is
 * considered authoritative.
 */

import type { ReportPageId, ReportPageRuntimeState } from "../orchestration/types";
import {
  evalTxn,
  isMemoryAtomicAvailable,
  kvGet,
  runMemoryAtomic,
  trackBatch3Key,
  ttlSeconds,
} from "./kv-cas";
import {
  authOutputKey,
  type AuthorityPageOutput,
  writeAuthorityPageOutput,
} from "./auth-output";
import { generationStoreKeys } from "./generation-store";
import { fingerprintsMatch, pageFenceKey } from "./page-fence";
import { persistPageBlobUnderCommittedFence } from "./persist-page-blob";
import type {
  ActiveGenerationPointer,
  Batch3FailCode,
  Batch3Result,
  PageFence,
  PageProvenance,
  TaskRecord,
} from "./types";

function taskKeyPath(
  report_id: string,
  generation_id: string,
  task_key: string,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:task:${task_key}`;
}

function provKey(
  report_id: string,
  generation_id: string,
  page_id: ReportPageId,
): string {
  return `report-batch3:${report_id.trim()}:${generation_id.trim()}:prov:${page_id}`;
}

const FENCED_COMMIT_LUA = `
local activeKey = KEYS[1]
local taskKey = KEYS[2]
local fenceKey = KEYS[3]
local provKey = KEYS[4]
local authOutKey = KEYS[5]
local expectGenId = ARGV[1]
local expectEpoch = tonumber(ARGV[2])
local expectAttempt = ARGV[3]
local expectRev = tonumber(ARGV[4])
local expectInputFp = ARGV[5]
local nextTaskJson = ARGV[6]
local nextFenceJson = ARGV[7]
local nextProvJson = ARGV[8]
local nextAuthOutJson = ARGV[9]
local ttl = tonumber(ARGV[10])

local cur = redis.call("GET", activeKey)
if cur == false or cur == nil then return -1 end
local ok, active = pcall(cjson.decode, cur)
if not ok or not active then return -1 end
if active.generation_id ~= expectGenId or tonumber(active.generation_epoch) ~= expectEpoch then
  return -1
end

local tcur = redis.call("GET", taskKey)
if tcur == false or tcur == nil then return -2 end
local tok, task = pcall(cjson.decode, tcur)
if not tok or not task then return -2 end
if task.attempt_id ~= expectAttempt then return -3 end
if task.status == "completed" then return -4 end
if task.status == "stale" or task.status == "superseded" then return -3 end
if task.status ~= "running" and task.status ~= "repair_pending" then return -5 end
if tonumber(task.validity_rev) ~= expectRev then return -6 end
if task.input_fingerprint ~= expectInputFp then return -7 end

local fcur = redis.call("GET", fenceKey)
if fcur == false or fcur == nil then return -8 end
local fok, fence = pcall(cjson.decode, fcur)
if not fok or not fence then return -8 end
if fence.status == "stale" then return -6 end
if tonumber(fence.validity_rev) ~= expectRev then return -6 end
if tonumber(fence.generation_epoch) ~= expectEpoch then return -1 end

redis.call("SET", taskKey, nextTaskJson, "EX", ttl)
redis.call("SET", fenceKey, nextFenceJson, "EX", ttl)
redis.call("SET", provKey, nextProvJson, "EX", ttl)
redis.call("SET", authOutKey, nextAuthOutJson, "EX", ttl)
return 1
`;

type CommitAuthResult =
  | { ok: true; provenance: PageProvenance; authority_output: AuthorityPageOutput }
  | { ok: false; code: Exclude<Batch3FailCode, "success">; detail: string };

function buildProvenance(
  input: {
    report_id: string;
    generation_id: string;
    generation_epoch: number;
    page_id: ReportPageId;
    attempt_id: string;
    task_key: string;
    output_fingerprint: string;
    validity_rev: number;
  },
  base: Omit<PageProvenance, "stale" | "stale_reason" | "completed_at" | "validity_rev" | "output_fingerprint" | "attempt_id" | "task_key"> & {
    output_fingerprint?: string;
  },
): PageProvenance {
  return {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    input_fingerprint: base.input_fingerprint,
    upstream_output_fingerprints: base.upstream_output_fingerprints,
    page_contract_version: base.page_contract_version,
    prompt_version: base.prompt_version,
    validator_version: base.validator_version,
    output_fingerprint: input.output_fingerprint,
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    validity_rev: input.validity_rev,
    completed_at: new Date().toISOString(),
    stale: false,
    stale_reason: null,
  };
}

function mapLuaCode(code: number): CommitAuthResult {
  if (code === 1) {
    return { ok: false, code: "conflict", detail: "unexpected" };
  }
  if (code === -1) {
    return { ok: false, code: "stale_generation", detail: "active mismatch (lua)" };
  }
  if (code === -2) return { ok: false, code: "not_found", detail: "task missing (lua)" };
  if (code === -3) return { ok: false, code: "stale_attempt", detail: "attempt/status (lua)" };
  if (code === -4) {
    return { ok: false, code: "already_completed", detail: "task completed (lua)" };
  }
  if (code === -5) return { ok: false, code: "conflict", detail: "bad task status (lua)" };
  if (code === -6) return { ok: false, code: "stale_page", detail: "validity_rev/stale (lua)" };
  if (code === -7) return { ok: false, code: "input_mismatch", detail: "input fp (lua)" };
  if (code === -8) return { ok: false, code: "not_found", detail: "fence missing (lua)" };
  return { ok: false, code: "conflict", detail: `lua code=${code}` };
}

function commitAuthorityMemory(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  attempt_id: string;
  task_key: string;
  output_fingerprint: string;
  validity_rev: number;
  output: unknown;
  state_patch: Partial<ReportPageRuntimeState>;
  provenanceBase: Omit<
    PageProvenance,
    "stale" | "stale_reason" | "completed_at" | "validity_rev" | "output_fingerprint" | "attempt_id" | "task_key"
  >;
}): CommitAuthResult {
  const aKey = generationStoreKeys.activeKey(input.report_id);
  const tKey = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = provKey(input.report_id, input.generation_id, input.page_id);
  const oKey = authOutputKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(aKey);
  trackBatch3Key(tKey);
  trackBatch3Key(fKey);
  trackBatch3Key(pKey);
  trackBatch3Key(oKey);

  const provenance = buildProvenance(input, input.provenanceBase);
  const authority_output: AuthorityPageOutput = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: input.validity_rev,
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    output_fingerprint: input.output_fingerprint,
    output: input.output,
    state_patch: input.state_patch,
    completed_at: provenance.completed_at,
  };

  const ran = runMemoryAtomic((ops) => {
    const active = ops.getJson(aKey) as ActiveGenerationPointer | null;
    if (
      !active ||
      active.generation_id !== input.generation_id.trim() ||
      active.generation_epoch !== input.generation_epoch
    ) {
      return {
        ok: false as const,
        code: "stale_generation" as const,
        detail: "active pointer mismatch at atomic commit",
      };
    }

    const task = ops.getJson(tKey) as TaskRecord | null;
    if (!task) {
      return { ok: false as const, code: "not_found" as const, detail: "task missing" };
    }
    if (task.attempt_id !== input.attempt_id) {
      return {
        ok: false as const,
        code: "stale_attempt" as const,
        detail: `attempt ${input.attempt_id} != ${task.attempt_id}`,
      };
    }
    if (task.status === "completed") {
      return {
        ok: false as const,
        code: "already_completed" as const,
        detail: "task already completed",
      };
    }
    if (task.status === "stale" || task.status === "superseded") {
      return {
        ok: false as const,
        code: "stale_attempt" as const,
        detail: `task status=${task.status}`,
      };
    }
    if (task.status !== "running" && task.status !== "repair_pending") {
      return {
        ok: false as const,
        code: "conflict" as const,
        detail: `cannot commit from status=${task.status}`,
      };
    }
    if (task.validity_rev !== input.validity_rev) {
      return {
        ok: false as const,
        code: "stale_page" as const,
        detail: `task validity_rev ${task.validity_rev} != ${input.validity_rev}`,
      };
    }
    if (task.input_fingerprint !== input.provenanceBase.input_fingerprint) {
      return {
        ok: false as const,
        code: "input_mismatch" as const,
        detail: "input_fingerprint mismatch at commit",
      };
    }
    if (
      !fingerprintsMatch(
        task.upstream_output_fingerprints,
        input.provenanceBase.upstream_output_fingerprints,
      )
    ) {
      return {
        ok: false as const,
        code: "input_mismatch" as const,
        detail: "upstream fingerprints mismatch at commit",
      };
    }

    const fence = ops.getJson(fKey) as PageFence | null;
    if (!fence) {
      return { ok: false as const, code: "not_found" as const, detail: "page fence missing" };
    }
    if (fence.status === "stale") {
      return { ok: false as const, code: "stale_page" as const, detail: "fence stale" };
    }
    if (fence.validity_rev !== input.validity_rev) {
      return {
        ok: false as const,
        code: "stale_page" as const,
        detail: `fence validity_rev ${fence.validity_rev} != claim ${input.validity_rev}`,
      };
    }
    if (fence.generation_epoch !== input.generation_epoch) {
      return {
        ok: false as const,
        code: "stale_generation" as const,
        detail: "fence epoch mismatch",
      };
    }

    const now = provenance.completed_at;
    const nextFence: PageFence = {
      ...fence,
      status: "committed",
      attempt_id: input.attempt_id,
      task_key: input.task_key,
      input_fingerprint: input.provenanceBase.input_fingerprint,
      upstream_output_fingerprints: input.provenanceBase.upstream_output_fingerprints,
      output_fingerprint: input.output_fingerprint,
      updated_at: now,
    };
    const nextTask: TaskRecord = {
      ...task,
      status: "completed",
      lease_expires_at: null,
      completed_at: now,
      updated_at: now,
    };

    ops.setJson(fKey, nextFence);
    ops.setJson(pKey, provenance);
    ops.setJson(tKey, nextTask);
    ops.setJson(oKey, authority_output);
    return { ok: true as const, provenance, authority_output };
  });

  if (!ran.ok) return { ok: false, code: ran.code, detail: ran.detail };
  return ran.value;
}

async function commitAuthorityRedis(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  attempt_id: string;
  task_key: string;
  output_fingerprint: string;
  validity_rev: number;
  output: unknown;
  state_patch: Partial<ReportPageRuntimeState>;
  provenanceBase: Omit<
    PageProvenance,
    "stale" | "stale_reason" | "completed_at" | "validity_rev" | "output_fingerprint" | "attempt_id" | "task_key"
  >;
}): Promise<CommitAuthResult> {
  const task = await kvGet<TaskRecord>(
    taskKeyPath(input.report_id, input.generation_id, input.task_key),
  );
  if (!task.ok) return task;
  if (!task.value) return { ok: false, code: "not_found", detail: "task missing" };
  if (
    !fingerprintsMatch(
      task.value.upstream_output_fingerprints,
      input.provenanceBase.upstream_output_fingerprints,
    )
  ) {
    return { ok: false, code: "input_mismatch", detail: "upstream mismatch pre-lua" };
  }

  const provenance = buildProvenance(input, input.provenanceBase);
  const now = provenance.completed_at;
  const authority_output: AuthorityPageOutput = {
    report_id: input.report_id.trim(),
    generation_id: input.generation_id.trim(),
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    validity_rev: input.validity_rev,
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    output_fingerprint: input.output_fingerprint,
    output: input.output,
    state_patch: input.state_patch,
    completed_at: now,
  };
  const fence = await kvGet<PageFence>(
    pageFenceKey(input.report_id, input.generation_id, input.page_id),
  );
  if (!fence.ok) return fence;
  if (!fence.value) return { ok: false, code: "not_found", detail: "fence missing" };

  const nextFence: PageFence = {
    ...fence.value,
    status: "committed",
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    input_fingerprint: input.provenanceBase.input_fingerprint,
    upstream_output_fingerprints: input.provenanceBase.upstream_output_fingerprints,
    output_fingerprint: input.output_fingerprint,
    updated_at: now,
  };
  const nextTask: TaskRecord = {
    ...task.value,
    status: "completed",
    lease_expires_at: null,
    completed_at: now,
    updated_at: now,
  };

  const aKey = generationStoreKeys.activeKey(input.report_id);
  const tKey = taskKeyPath(input.report_id, input.generation_id, input.task_key);
  const fKey = pageFenceKey(input.report_id, input.generation_id, input.page_id);
  const pKey = provKey(input.report_id, input.generation_id, input.page_id);
  const oKey = authOutputKey(input.report_id, input.generation_id, input.page_id);
  trackBatch3Key(oKey);

  const evaled = await evalTxn(
    FENCED_COMMIT_LUA,
    [aKey, tKey, fKey, pKey, oKey],
    [
      input.generation_id.trim(),
      String(input.generation_epoch),
      input.attempt_id,
      String(input.validity_rev),
      input.provenanceBase.input_fingerprint,
      JSON.stringify(nextTask),
      JSON.stringify(nextFence),
      JSON.stringify(provenance),
      JSON.stringify(authority_output),
      String(ttlSeconds()),
    ],
  );
  if (!evaled.ok) return evaled;
  const code = Number(evaled.value);
  if (code === 1) return { ok: true, provenance, authority_output };
  return mapLuaCode(code);
}

export async function commitPageResult(input: {
  report_id: string;
  generation_id: string;
  generation_epoch: number;
  page_id: ReportPageId;
  attempt_id: string;
  task_key: string;
  output: unknown;
  output_fingerprint: string;
  state_patch: Partial<ReportPageRuntimeState>;
  provenance: Omit<
    PageProvenance,
    "stale" | "stale_reason" | "completed_at" | "validity_rev"
  > & {
    completed_at?: string;
    validity_rev?: number;
  };
  /** Test hook: pause after authority commit before blob persist. */
  _test_after_authority?: () => Promise<void> | void;
}): Promise<Batch3Result<{ provenance: PageProvenance }>> {
  let validity_rev = input.provenance.validity_rev;
  if (typeof validity_rev !== "number") {
    const task = await kvGet<TaskRecord>(
      taskKeyPath(input.report_id, input.generation_id, input.task_key),
    );
    if (!task.ok) return task;
    if (!task.value) {
      return { ok: false, code: "not_found", detail: "task missing for validity_rev" };
    }
    validity_rev = task.value.validity_rev;
  }

  const provenanceBase = {
    report_id: input.provenance.report_id,
    generation_id: input.provenance.generation_id,
    generation_epoch: input.provenance.generation_epoch,
    page_id: input.provenance.page_id,
    input_fingerprint: input.provenance.input_fingerprint,
    upstream_output_fingerprints: input.provenance.upstream_output_fingerprints,
    page_contract_version: input.provenance.page_contract_version,
    prompt_version: input.provenance.prompt_version,
    validator_version: input.provenance.validator_version,
  };

  const authInput = {
    report_id: input.report_id,
    generation_id: input.generation_id,
    generation_epoch: input.generation_epoch,
    page_id: input.page_id,
    attempt_id: input.attempt_id,
    task_key: input.task_key,
    output_fingerprint: input.output_fingerprint,
    validity_rev,
    output: input.output,
    state_patch: input.state_patch,
    provenanceBase,
  };

  const auth = isMemoryAtomicAvailable()
    ? commitAuthorityMemory(authInput)
    : await commitAuthorityRedis(authInput);

  if (!auth.ok) return auth;

  // Ensure auth-output exists even if Redis path omitted it somehow
  if (!isMemoryAtomicAvailable()) {
    await writeAuthorityPageOutput(auth.authority_output);
  }

  if (input._test_after_authority) {
    await input._test_after_authority();
  }

  const state: ReportPageRuntimeState = {
    page_id: input.page_id,
    outcome: input.state_patch.outcome ?? "completed",
    output_fingerprint: input.output_fingerprint,
    input_fingerprint:
      input.state_patch.input_fingerprint ??
      input.provenance.input_fingerprint,
    ...input.state_patch,
  };

  // Atomic fence-gated blob persist — invalidation cannot be overwritten by late completed.
  const persisted = await persistPageBlobUnderCommittedFence({
    report_id: input.report_id,
    generation_id: input.generation_id,
    page_id: input.page_id,
    validity_rev,
    attempt_id: input.attempt_id,
    output_fingerprint: input.output_fingerprint,
    state,
    output: input.output,
  });
  if (!persisted.ok) {
    // Authority remains committed; Recovery can replay from auth-output.
    return {
      ok: false,
      code: persisted.code,
      detail: `${persisted.detail} (authority committed; recovery can replay page blob)`,
    };
  }

  return { ok: true, value: { provenance: auth.provenance } };
}
