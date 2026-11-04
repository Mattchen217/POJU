/**
 * Phase 3 S3 installer — copies payload modules + patches wiring.
 * Run from repo root: node temp/install-s3.cjs
 * Leaves other temp/*.cjs alone.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log("wrote", rel);
}
function mustInclude(hay, needle, label) {
  if (!hay.includes(needle)) {
    throw new Error(`patch anchor missing (${label}): ${JSON.stringify(needle).slice(0, 120)}`);
  }
}
function replaceOnce(hay, needle, repl, label) {
  mustInclude(hay, needle, label);
  const i = hay.indexOf(needle);
  return hay.slice(0, i) + repl + hay.slice(i + needle.length);
}

const PAYLOAD = path.join(__dirname, "s3-payload");
function copyPayload() {
  if (!fs.existsSync(PAYLOAD)) {
    throw new Error("temp/s3-payload missing — transfer payload first");
  }
  function walk(dir, relBase) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, ent.name);
      const rel = path.join(relBase, ent.name).replace(/\\/g, "/");
      if (ent.isDirectory()) walk(abs, path.join(relBase, ent.name));
      else {
        const dest = path.join(ROOT, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(abs, dest);
        console.log("copied", rel);
      }
    }
  }
  walk(PAYLOAD, "");
}

copyPayload();

// ---- types.ts: session fields + message meta ----
{
  let t = read("lib/poju/types.ts");
  if (!t.includes("confirmation_events?")) {
    const anchor = `  generation_operation_bindings?: import("./generation").GenerationOperationBinding[];
}`;
    const repl = `  generation_operation_bindings?: import("./generation").GenerationOperationBinding[];
  /**
   * Phase 3 S3 — formal ControlPlane authority (Contract §10).
   * agent_v2 may mirror FROM this; never overwrite this from agent_v2.
   */
  control_plane?: import("./decision-context/control-plane").Phase3ControlPlane;
  /**
   * Phase 3 S3 — append-only Fact/Constraint Confirmation Events (Contract §11).
   */
  confirmation_events?: import("./decision-context/confirmation-event").ConfirmationEvent[];
  /**
   * Phase 3 S3 — Opening Anchor store (Contract §12). Never delete cleared anchors.
   */
  opening_anchors?: import("./decision-context/opening-anchor").OpeningAnchor[];
  /**
   * Phase 3 S3 — Opening Gate confirm history append-only (Contract §12).
   */
  opening_confirm_history?: import("./decision-context/opening-anchor").OpeningConfirmHistoryEntry[];
}`;
    t = replaceOnce(t, anchor, repl, "types.ts session fields");
  } else {
    console.log("skip types.ts session fields");
  }

  if (!t.includes("is_opening_anchor?:")) {
    const metaAnchor = `  /** Stage-1 dyad collect/skip gate pending on this assistant turn. */
  dyad_gate_pending?: boolean;`;
    const metaRepl = `  /** Stage-1 dyad collect/skip gate pending on this assistant turn. */
  dyad_gate_pending?: boolean;
  /** Phase 3 S3 — message marked as Opening Anchor (Contract §12.3). */
  is_opening_anchor?: boolean;
  /** Phase 3 S3 — bound Opening Anchor id (≠ message client_id). */
  opening_anchor_id?: string;`;
    t = replaceOnce(t, metaAnchor, metaRepl, "types.ts message meta");
  } else {
    console.log("skip types.ts message meta");
  }
  write("lib/poju/types.ts", t);
}

// ---- session-manager.ts ----
{
  let t = read("lib/poju/session-manager.ts");

  if (!t.includes("cloneFormalControlPlane")) {
    const softA = `  type ControlPlaneSlice,
  type PersistTransaction,
} from "@/lib/poju/decision-context/persist";`;
    const softB = `type ControlPlaneSlice,
} from "@/lib/poju/decision-context/persist";`;
    const soft = t.includes(softA) ? softA : softB;
    if (!t.includes(soft)) {
      throw new Error("session-manager persist import anchor missing");
    }
    t = replaceOnce(
      t,
      soft,
      soft +
        `
