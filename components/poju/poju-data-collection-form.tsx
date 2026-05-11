"use client";

import { useState } from "react";
import { getPojuPhaseCopy } from "@/lib/poju/phase-messages";
import type { BirthGender } from "@/lib/profile/types";
import { saveUserProfile } from "@/lib/profile/storage";

type Props = {
  sessionId: string;
  locale: string;
  onComplete: (payload: { reply: string; phase: number }) => void;
};

const CURRENT_YEAR = new Date().getFullYear();

export function PojuDataCollectionForm({ sessionId, locale, onComplete }: Props) {
  const copy = getPojuPhaseCopy(locale);
  const [displayName, setDisplayName] = useState("");
  const [year, setYear] = useState(1990);
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [hour, setHour] = useState(12);
  const [minute, setMinute] = useState(0);
  const [gender, setGender] = useState<BirthGender>("other");
  const [city, setCity] = useState("");
  const [unknownTime, setUnknownTime] = useState(false);
  const [pending, setPending] = useState<null | "save" | "skip">(null);
  const [error, setError] = useState("");

  async function submitSkip() {
    setPending("skip");
    setError("");
    try {
      const res = await fetch("/api/poju/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, locale, skip: true }),
      });
      const data = (await res.json()) as { ok?: boolean; reply?: string; phase?: number; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "request_failed");
        setPending(null);
        return;
      }
      onComplete({ reply: data.reply ?? "", phase: data.phase ?? 3 });
      setPending(null);
    } catch {
      setError("network_error");
      setPending(null);
    }
  }

  async function submitSave() {
    setPending("save");
    setError("");
    const effHour = unknownTime ? 12 : hour;
    const effMinute = unknownTime ? 0 : minute;
    try {
      const res = await fetch("/api/poju/collect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          locale,
          displayName: displayName.trim(),
          year,
          month,
          day,
          hour: effHour,
          minute: effMinute,
          gender,
          city: city.trim(),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reply?: string;
        phase?: number;
        profile?: import("@/lib/profile/types").UserProfile;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "request_failed");
        setPending(null);
        return;
      }
      if (data.profile) {
        await saveUserProfile(data.profile);
      }
      onComplete({ reply: data.reply ?? "", phase: data.phase ?? 3 });
      setPending(null);
    } catch {
      setError("network_error");
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <section className="w-full rounded-2xl border border-cyan-400/25 bg-cyan-950/20 p-4 shadow-lg backdrop-blur-md sm:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-100/95">{copy.formTitle}</h3>
      <p className="mt-2 text-xs leading-relaxed text-cyan-100/75">{copy.formSubtitle}</p>

      <div className="mt-4 space-y-3">
        <label className="block text-xs text-cyan-100/80">
          {copy.fieldDisplayName}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value.slice(0, 80))}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-on-surface"
          />
        </label>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label className="text-xs text-cyan-100/80">
            {locale === "zh" ? "年" : "Year"}
            <input
              type="number"
              min={1900}
              max={CURRENT_YEAR}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            />
          </label>
          <label className="text-xs text-cyan-100/80">
            {locale === "zh" ? "月" : "Month"}
            <input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            />
          </label>
          <label className="text-xs text-cyan-100/80">
            {locale === "zh" ? "日" : "Day"}
            <input
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            />
          </label>
          <label className="text-xs text-cyan-100/80">
            {copy.fieldGender}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as BirthGender)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            >
              <option value="male">{locale === "zh" ? "男" : "Male"}</option>
              <option value="female">{locale === "zh" ? "女" : "Female"}</option>
              <option value="other">{locale === "zh" ? "其他" : "Other"}</option>
            </select>
          </label>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-cyan-100/85">
          <input type="checkbox" checked={unknownTime} onChange={(e) => setUnknownTime(e.target.checked)} className="rounded border-white/30" />
          {copy.fieldUnknownTime}
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className={`text-xs text-cyan-100/80 ${unknownTime ? "opacity-40" : ""}`}>
            {copy.fieldBirthTime}
            <input
              type="number"
              min={0}
              max={23}
              disabled={unknownTime}
              value={hour}
              onChange={(e) => setHour(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            />
          </label>
          <label className={`text-xs text-cyan-100/80 ${unknownTime ? "opacity-40" : ""}`}>
            {locale === "zh" ? "分" : "Minute"}
            <input
              type="number"
              min={0}
              max={59}
              disabled={unknownTime}
              value={minute}
              onChange={(e) => setMinute(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-2 py-2 text-sm text-on-surface"
            />
          </label>
        </div>

        <label className="block text-xs text-cyan-100/80">
          {copy.fieldCity}
          <input
            value={city}
            onChange={(e) => setCity(e.target.value.slice(0, 120))}
            className="mt-1 w-full rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-sm text-on-surface"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitSave()}
          className="rounded-full bg-cyan-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending === "save" ? copy.saving : copy.submitSaveProfile}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submitSkip()}
          className="rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-medium text-cyan-100/90 disabled:opacity-50"
        >
          {pending === "skip" ? copy.saving : copy.skipGeneric}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
    </section>
  );
}
