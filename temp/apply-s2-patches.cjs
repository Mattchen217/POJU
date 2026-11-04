#!/usr/bin/env node
/**
 * Phase 3 S2 — patch existing pojulife files + install tests/docs.
 * Usage: node temp/apply-s2-patches.cjs D:\POJU\pojulife
 */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();

function read(rel) {
  // Normalize CRLF → LF so patch needles match across Windows checkouts.
  return fs.readFileSync(path.join(root, rel), "utf8").replace(/\r\n/g, "\n");
}
function write(rel, body) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  // Keep LF in repo sources (prettier / cross-platform).
  fs.writeFileSync(full, body.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel, body.length);
}
function mustInclude(body, needle, label) {
  if (!body.includes(needle)) throw new Error(`missing needle in ${label}: ${needle.slice(0, 80)}`);
}
function replaceOnce(body, from, to, label) {
  const i = body.indexOf(from);
  if (i < 0) throw new Error(`replaceOnce miss in ${label}: ${from.slice(0, 100)}`);
  const j = body.indexOf(from, i + 1);
  if (j >= 0) throw new Error(`replaceOnce ambiguous in ${label}`);
  return body.slice(0, i) + to + body.slice(i + from.length);
}

// ---------- types.ts ----------
{
  let body = read("lib/poju/types.ts");
  const needle = `  decision_context_idempotency_keys?: string[];
}`;
  mustInclude(body, needle, "types.ts");
  if (!body.includes("generation_task_contexts")) {
    body = replaceOnce(
      body,
      needle,
      `  decision_context_idempotency_keys?: string[];
  /**
   * Phase 3 S2 — async Generation TaskContext rows (Contract §6).
   * Hydrate to [] on create/load when absent.
   */
  generation_task_contexts?: import("./generation").GenerationTaskContext[];
  /**
   * Phase 3 S2 — completed-only Generation Registry (Contract §5.1).
   */
  generation_registry?: import("./generation").GenerationRegistryEntry[];
  /**
   * Phase 3 S2 — Generation Operation Bindings by idempotency_key (Contract §5.2).
   */
  generation_operation_bindings?: import("./generation").GenerationOperationBinding[];
}`,
      "types.ts",
    );
    write("lib/poju/types.ts", body);
  } else {
    console.log("skip types.ts (already patched)");
  }
}

// ---------- session-mutation.ts ----------
{
  let body = read("lib/poju/session-mutation.ts");
  if (!body.includes("generation_base_revision?: number;") || !body.includes("mutation.generation_base_revision")) {
    // Add field on SessionMutation
    const mutNeedle = `  bump_dc?: boolean | "auto";
}`;
    // SessionMutation interface ends with bare `}` (no semicolon).
    if (!/interface SessionMutation[\s\S]*?generation_base_revision\?: number/.test(body)) {
      body = replaceOnce(
        body,
        mutNeedle,
        `  bump_dc?: boolean | "auto";
  /**
   * Phase 3 S2 — Path A / pending_create DC base gate (Contract §6.3 step 8 / §7.3).
   * Passed through to casWritePOJUSession; mismatch → GENERATION_BASE_STALE.
   */
  generation_base_revision?: number;
}`,
        "session-mutation SessionMutation",
      );
    }
    // Pass through in mutatePOJUSession write() call
    const writeCall = `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
      });`;
    const writeCallNew = `      return await write({
        candidate,
        expected_session_revision: mirror.session_revision,
        expected_dc_write_revision: mirror.dc_write_revision,
        bump_dc_write_revision: bumpDc,
        ...(mutation.generation_base_revision !== undefined
          ? { generation_base_revision: mutation.generation_base_revision }
          : {}),
      });`;
    if (body.includes(writeCall)) {
      body = replaceOnce(body, writeCall, writeCallNew, "mutate passthrough");
    } else if (!body.includes("mutation.generation_base_revision !== undefined")) {
      throw new Error("mutate write() call shape changed — update patch");
    }
    write("lib/poju/session-mutation.ts", body);
  } else {
    console.log("skip session-mutation passthrough (already patched)");
  }
}