import {
  cloneFormalControlPlane,
  mergeControlPlanePatch,
  mirrorControlPlanePhaseToAgentV2Patch,
  type Phase3ControlPlane,
} from "@/lib/poju/decision-context/control-plane";`,
      "session-manager CP import",
    );
  }

  if (!t.includes("next.control_plane = formal")) {
    const start = t.indexOf("export function mergeDcPersistSliceIntoSession(");
    if (start < 0) throw new Error("mergeDcPersistSliceIntoSession not found");
    const end = t.indexOf("\nexport async function createPOJUSession", start);
    if (end < 0) throw new Error("createPOJUSession after merge not found");
    const newFn = `export function mergeDcPersistSliceIntoSession(
  base: POJUSessionState,
  slice: {
    decision_context?: DecisionContext | null;
    decision_context_versions?: DecisionContext[];
    decision_context_idempotency_keys?: string[];
    control_plane?: Phase3ControlPlane | ControlPlaneSlice | unknown;
  },
): POJUSessionState {
  const next = deepCloneSession(base);
  next.decision_context = slice.decision_context;
  if (slice.decision_context_versions !== undefined) {
    next.decision_context_versions = slice.decision_context_versions;
  }
  if (slice.decision_context_idempotency_keys !== undefined) {
    next.decision_context_idempotency_keys = slice.decision_context_idempotency_keys;
  }

  // Formal CP authority (Contract §10). Never restore CP from agent_v2.
  // Accept full formal plane or whitelist patch merged onto existing / defaults.
  if (slice.control_plane !== undefined) {
    const formal = mergeControlPlanePatch(next.control_plane, slice.control_plane);
    next.control_plane = formal;
    const mirror = mirrorControlPlanePhaseToAgentV2Patch(formal);
    const prev = next.agent_v2;
    if (prev) {
      next.agent_v2 = {
        ...prev,
        current_phase: mirror.current_phase,
        investigation_agenda: mirror.investigation_agenda,
      };
    } else {
      next.agent_v2 = {
        current_phase: mirror.current_phase,
        investigation_agenda: mirror.investigation_agenda,
      } as POJUAgentState;
    }
  }

  return next;
}

`;
    t = t.slice(0, start) + newFn + t.slice(end);
  }

  if (!t.includes("confirmation_events: []")) {
    t = replaceOnce(
      t,
      `    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
  };`,
      `    generation_task_contexts: [],
    generation_registry: [],
    generation_operation_bindings: [],
    confirmation_events: [],
    opening_anchors: [],
    opening_confirm_history: [],
  };`,
      "createPOJUSession S3 defaults",
    );
  }

  if (!t.includes("withCycles.confirmation_events")) {
    t = replaceOnce(
      t,
      `  if (!Array.isArray(withCycles.generation_operation_bindings)) {
    withCycles.generation_operation_bindings = [];
  }

  // Phase 2 C1 restore: DC is authority; hydrate durable idempotency keys.
  return applyDecisionContextRestore(withCycles);`,
      `  if (!Array.isArray(withCycles.generation_operation_bindings)) {
    withCycles.generation_operation_bindings = [];
  }
  // Phase 3 S3 — hydrate Confirmation / Opening Anchor stores (Contract §11–§12).
  if (!Array.isArray(withCycles.confirmation_events)) withCycles.confirmation_events = [];
  if (!Array.isArray(withCycles.opening_anchors)) withCycles.opening_anchors = [];
  if (!Array.isArray(withCycles.opening_confirm_history)) {
    withCycles.opening_confirm_history = [];
  }
  if (withCycles.control_plane !== undefined && withCycles.control_plane !== null) {
    withCycles.control_plane = cloneFormalControlPlane(withCycles.control_plane);
  }

  // Phase 2 C1 restore: DC is authority; hydrate durable idempotency keys.
  // Formal CP is NOT restored from agent_v2 (Contract §10.1).
  return applyDecisionContextRestore(withCycles);`,
      "loadPOJUSession S3 hydrate",
    );
  }

  write("lib/poju/session-manager.ts", t);
}

// ---- commit-paths.ts Path A control_plane write ----
{
  let t = read("lib/poju/generation/commit-paths.ts");
  if (!t.includes("replaceFormalControlPlane") && !t.includes("mergeControlPlanePatch")) {
    t = replaceOnce(
      t,
      `import type { ControlPlaneSlice } from "@/lib/poju/decision-context/persist";`,
      `import type { ControlPlaneSlice } from "@/lib/poju/decision-context/persist";
