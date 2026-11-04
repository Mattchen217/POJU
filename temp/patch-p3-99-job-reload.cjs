const fs = require("fs");

// Add job reload wrapper on task-context
{
  const p = "lib/poju/generation/task-context.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("restoreGenerationOnJobReload")) {
    const anchor = `  return { ...task };
}`;
    // find the restore function's closing — after our new restore
    const marker = `  assertSessionGenerationConsistency(
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
    if (!s.includes(marker)) {
      console.error("restore end marker missing");
      process.exit(1);
    }
    s = s.replace(
      marker,
      marker +
        `

/**
 * Job Reload / Recovery entry — same restore, explicit job_reload boundary (P3-99/100).
 */
export function restoreGenerationOnJobReload(
  session: Pick<
    POJUSessionState,
    "generation_task_contexts" | "generation_registry" | "session_id"
  >,
  client_task_id: string,
): GenerationTaskContext | null {
  return restoreTaskContextOnReload(session, client_task_id, {
    boundary: "job_reload",
  });
}`,
    );
    fs.writeFileSync(p, s);
    console.log("job reload wrapper ok");
  }
}

// e2e PHASE3_ONLY_IDS support
{
  const p = "scripts/test-decision-context-phase3-e2e.ts";
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("PHASE3_ONLY_IDS")) {
    s = s.replace(
      "function shouldRun(id: string): boolean {\n  return !CORE_ONLY || CORE_IDS.has(id);\n}",
      "function shouldRun(id: string): boolean {\n  const only = process.env.PHASE3_ONLY_IDS;\n  if (only && only.trim()) return only.split(/[,\\s]+/).filter(Boolean).includes(id);\n  return !CORE_ONLY || CORE_IDS.has(id);\n}",
    );
    fs.writeFileSync(p, s);
    console.log("e2e only-ids ok");
  }
}