// ---------- persist.ts generation_guarded ----------
{
  let body = read("lib/poju/decision-context/persist.ts");
  if (!body.includes('generation_guarded')) {
    body = replaceOnce(
      body,
      `export interface BeginPersistOptions {
  idempotency_key: string;
  now?: string;
}`,
      `export type PersistGuardMode = "idempotent_first" | "generation_guarded";

export interface BeginPersistOptions {
  idempotency_key: string;
  now?: string;
  /**
   * Phase 3 S2 / Mapping §4.6:
   * - idempotent_first (default): Phase 2 key-only early return
   * - generation_guarded: skip key-only early return so collision/Path A/B/C run first
   */
  mode?: PersistGuardMode;
}`,
      "BeginPersistOptions",
    );
    body = replaceOnce(
      body,
      `export function beginPersistTransaction(
  current: DcSessionSlice,
  opts: BeginPersistOptions,
): PersistTransaction | null {
  if (hasCompletedKey(current, opts.idempotency_key)) {
    return null;
  }`,
      `export function beginPersistTransaction(
  current: DcSessionSlice,
  opts: BeginPersistOptions,
): PersistTransaction | null {
  // Mapping §4.6 — generation_guarded must not key-skip before collision checks.
  if (opts.mode !== "generation_guarded" && hasCompletedKey(current, opts.idempotency_key)) {
    return null;
  }`,
      "beginPersistTransaction",
    );
    body = replaceOnce(
      body,
      `export async function commitPersistTransaction(
  tx: PersistTransaction,
  writeBlob: PersistBlobWriter,
  opts?: {
    /** When false, skip control-plane presence check (DC-only ops). */
    require_control_plane?: boolean;
  },
): Promise<CommitPersistResult> {
  if (hasCompletedKey(tx.snapshot.session, tx.idempotency_key)) {
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: false,
      error: "idempotent_skip",
    };
  }`,
      `export async function commitPersistTransaction(
  tx: PersistTransaction,
  writeBlob: PersistBlobWriter,
  opts?: {
    /** When false, skip control-plane presence check (DC-only ops). */
    require_control_plane?: boolean;
    /** Mapping §4.6 — must match begin mode for Generation. */
    mode?: PersistGuardMode;
  },
): Promise<CommitPersistResult> {
  // Mapping §4.6 — fix BOTH begin and commit key-only early returns.
  if (
    opts?.mode !== "generation_guarded" &&
    hasCompletedKey(tx.snapshot.session, tx.idempotency_key)
  ) {
    return {
      session: cloneSlice(tx.snapshot.session),
      committed: false,
      rolled_back: false,
      error: "idempotent_skip",
    };
  }`,
      "commitPersistTransaction",
    );
    write("lib/poju/decision-context/persist.ts", body);
  } else {
    console.log("skip persist.ts (already patched)");
  }
}

// ---------- session-manager.ts hydrate defaults ----------
{
  let body = read("lib/poju/session-manager.ts");
  if (!body.includes("generation_task_contexts")) {
    // createPOJUSession defaults — after unlock_status
    body = replaceOnce(
      body,
      `    unlock_status: "preview",
  };

  // Phase 3 S1`,
      `    unlock_status: "preview",
    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
  };

  // Phase 3 S1`,
      "createPOJUSession defaults",
    );
    // loadPOJUSession hydrate — find hydratePersistIdempotencyFromKeys block near load
    const loadNeedle = `  hydratePersistIdempotencyFromKeys(
    state.session_id,
    state.decision_context_idempotency_keys,
  );`;
    // Might have different formatting - search
    if (!body.includes("generation_task_contexts: state.generation_task_contexts")) {
      // After load decrypt / before return — look for common pattern
      const markers = [
        "  // Phase 2 C1 restore: DC is authority; hydrate durable idempotency keys.",
      ];
      let patched = false;
      for (const m of markers) {
        if (body.includes(m)) {
          // loadPOJUSession uses `raw` then ensureSessionCycles — hydrate on withCycles path via applyDecisionContextRestore wrapper below if marker present.
          body = replaceOnce(
            body,
            m,
            "  // Phase 3 S2 — hydrate Generation arrays (Contract §3.2 defaults).\n" +
              "  if (!Array.isArray(withCycles.generation_task_contexts)) withCycles.generation_task_contexts = [];\n" +
              "  if (!Array.isArray(withCycles.generation_registry)) withCycles.generation_registry = [];\n" +
              "  if (!Array.isArray(withCycles.generation_operation_bindings)) {\n" +
              "    withCycles.generation_operation_bindings = [];\n" +
              "  }\n\n" +
              "  // Phase 2 C1 restore: DC is authority; hydrate durable idempotency keys.",
            "load hydrate generation",
          );
          patched = true;
          break;
        }
      }
      if (!patched) {
        // Fallback: after decision_context restore comment near load return
        console.warn("WARN: load hydrate marker not found — check session-manager manually");
      }
    }
    write("lib/poju/session-manager.ts", body);
  } else {
    console.log("skip session-manager (already patched)");
  }
}

