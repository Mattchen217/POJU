#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
const p = path.join(root, "lib/poju/session-mutation.ts");
let b = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const start = b.indexOf("export interface SessionMutation");
if (start < 0) throw new Error("SessionMutation missing");
const end = b.indexOf("\n}", start);
if (end < 0) throw new Error("SessionMutation end missing");
const block = b.slice(start, end + 2);
if (block.includes("generation_base_revision?: number")) {
  console.log("skip — SessionMutation already has generation_base_revision");
  process.exit(0);
}
const needle = `  bump_dc?: boolean | "auto";
}`;
const idx = block.lastIndexOf(needle);
if (idx < 0) throw new Error("bump_dc closing not found in SessionMutation");
const insert = `  bump_dc?: boolean | "auto";
  /**
   * Phase 3 S2 — Path A / pending_create DC base gate (Contract §6.3 step 8 / §7.3).
   * Passed through to casWritePOJUSession; mismatch → GENERATION_BASE_STALE.
   */
  generation_base_revision?: number;
}`;
const abs = start + idx;
b = b.slice(0, abs) + insert + b.slice(abs + needle.length);
fs.writeFileSync(p, b, "utf8");
console.log("patched SessionMutation generation_base_revision");
