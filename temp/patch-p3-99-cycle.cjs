const fs = require("fs");
const p = "lib/poju/generation/consistency.ts";
let s = fs.readFileSync(p, "utf8");
if (s.includes('from "./task-context"')) {
  s = s.replace('import { findTaskContext } from "./task-context";\n', "");
  s = s.replace(
    "function findRegistryForTask(",
    `function findTaskContextLocal(
  tasks: readonly GenerationTaskContext[] | undefined | null,
  client_task_id: string,
): GenerationTaskContext | undefined {
  return (tasks ?? []).find((t) => t.client_task_id === client_task_id);
}

function findRegistryForTask(`,
  );
  s = s.replace(/findTaskContext\(/g, "findTaskContextLocal(");
  fs.writeFileSync(p, s);
  console.log("broke cycle");
} else console.log("no cycle import");
