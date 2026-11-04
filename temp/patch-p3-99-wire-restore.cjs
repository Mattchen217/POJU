const fs = require("fs");

// index export
{
  const p = "lib/poju/generation/index.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes('"./consistency"')) {
    s = s.replace(
      'export * from "./collision";\n',
      'export * from "./collision";\nexport * from "./consistency";\n',
    );
    fs.writeFileSync(p, s);
    console.log("index ok");
  }
}

// restoreTaskContextOnReload
{
  const p = "lib/poju/generation/task-context.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("assertSessionGenerationConsistency")) {
    // add import
    if (!s.includes('from "./consistency"')) {
      // find a good import anchor
      const anchor = 'import { assertValidProductionSessionId } from "./session-id";';
      if (!s.includes(anchor)) {
        console.error("session-id import missing in task-context");
        process.exit(1);
      }
      s = s.replace(
        anchor,
        anchor +
          '\nimport { assertSessionGenerationConsistency } from "./consistency";',
      );
    }

    const old = `export function restoreTaskContextOnReload(
  session: Pick<POJUSessionState, "generation_task_contexts" | "session_id">,
  client_task_id: string,
): GenerationTaskContext | null {
  assertValidProductionSessionId(session.session_id, "reload");
  const task = findTaskContext(session.generation_task_contexts, client_task_id);
  if (!task) return null;
  if (task.session_id !== session.session_id) {
    throw new GenerationError(
      "GENERATION_IDENTITY_COLLISION",
      "TaskContext session_id does not match session",
    );
  }
  return { ...task };
}`;

    const neu = `export function restoreTaskContextOnReload(
  session: Pick<
    POJUSessionState,
    "generation_task_contexts" | "generation_registry" | "session_id"
  >,
  client_task_id: string,
  opts?: { boundary?: "job_reload" | "task_context_restore" },
): GenerationTaskContext | null {
  assertValidProductionSessionId(session.session_id, "reload");
  const task = findTaskContext(session.generation_task_contexts, client_task_id);
  if (!task) return null;
  if (task.session_id !== session.session_id) {
    throw new GenerationError(
      "GENERATION_IDENTITY_COLLISION",
      "TaskContext session_id does not match session",
    );
  }
  // P3-99/100 — hard-block inconsistent TaskContext/Registry on reload/restore.
  assertSessionGenerationConsistency(
    session,
    client_task_id,
    opts?.boundary ?? "task_context_restore",
    {
      generation_type: task.generation_type,
      generation_id: task.generation_id,
    },
  );
  return { ...task };
}`;

    if (!s.includes(old)) {
      console.error("restoreTaskContextOnReload block not found");
      process.exit(1);
    }
    s = s.replace(old, neu);
    fs.writeFileSync(p, s);
    console.log("task-context restore wired");
  } else console.log("task-context already");
}
