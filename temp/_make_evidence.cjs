const fs = require("fs");
const OUT = "docs/eastern-os/decision-intake-2.0/evidence/m2-4-phase4-answer-ask";
const trunc = (v, n) => (typeof v === "string" && v.length > n ? v.slice(0, n) + "…[truncated]" : v);
const scrub = (s) =>
  s
    .replace(/sk-or-v1-(?!invalid)[A-Za-z0-9]+/g, "[REDACTED_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [REDACTED]");
const call = (c) => ({
  via_route: c.via_route,
  http_status: c.http_status ?? c.response?.http_status ?? null,
  model: c.model ?? c.response?.model ?? c.request?.model ?? null,
  provider: c.provider ?? c.response?.provider ?? null,
  finish_reason: c.finish_reason ?? c.response?.finish_reason ?? null,
  content: trunc(c.content ?? c.response?.content ?? null, 700),
  error: trunc(c.error ?? c.response?.error ?? null, 400),
});
const dcv = (s) => (s && s.dc ? { version: s.dc.version, status: s.dc.status, facts: s.dc.fact_count, constraints: s.dc.constraint_count, conflicts: s.dc.conflict_count } : null);

const smokeFile = "m2-4-r2-openrouter-smoke-1794407635967.json";
const sm = JSON.parse(fs.readFileSync("temp/" + smokeFile, "utf8"));
const smoke = {
  source_record: "temp/" + smokeFile + " (local, not committed)",
  kind: sm.kind,
  ran_at: sm.ran_at,
  transport: sm.transport,
  stubbed: sm.stubbed,
  redaction: sm.redaction + "; request headers/system prompt/context JSON omitted; model content truncated",
  expectations: sm.expectations,
  cases: sm.cases.map((c) => ({
    id: c.id,
    title: c.title,
    expectations: c.expectations,
    notes: c.notes,
    turns: (c.turns || []).map((t) => ({
      label: t.label,
      input: t.input,
      route_hits: t.route_hits,
      openrouter_calls: (t.openrouter_calls || []).map(call),
      dc_before: dcv(t.before),
      dc_after: dcv(t.after),
      facts_written: Array.isArray(t.facts_written) ? t.facts_written.length : t.facts_written,
      wall_ms: t.wall_ms,
    })),
  })),
};

const e2eFiles = fs.readdirSync("temp").filter((f) => /^m2-4-r2-real-e2e-\d+\.json$/.test(f)).sort();
const runs = e2eFiles.map((f) => {
  const j = JSON.parse(fs.readFileSync("temp/" + f, "utf8"));
  const run = {
    source_record: "temp/" + f + " (local, not committed)",
    ran_at: j.ran_at,
    transport: j.transport,
    stubbed: j.stubbed,
    phase5_page_generation: j.phase5_page_generation,
    openrouter_calls: j.openrouter_calls,
    final_budget: j.final && j.final.budget,
    final_readiness_verdict: j.final && j.final.readiness && j.final.readiness.verdict,
    checks: j.checks,
  };
  if (f.includes("1794408651641")) {
    run.transcript = j.transcript.map((t) => ({
      n: t.n,
      label: t.label,
      user: t.user,
      assistant: trunc(t.assistant, 500),
      openrouter: (t.openrouter || []).map(call),
      facts_written: Array.isArray(t.facts_written) ? t.facts_written.length : t.facts_written,
      dc_before: dcv(t.before),
      dc_after: dcv(t.after),
      blueprint_after: t.after && t.after.blueprint,
      readiness_after: t.after && t.after.understanding && t.after.understanding.readiness && t.after.understanding.readiness.verdict,
    }));
  }
  return run;
});
const e2e = {
  note: "Real OpenRouter E2E runs in chronological order. Runs before the implementation commit used intermediate code; see the evidence doc for which code fix each run motivated.",
  runs,
};

const w = (name, obj) => {
  const s = scrub(JSON.stringify(obj, null, 2));
  if (/sk-or-v1-(?!invalid)[A-Za-z0-9]{8,}/.test(s)) throw new Error("secret in " + name);
  fs.writeFileSync(OUT + "/" + name, s + "\n", "utf8");
  console.log(name, s.length);
};
w("R2-FINAL-real-openrouter-smoke.redacted.json", smoke);
w("R2-FINAL-real-e2e-runs.redacted.json", e2e);