// ---------- xhigh-job-types.ts ----------
{
  let body = read("lib/poju/xhigh-job-types.ts");
  if (!body.includes("client_task_id")) {
    body = replaceOnce(
      body,
      `export interface PojuXhighJob {
  job_id: string;
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  status: PojuXhighJobStatus;`,
      `export interface PojuXhighJob {
  job_id: string;
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  status: PojuXhighJobStatus;
  /**
   * Phase 3 S2 — create identity for Job recovery (Contract §22 / Mapping §2.4 / S0).
   * Persisted inside the job record BEFORE ack; authority for reverse lookup.
   */
  client_task_id?: string;
  /** Optional generation identity mirrors (best-effort; Job record is authority). */
  generation_type?: "call_a_hypothesis" | "call_b_dir";
  fingerprint?: string;
  fingerprint_version?: string;`,
      "PojuXhighJob fields",
    );
    body = replaceOnce(
      body,
      `export function xhighSessionLatestKey(phase: PojuXhighJobPhase, session_id: string): string {
  return \`poju-xhigh:latest:\${phase}:\${session_id}\`;
}`,
      `export function xhighSessionLatestKey(phase: PojuXhighJobPhase, session_id: string): string {
  return \`poju-xhigh:latest:\${phase}:\${session_id}\`;
}

/** Rebuildable (non-authoritative) index — Mapping §2.4 / S0 recovery. */
export function xhighClientTaskKey(
  phase: PojuXhighJobPhase,
  session_id: string,
  client_task_id: string,
): string {
  return \`poju-xhigh:client_task:\${phase}:\${session_id}:\${client_task_id}\`;
}`,
      "xhighClientTaskKey",
    );
    write("lib/poju/xhigh-job-types.ts", body);
  } else {
    console.log("skip xhigh-job-types (already patched)");
  }
}

