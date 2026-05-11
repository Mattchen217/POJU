"use client";

import { useState } from "react";
import type { BirthGender, BirthInfo, UserProfile } from "@/lib/profile/types";
import { saveUserProfile } from "@/lib/profile/storage";

type BirthInfoFormProps = {
  onProfileReady?: (profile: UserProfile) => void;
};

const CURRENT_YEAR = new Date().getFullYear();

export function BirthInfoForm({ onProfileReady }: BirthInfoFormProps) {
  const [form, setForm] = useState<BirthInfo>({
    year: 1990,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    gender: "other",
    city: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/profile/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { profile: UserProfile };
      await saveUserProfile(data.profile);
      setStatus("done");
      onProfileReady?.(data.profile);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to calculate profile");
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-text-primary">Birth Info</h3>
      <p className="mt-2 text-sm text-text-secondary">Used once to generate shared user profile for POJU / Glyph / Syncro.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-text-dim">
          Year
          <input
            type="number"
            min={1900}
            max={CURRENT_YEAR}
            value={form.year}
            onChange={(e) => setForm((p) => ({ ...p, year: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="text-xs text-text-dim">
          Month
          <input
            type="number"
            min={1}
            max={12}
            value={form.month}
            onChange={(e) => setForm((p) => ({ ...p, month: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="text-xs text-text-dim">
          Day
          <input
            type="number"
            min={1}
            max={31}
            value={form.day}
            onChange={(e) => setForm((p) => ({ ...p, day: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="text-xs text-text-dim">
          Hour
          <input
            type="number"
            min={0}
            max={23}
            value={form.hour}
            onChange={(e) => setForm((p) => ({ ...p, hour: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="text-xs text-text-dim">
          Minute
          <input
            type="number"
            min={0}
            max={59}
            value={form.minute ?? 0}
            onChange={(e) => setForm((p) => ({ ...p, minute: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <label className="text-xs text-text-dim">
          Gender
          <select
            value={form.gender}
            onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as BirthGender }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block text-xs text-text-dim">
        City (optional)
        <input
          type="text"
          value={form.city ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
        />
      </label>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={status === "loading"}
        className="mt-5 rounded-full border border-cyan-300/40 bg-cyan-400/20 px-5 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
      >
        {status === "loading" ? "Calculating..." : "Save Shared Profile"}
      </button>

      {status === "done" ? <p className="mt-3 text-sm text-emerald-200">Profile saved to encrypted IndexedDB.</p> : null}
      {status === "error" ? <p className="mt-3 text-sm text-red-200">{error}</p> : null}
    </section>
  );
}
