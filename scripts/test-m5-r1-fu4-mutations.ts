import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const servicePath = "lib/poju/decision-intake/decision-report-service.ts";
const chargePath = "lib/poju/decision-intake/decision-report-charge.ts";
const originals = new Map<string, string>();

function mutate(path: string, before: string, after: string): void {
  const source = originals.get(path)!.replace(/\r\n/g, "\n");
  if (!source.includes(before)) throw new Error(`mutation anchor missing in ${path}`);
  writeFileSync(path, source.replace(before, after), "utf8");
}

function runFu4(): number {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(command, ["test:m5-r1-fu4"], { encoding: "utf8", shell: process.platform === "win32" });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

const service = readFileSync(servicePath, "utf8");
const charge = readFileSync(chargePath, "utf8");
originals.set(servicePath, service);
originals.set(chargePath, charge);

const mutations = [
  {
    name: "status authorization check removed",
    apply: () => mutate(
      servicePath,
      `    const delivery = await verifyDecisionReportDelivery(job);\n    if (!delivery.ok) return deliveryDeniedPayload(input, jobBinding, delivery);`,
      `    const delivery = { ok: true as const, record: {} as never };`,
    ),
  },
  {
    name: "job revocation check removed",
    apply: () => mutate(
      chargePath,
      `  if (rec.state === "revoked") return denied("delivery_revoked", { revoked: true });`,
      `  if (false) return denied("delivery_revoked", { revoked: true });`,
    ),
  },
  {
    name: "session authorization no longer bound to job charge_ref",
    apply: () => mutate(
      chargePath,
      `  if (!rec.charge_ref || auth.charge_ref !== rec.charge_ref) return denied("delivery_charge_mismatch");`,
      `  if (!rec.charge_ref) return denied("delivery_charge_mismatch");`,
    ),
  },
  {
    name: "historical delivery incorrectly requires 2h execution grant",
    apply: () => mutate(
      chargePath,
      `  if (!rec.charge_ref || auth.charge_ref !== rec.charge_ref) return denied("delivery_charge_mismatch");\n  return { ok: true, record: rec };`,
      `  if (!rec.charge_ref || auth.charge_ref !== rec.charge_ref) return denied("delivery_charge_mismatch");\n  if (!(await kv.get<DecisionReportExecutionGrant>(di2ExecutionGrantKey(target.job_id)))) return denied("grant_missing");\n  return { ok: true, record: rec };`,
    ),
  },
];

let failed = false;
try {
  for (const mutation of mutations) {
    writeFileSync(servicePath, service, "utf8");
    writeFileSync(chargePath, charge, "utf8");
    mutation.apply();
    const exitCode = runFu4();
    const killed = exitCode !== 0;
    console.log(`${killed ? "KILLED" : "SURVIVED"} mutation: ${mutation.name} (FU4 exit=${exitCode})`);
    if (!killed) failed = true;
  }
} finally {
  writeFileSync(servicePath, service, "utf8");
  writeFileSync(chargePath, charge, "utf8");
}

if (failed) process.exitCode = 1;