import { mergeControlPlanePatch } from "@/lib/poju/decision-context/control-plane";`,
      "commit-paths import",
    );
  }
  if (t.includes("control_plane: S3 product wiring deferred")) {
    t = replaceOnce(
      t,
      `          // control_plane: S3 product wiring deferred; accept opaque slice if provided.
          ...(mutation.control_plane
            ? {
                // Keep agent_v2 mirror only as compatibility — do not invent Phase3ControlPlane.
              }
            : {}),`,
      `          // Phase 3 S3 — Path A C1 writes formal ControlPlane when provided (Contract §8.1 / §10).
          ...(mutation.control_plane
            ? {
                control_plane: mergeControlPlanePatch(
                  base.control_plane,
                  mutation.control_plane,
                ),
              }
            : {}),`,
      "commit-paths Path A CP write",
    );
  }
  t = t.replace(
    `  /** ControlPlane update if present — Contract §8.1 item 3. */
  control_plane?: ControlPlaneSlice;`,
    `  /** Formal Phase3ControlPlane / whitelist patch — Path A C1 write (Contract §8.1 / §10). */
  control_plane?: ControlPlaneSlice;`,
  );
  write("lib/poju/generation/commit-paths.ts", t);
}

// ---- package.json script ----
{
  let t = read("package.json");
  if (!t.includes("test:control-plane-s3")) {
    t = replaceOnce(
      t,
      `"test:generation-s2": "tsx scripts/test-generation-s2.ts"`,
      `"test:generation-s2": "tsx scripts/test-generation-s2.ts",
    "test:control-plane-s3": "tsx scripts/test-control-plane-s3.ts"`,
      "package.json script",
    );
    write("package.json", t);
  } else {
    console.log("skip package.json script");
  }
}

// ---- patch phase1 persist test opaque CP → formal whitelist ----
{
  const rel = "scripts/test-decision-context-phase1.ts";
  let t = read(rel);
  if (t.includes('control_plane: { phase: "opening" as unknown }')) {
    t = t.replace(
      `control_plane: { phase: "opening" as unknown },`,
      `control_plane: undefined,`,
    );
    t = t.replace(
      `applyControlPlaneToWorking(tx!, { phase: "collecting" });`,
      `applyControlPlaneToWorking(tx!, { current_phase: "collecting_context" });`,
    );
    t = t.replace(
      `applyControlPlaneToWorking(tx2!, { phase: "x" });`,
      `applyControlPlaneToWorking(tx2!, { current_phase: "collecting_context" });`,
    );
    t = t.replace(
      `applyControlPlaneToWorking(tx3!, { phase: "collecting" });`,
      `applyControlPlaneToWorking(tx3!, { current_phase: "collecting_context" });`,
    );
    write(rel, t);
    console.log("patched phase1 persist CP usage");
  } else {
    console.log("skip phase1 CP patch");
  }
}


// ---- S2 suite: opaque fake phase is not a formal AgentPhase ----
{
  const rel = "scripts/test-generation-s2.ts";
  let t = read(rel);
  const old = 'control_plane: { current_phase: "test" },';
  if (t.includes(old)) {
    t = t.replace(old, "control_plane: undefined,");
    write(rel, t);
    console.log("patched S2 persist guard CP fixture");
  } else {
    console.log("skip S2 CP fixture patch");
  }
}

console.log("install-s3 complete");
