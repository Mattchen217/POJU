"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { LegacyBirthFormInput, LegacyBirthGender, UserProfile } from "@/lib/profile/types";
import { saveUserProfile } from "@/lib/profile/active-profile";

export type BirthInfoFormProps = {
  /** Called after profile is calculated and saved locally. */
  onComplete?: (profile: UserProfile) => void;
  /** @deprecated Prefer `onComplete`; both are supported. */
  onProfileReady?: (profile: UserProfile) => void;
  onSkip?: () => void;
  allowSkip?: boolean;
  /** Reserved for future copy variants (e.g. chat vs profile setup). */
  context?: "chat" | "profile";
  /** When true (default), persist to default `userProfiles` slot. Set false for multi-profile / `stored_profiles` flows. */
  persistDefaultProfile?: boolean;
};

const CURRENT_YEAR = new Date().getFullYear();

export function BirthInfoForm({
  onComplete,
  onProfileReady,
  onSkip,
  allowSkip = false,
  context = "profile",
  persistDefaultProfile = true,
}: BirthInfoFormProps) {
  const t = useTranslations("birthForm");
  const notifyReady = onComplete ?? onProfileReady;

  const [form, setForm] = useState<LegacyBirthFormInput>({
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
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);

  const canSkip = Boolean(allowSkip && onSkip && status !== "done" && status !== "loading");

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
      if (persistDefaultProfile) {
        await saveUserProfile(data.profile);
      }
      setStatus("done");
      notifyReady?.(data.profile);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "calculate_failed");
    }
  }

  function confirmSkip() {
    setSkipConfirmOpen(false);
    onSkip?.();
  }

  return (
    <section className="relative rounded-2xl border border-white/10 bg-black/25 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-text-primary">{t("title")}</h3>
      <p className="mt-2 text-sm text-text-secondary">{t("subtitle")}</p>
      <p className="mt-1 text-xs text-text-dim">{t("privacy")}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-text-dim">
          {t("year")}
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
          {t("month")}
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
          {t("day")}
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
          {t("hour")}
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
          {t("minute")}
          <input
            type="number"
            min={0}
            max={59}
            value={form.minute ?? 0}
            onChange={(e) => setForm((p) => ({ ...p, minute: Number(e.target.value) }))}
            className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
          />
        </label>
        <div className="text-xs text-text-dim">
          <span className="block">{t("gender")}</span>
          {context === "chat" ? (
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={t("gender")}>
              {(["male", "female", "other"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, gender: g }))}
                  className={`rounded-md border px-2.5 py-2 text-sm transition-colors ${
                    form.gender === g
                      ? "border-cyan-400/50 bg-cyan-500/20 text-cyan-100"
                      : "border-white/15 bg-black/30 text-text-primary hover:border-white/25"
                  }`}
                >
                  {g === "male" ? t("genderMale") : g === "female" ? t("genderFemale") : t("genderOther")}
                </button>
              ))}
            </div>
          ) : (
            <select
              value={form.gender}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as LegacyBirthGender }))}
              className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
            >
              <option value="male">{t("genderMale")}</option>
              <option value="female">{t("genderFemale")}</option>
              <option value="other">{t("genderOther")}</option>
            </select>
          )}
        </div>
      </div>

      <label className="mt-3 block text-xs text-text-dim">
        {t("cityOptional")}
        <input
          type="text"
          value={form.city ?? ""}
          onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-2 text-sm text-text-primary"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={status === "loading"}
          className="rounded-full border border-cyan-300/40 bg-cyan-400/20 px-5 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-60"
        >
          {status === "loading" ? t("submitting") : t("submit")}
        </button>
        {canSkip ? (
          <button
            type="button"
            onClick={() => setSkipConfirmOpen(true)}
            className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/80"
          >
            {t("skip")}
          </button>
        ) : null}
      </div>

      {status === "done" ? <p className="mt-3 text-sm text-emerald-200">{t("done")}</p> : null}
      {status === "error" ? (
        <p className="mt-3 text-sm text-red-200">
          {t("errorGeneric")}
          {process.env.NODE_ENV === "development" && error ? ` (${error})` : null}
        </p>
      ) : null}

      {skipConfirmOpen ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="birth-skip-title"
        >
          <div className="max-w-md rounded-xl border border-white/15 bg-zinc-900 p-5 shadow-xl">
            <h4 id="birth-skip-title" className="text-base font-semibold text-text-primary">
              {t("skipConfirmTitle")}
            </h4>
            <p className="mt-2 text-sm text-text-secondary">{t("skipConfirmBody")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSkipConfirmOpen(false)}
                className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white"
              >
                {t("skipConfirmStay")}
              </button>
              <button
                type="button"
                onClick={confirmSkip}
                className="rounded-lg border border-white/25 px-4 py-2 text-sm text-white/90"
              >
                {t("skipConfirmLeave")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
