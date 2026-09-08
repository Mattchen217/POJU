/**
 * Smoke: delivery step log one-liners.
 * Run: pnpm exec tsx scripts/test-delivery-step-log.ts
 */
import assert from "node:assert/strict";
import {
  deliveryPageLabel,
  logDeliveryStep,
} from "../lib/llm/pro/delivery/delivery-step-log";

assert.equal(deliveryPageLabel("science_action"), "P3");
assert.equal(deliveryPageLabel("metaphysics_action"), "P4");

const lines: string[] = [];
const origInfo = console.info;
const origWarn = console.warn;
const origError = console.error;
console.info = ((...args: unknown[]) => {
  lines.push(String(args[0] ?? ""));
}) as typeof console.info;
console.warn = ((...args: unknown[]) => {
  lines.push(String(args[0] ?? ""));
}) as typeof console.warn;
console.error = ((...args: unknown[]) => {
  lines.push(String(args[0] ?? ""));
}) as typeof console.error;
try {
  logDeliveryStep({
    job_id: "fd_69f71d29-6b3a-4914-9d9b-1788836604425_kiq3i5",
    level: "ok",
    step: "wave P3+P4",
    detail: "deliver_science_action, deliver_metaphysics_action",
    ms: 12_400,
    tags: "left=4",
  });
  logDeliveryStep({
    job_id: "fd_short",
    level: "fail",
    step: "P3 science_action",
    detail: "compress_body_mingli:年支",
    ms: 185_000,
  });
} finally {
  console.info = origInfo;
  console.warn = origWarn;
  console.error = origError;
}

assert.equal(lines.length, 2);
assert.ok(lines[0]!.startsWith("[FD] "));
assert.ok(lines[0]!.includes("· ok ·"));
assert.ok(lines[0]!.includes("wave P3+P4"));
assert.ok(lines[0]!.includes("(12.4s)"));
assert.ok(lines[1]!.includes("· fail ·"));
assert.ok(lines[1]!.includes("compress_body_mingli:年支"));
assert.ok(!lines[0]!.includes("\n"), "one line only");

console.log("ok: delivery step log");