// ---------- xhigh-job-store.ts ----------
{
  let body = read("lib/poju/xhigh-job-store.ts");
  if (!body.includes("getXhighJobByClientTaskId")) {
    const oldImport = `import {
  generateXhighJobId,
  type PojuXhighJob,
  type PojuXhighJobPhase,
  type PojuXhighJobStatus,
  xhighJobKey,
  xhighSessionLatestKey,
  xhighSessionLockKey,
} from "@/lib/poju/xhigh-job-types";`;
    const newImport = `import {
  generateXhighJobId,
  type PojuXhighJob,
  type PojuXhighJobPhase,
  type PojuXhighJobStatus,
  xhighClientTaskKey,
  xhighJobKey,
  xhighSessionLatestKey,
  xhighSessionLockKey,
} from "@/lib/poju/xhigh-job-types";

export { xhighClientTaskKey };`;
    body = replaceOnce(body, oldImport, newImport, "job-store imports");

    const oldCreateStart = "export async function createXhighJob(input: {";
    const oldCreateEnd = "export async function getXhighJob(job_id: string): Promise<PojuXhighJob | null> {";
    const i0 = body.indexOf(oldCreateStart);
    const i1 = body.indexOf(oldCreateEnd);
    if (i0 < 0 || i1 < 0 || i1 <= i0) throw new Error("createXhighJob block not found");

    const newCreate = `export async function createXhighJob(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  locale: string;
  job_input: PojuXhighJob["input"];
  /** Phase-4: stamp deploy generation so redeploy can kill orphaned continues. */
  deploy_generation?: string;
  /**
   * Phase 3 S2 — stable client create identity (Contract §22 / Mapping §2.4).
   * When set, create is idempotent: same identity returns the existing job (no blind retry).
   */
  client_task_id?: string;
  generation_type?: PojuXhighJob["generation_type"];
  fingerprint?: string;
  fingerprint_version?: string;
}): Promise<PojuXhighJob> {
  const client_task_id =
    typeof input.client_task_id === "string" && input.client_task_id.trim()
      ? input.client_task_id.trim()
      : undefined;

  // Check existing identity BEFORE generateXhighJobId — never second job for same identity.
  if (client_task_id) {
    const existing = await getXhighJobByClientTaskId({
      phase: input.phase,
      session_id: input.session_id,
      client_task_id,
    });
    if (existing.status === "found") {
      return existing.job;
    }
    if (existing.status === "recovery_required") {
      throw new Error(
        "XHIGH_JOB_RECOVERY_REQUIRED: ambiguous client_task_id=" +
          client_task_id +
          " phase=" +
          input.phase,
      );
    }
  }

  const job: PojuXhighJob = {
    job_id: generateXhighJobId(input.phase, input.session_id),
    phase: input.phase,
    session_id: input.session_id,
    locale: input.locale,
    status: "pending",
    accumulated_content: "",
    input: input.job_input,
    ...(client_task_id ? { client_task_id } : {}),
    ...(input.generation_type ? { generation_type: input.generation_type } : {}),
    ...(input.fingerprint ? { fingerprint: input.fingerprint } : {}),
    ...(input.fingerprint_version ? { fingerprint_version: input.fingerprint_version } : {}),
    ...(input.deploy_generation?.trim()
      ? { deploy_generation: input.deploy_generation.trim() }
      : {}),
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  // Job record is authority — persist identity inside job BEFORE ack.
  await kv.set(xhighJobKey(job.job_id), job, { ex: KV_TTL.POJU_XHIGH_JOB });
  await kv.set(xhighSessionLatestKey(input.phase, input.session_id), job.job_id, {
    ex: KV_TTL.POJU_XHIGH_JOB,
  });
  if (client_task_id) {
    // Rebuildable index (non-authoritative).
    await kv.set(
      xhighClientTaskKey(input.phase, input.session_id, client_task_id),
      job.job_id,
      { ex: KV_TTL.POJU_XHIGH_JOB },
    );
  }
  return job;
}

export type GetXhighJobByClientTaskResult =
  | { status: "found"; job: PojuXhighJob }
  | { status: "missing" }
  | { status: "recovery_required"; reason: string };

/**
 * Reverse lookup by client_task_id (S0 ABSENT → S2).
 * Index is rebuildable; job record is authority. Ambiguity → recovery_required (no blind create).
 */
export async function getXhighJobByClientTaskId(input: {
  phase: PojuXhighJobPhase;
  session_id: string;
  client_task_id: string;
  /** Optional candidate job_id from Reload / latest — verified against identity. */
  candidate_job_id?: string | null;
}): Promise<GetXhighJobByClientTaskResult> {
  const client_task_id = input.client_task_id.trim();
  if (!client_task_id) {
    return { status: "recovery_required", reason: "empty client_task_id" };
  }

  const indexKey = xhighClientTaskKey(input.phase, input.session_id, client_task_id);
  const indexedId = await kv.get<string>(indexKey);

  const candidates = new Set<string>();
  if (typeof indexedId === "string" && indexedId.trim()) candidates.add(indexedId.trim());
  if (input.candidate_job_id && input.candidate_job_id.trim()) {
    candidates.add(input.candidate_job_id.trim());
  }

  const matches: PojuXhighJob[] = [];
  for (const job_id of candidates) {
    const job = await getXhighJob(job_id);
    if (!job) continue;
    if (job.phase !== input.phase) continue;
    if (job.session_id !== input.session_id) continue;
    if (job.client_task_id !== client_task_id) continue;
    matches.push(job);
  }

  if (matches.length > 1) {
    const ids = Array.from(new Set(matches.map((m) => m.job_id)));
    if (ids.length > 1) {
      return {
        status: "recovery_required",
        reason:
          "multiple jobs for client_task_id=" + client_task_id + ": " + ids.join(","),
      };
    }
  }

  if (matches.length === 1) {
    const job = matches[0]!;
    // Repair index when possible.
    if (indexedId !== job.job_id) {
      await kv.set(indexKey, job.job_id, { ex: KV_TTL.POJU_XHIGH_JOB });
    }
    return { status: "found", job };
  }

  // Index miss + no verified candidate → missing (caller may create once).
  // Do NOT consult latest-only as authority (S0: latest is not create-identity).
  return { status: "missing" };
}

`;
    body = body.slice(0, i0) + newCreate + body.slice(i1);
    write("lib/poju/xhigh-job-store.ts", body);
  } else {
    console.log("skip xhigh-job-store (already patched)");
  }
}

// ---------- package.json ----------
{
  let body = read("package.json");
  if (!body.includes("test:generation-s2")) {
    body = replaceOnce(
      body,
      `"test:session-cas-s1": "tsx scripts/test-session-cas-s1.ts"`,
      `"test:session-cas-s1": "tsx scripts/test-session-cas-s1.ts",
    "test:generation-s2": "tsx scripts/test-generation-s2.ts"`,
      "package.json",
    );
    write("package.json", body);
  } else {
    console.log("skip package.json");
  }
}

console.log("OK apply-s2-patches");
