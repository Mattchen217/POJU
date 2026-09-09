"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DeliveryLabCreatePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState("zh");
  const [question, setQuestion] = useState("");
  const [desired, setDesired] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [baseJson, setBaseJson] = useState("");
  const [coreJson, setCoreJson] = useState("");
  const [agendaJson, setAgendaJson] = useState("[]");

  const probe = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/login", { method: "GET", credentials: "include" });
      setAuthed(res.ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let base_analysis: unknown;
      try {
        base_analysis = JSON.parse(baseJson);
      } catch {
        setError("base_analysis JSON 解析失败");
        return;
      }
      let breakthrough_core: unknown = null;
      if (coreJson.trim()) {
        try {
          breakthrough_core = JSON.parse(coreJson);
        } catch {
          setError("breakthrough_core JSON 解析失败");
          return;
        }
      }
      let covered_agenda: unknown = [];
      try {
        covered_agenda = JSON.parse(agendaJson || "[]");
      } catch {
        setError("covered_agenda JSON 解析失败");
        return;
      }

      const res = await fetch("/api/ops/delivery-lab/create", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          original_question: question,
          desired_outcome: desired || undefined,
          session_id: sessionId || undefined,
          base_analysis,
          breakthrough_core,
          covered_agenda,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        lab?: { lab_id: string };
      };
      if (!res.ok || !data.ok || !data.lab?.lab_id) {
        if (res.status === 401) {
          setAuthed(false);
          setError("未登录 — 请先到 /ops 登录");
          return;
        }
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      router.push(`/ops/delivery-lab/${data.lab.lab_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "create_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0f12] px-4 py-10 text-[#e4e4e7]">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-[#71717a]">POJU · ops</p>
          <h1 className="mt-2 font-primary text-2xl font-semibold text-white">
            Delivery Lab · 逐步生成查验台
          </h1>
          <p className="mt-2 text-sm text-[#a1a1aa]">
            点按钮才调模型。人工通过后才解锁下一步。不写用户正式 shelf。
          </p>
          <p className="mt-2 text-sm">
            <Link href="/ops" className="text-[#f2ca50] underline-offset-2 hover:underline">
              ← Ops 首页
            </Link>
          </p>
        </header>

        {authed === null ? (
          <p className="text-[#71717a]">Checking session…</p>
        ) : !authed ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
            未登录。请先{" "}
            <Link href="/ops" className="text-[#f2ca50] underline">
              /ops 登录
            </Link>
            。
          </p>
        ) : (
          <form onSubmit={onCreate} className="space-y-4">
            <label className="block text-sm">
              Locale
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-sm"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Original question *
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                rows={2}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              Desired outcome
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 text-sm"
                value={desired}
                onChange={(e) => setDesired(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Session id (optional)
              <input
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-sm"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              base_analysis JSON *（须含 structured）
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={12}
                value={baseJson}
                onChange={(e) => setBaseJson(e.target.value)}
                placeholder='{"structured":{...},"content":"..."}'
                required
              />
            </label>
            <label className="block text-sm">
              breakthrough_core JSON（可选，P3/P4 feed 更全）
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={6}
                value={coreJson}
                onChange={(e) => setCoreJson(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              covered_agenda JSON
              <textarea
                className="mt-1 w-full rounded-md border border-white/10 bg-[#101417] px-3 py-2 font-mono text-xs"
                rows={4}
                value={agendaJson}
                onChange={(e) => setAgendaJson(e.target.value)}
              />
            </label>
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[#f2ca50] px-4 py-2.5 text-sm font-medium text-[#0b0f12] disabled:opacity-50"
            >
              {busy ? "Creating…" : "创建 Lab →"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
