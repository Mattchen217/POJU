const fs = require("fs");
const p = "lib/poju/generation/commit-paths.ts";
let s = fs.readFileSync(p, "utf8");

if (!s.includes("assertSessionGenerationConsistency")) {
  const importAnchor = 'import { assertLegalTaskTransition } from "./types";';
  if (!s.includes(importAnchor)) {
    console.error("import anchor missing");
    process.exit(1);
  }
  s = s.replace(
    importAnchor,
    importAnchor +
      '\nimport { assertSessionGenerationConsistency } from "./consistency";',
  );
}

// After building `latest`, before collision check — formal_result_commit gate for probe identity
if (!s.includes('boundary: "formal_result_commit"')) {
  const marker = `  // Steps 1–8 BEFORE any key-only skip (§5.3).
  const collision = checkGenerationCollision({`;
  // encoding may use special dash
  const re = /  \/\/ Steps 1[^\n]*\n  const collision = checkGenerationCollision\(\{/;
  if (!re.test(s)) {
    console.error("collision marker missing");
    const i = s.indexOf("checkGenerationCollision");
    console.log(JSON.stringify(s.slice(i - 80, i + 80)));
    process.exit(1);
  }
  s = s.replace(
    re,
    `  // P3-99/100 — TaskContext/Registry consistency before Path judgment (§9.5).
  assertSessionGenerationConsistency(latest, input.probe.client_task_id, "formal_result_commit", {
    generation_type: input.probe.generation_type,
    generation_id: input.probe.generation_id,
  });

  // Steps 1-8 BEFORE any key-only skip (§5.3).
  const collision = checkGenerationCollision({`,
  );
}

// Path B — before returning replay
if (!s.includes('boundary: "path_b_replay"')) {
  const pathB = `  // Path B — replay, no DC rewrite, no rev bump (§9.2).
  if (collision.path === "B") {
    if (!collision.registry_entry || !collision.binding) {
      throw new GenerationError(GENERATION_HARD_FAIL, "Path B missing registry/binding");
    }
    return {`;
  // fuzzy match due to encoding
  const reB = /if \(collision\.path === "B"\) \{\n    if \(!collision\.registry_entry \|\| !collision\.binding\) \{\n      throw new GenerationError\(GENERATION_HARD_FAIL, "Path B missing registry\/binding"\);\n    }\n    return \{/;
  if (!reB.test(s)) {
    console.error("Path B block not found");
    process.exit(1);
  }
  s = s.replace(
    reB,
    `if (collision.path === "B") {
    if (!collision.registry_entry || !collision.binding) {
      throw new GenerationError(GENERATION_HARD_FAIL, "Path B missing registry/binding");
    }
    assertSessionGenerationConsistency(latest, input.probe.client_task_id, "path_b_replay", {
      generation_type: input.probe.generation_type,
      generation_id: input.probe.generation_id,
    });
    return {`,
  );
}

// Path C — before mutate
if (!s.includes('boundary: "path_c_register"')) {
  const reC = /\/\/ Path C[^\n]*\n  if \(collision\.path === "C"\) \{\n    const reg = collision\.registry_entry!;\n    const write = await mutatePOJUSession\(/;
  if (!reC.test(s)) {
    console.error("Path C block not found");
    process.exit(1);
  }
  s = s.replace(
    reC,
    `// Path C — new key, session+1, dc unchanged, no DC rewrite, no duplicate Registry (§9.3).
  if (collision.path === "C") {
    const reg = collision.registry_entry!;
    assertSessionGenerationConsistency(latest, input.probe.client_task_id, "path_c_register", {
      generation_type: input.probe.generation_type,
      generation_id: input.probe.generation_id,
    });
    const write = await mutatePOJUSession(`,
  );
}

fs.writeFileSync(p, s);
console.log("commit-paths wired");
