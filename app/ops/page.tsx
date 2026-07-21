"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Entry = { word: string; count: number };

export default function OpsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const probe = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/login", { method: "GET", credentials: "include" });
      setAuthed(res.ok);
    } catch {
      setAuthed(false);
    }
  }, []);

  const loadCandidates = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/ops/candidates", { credentials: "include" });
      const data = (await res.json()) as {
        ok?: boolean;
        entries?: Entry[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          setAuthed(false);
          return;
        }
        setLoadError(data.error ?? `HTTP ${res.status}`);
        setEntries([]);
        return;
      }
      setEntries(data.entries ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "load_failed");
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    if (authed) void loadCandidates();
  }, [authed, loadCandidates]);

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/ops/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(
          data.error === "ops_not_configured"
            ? "服务端未配置 OPS_USER / OPS_PASSWORD / OPS_SESSION_SECRET"
            : "用户名或密码错误",
        );
        return;
      }
      setPassword("");
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "login_failed");
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await fetch("/api/ops/login", { method: "DELETE", credentials: "include" });
    setAuthed(false);
    setEntries([]);
  }

  async function removeWord(word: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/ops/candidates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word }),
      });
      const data = (await res.json()) as { ok?: boolean; entries?: Entry[] };
      if (res.ok && data.ok) setEntries(data.entries ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!window.confirm("清空全部候选词？不可恢复。")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ops/candidates", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearAll: true }),
      });
      const data = (await res.json()) as { ok?: boolean; entries?: Entry[] };
      if (res.ok && data.ok) setEntries(data.entries ?? []);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg-deep px-4 py-10 text-text-body">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-text-dim">POJU · internal</p>
          <h1 className="mt-2 text-2xl font-semibold text-text-primary">Ops Console</h1>
          <p className="mt-2 text-sm text-text-secondary">
            漏网命理词候选池与后续内部监控。全站无入口链接；仅持口令访问。
          </p>
        </header>

        {authed === null ? (
          <p className="text-text-dim">Checking session…</p>
        ) : !authed ? (
          <form
            onSubmit={onLogin}
            className="rounded-2xl border border-[rgba(167,139,250,0.18)] bg-[rgba(139,92,246,0.06)] p-6 backdrop-blur-xl"
          >
            <label className="block text-sm text-text-secondary">
              Username
              <input
                className="mt-2 w-full rounded-xl border border-white/10 bg-bg-layer-1 px-3 py-2 text-text-primary outline-none focus:border-purple-primary"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="mt-4 block text-sm text-text-secondary">
              Password
              <input
                type="password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-bg-layer-1 px-3 py-2 text-text-primary outline-none focus:border-purple-primary"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {loginError ? (
              <p className="mt-3 text-sm text-red-300" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-6 w-full rounded-full bg-purple-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-medium text-text-primary">
                Unmarked candidates
                <span className="ml-2 text-sm font-normal text-text-dim">({entries.length})</span>
              </h2>
              <button
                type="button"
                onClick={() => void loadCandidates()}
                disabled={busy}
                className="rounded-full border border-[rgba(167,139,250,0.3)] px-3 py-1.5 text-sm text-text-body hover:border-[rgba(167,139,250,0.5)]"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void clearAll()}
                disabled={busy || entries.length === 0}
                className="rounded-full border border-red-400/30 px-3 py-1.5 text-sm text-red-200/90 hover:border-red-400/50 disabled:opacity-40"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => void onLogout()}
                className="ml-auto rounded-full px-3 py-1.5 text-sm text-text-dim hover:text-text-primary"
              >
                Sign out
              </button>
            </div>

            {loadError ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {loadError}
              </p>
            ) : null}

            {entries.length === 0 && !loadError ? (
              <p className="text-sm text-text-dim">候选池为空。有交付后旁路收集会写入这里。</p>
            ) : (
              <ul className="divide-y divide-white/5 rounded-2xl border border-[rgba(167,139,250,0.18)] bg-[rgba(139,92,246,0.06)]">
                {entries.map((row) => (
                  <li
                    key={row.word}
                    className="flex items-center gap-3 px-4 py-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                      {row.word}
                    </span>
                    <span className="tabular-nums text-purple-vivid">{row.count}</span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeWord(row.word)}
                      className="text-text-dim hover:text-text-primary"
                      aria-label={`Remove ${row.word}`}
                    >
                      Done
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
