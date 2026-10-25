"use client";

import { useState } from "react";

import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";

const TASKS = ["Career move", "Relationship clarity", "Money pressure", "Home decision", "Custom"] as const;
const RITUAL_STEPS = [
  "Lay phone flat",
  "Breath calibration",
  "Compass alignment",
  "Pick task",
  "Mark intention",
  "Slow lift",
  "Enter camera mode",
  "Hold still for capture",
  "Confirm environment",
  "Generate 40 insights",
  "Save 5-shichen window",
] as const;

function SyncroARContent() {
  const [task, setTask] = useState<string>(TASKS[0]);
  const [custom, setCustom] = useState("");
  const [started, setStarted] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [taskError, setTaskError] = useState("");
  const [taskLoading, setTaskLoading] = useState(false);

  async function startPaidFlow() {
    setTaskError("");
    setTaskLoading(true);
    await fetch("/api/payments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ product: "syncro_ar" }),
    });
    const effectiveTask = task === "Custom" ? (custom.trim() || "Custom task") : task;
    try {
      const res = await fetch("/api/syncro/task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: effectiveTask }),
      });
      const data = (await res.json()) as { ok?: boolean; lines?: string[]; error?: string };
      if (!res.ok || !data.ok) {
        setTaskError(data.error ?? "task_failed");
        setLines([]);
      } else {
        setLines(Array.isArray(data.lines) ? data.lines : []);
      }
    } catch {
      setTaskError("network_error");
      setLines([]);
    } finally {
      setTaskLoading(false);
    }
    setStarted(true);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8 text-text-body">
      <h1 className="text-3xl font-semibold text-text-primary">Syncro AR Task Mode</h1>
      <p className="mt-2 text-sm text-text-secondary">$1.99 per ritual · one-time 40-line interpretation · valid for 5 shichen window.</p>

      <section className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
        <p className="text-sm font-semibold text-text-primary">Choose your task</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {TASKS.map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setTask(x)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${task === x ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100" : "border-white/15 bg-white/5 text-white/80"}`}
            >
              {x}
            </button>
          ))}
        </div>
        {task === "Custom" ? (
          <textarea
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 120))}
            className="mt-3 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm"
            placeholder="Describe your task..."
          />
        ) : null}

        <button
          type="button"
          disabled={taskLoading}
          onClick={() => void startPaidFlow()}
          className="mt-4 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {taskLoading ? "Loading…" : "Continue — $1.99"}
        </button>
        {taskError ? <p className="mt-2 text-xs text-red-300">{taskError}</p> : null}
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <p className="text-sm font-semibold text-text-primary">11-step ritual</p>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-text-secondary">
          {RITUAL_STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      {started ? (
        <section className="mt-6 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 p-5">
          <p className="text-sm font-semibold text-cyan-100">Camera viewport (circular)</p>
          <div className="mt-3 flex justify-center">
            <div className="h-56 w-56 rounded-full border-2 border-cyan-300/60 bg-black/40" />
          </div>
          <p className="mt-3 text-xs text-cyan-100/90">Task: {task === "Custom" ? custom || "Custom task" : task}</p>
          {lines.length > 0 ? (
            <div className="mt-5 max-h-80 overflow-y-auto rounded-xl border border-cyan-400/20 bg-black/30 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-200/90">40-line interpretation</p>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-relaxed text-cyan-50/95">
                {lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

export default function SyncroARPage() {
  return (
    <SyncroGuardedRoute>
      <SyncroARContent />
    </SyncroGuardedRoute>
  );
}
