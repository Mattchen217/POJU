"use client";

import type { PointerEventHandler } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UserInput } from "@/types/oracle";

interface OracleInputProps {
  initialInput?: UserInput;
  onSubmit: (input: UserInput) => void;
  onClose: () => void;
}

const SHICHEN_OPTIONS = [
  { value: "zi", label: "11 PM – 1 AM · Midnight (Zi)" },
  { value: "chou", label: "1 AM – 3 AM · Late Night (Chou)" },
  { value: "yin", label: "3 AM – 5 AM · Pre-Dawn (Yin)" },
  { value: "mao", label: "5 AM – 7 AM · Sunrise (Mao)" },
  { value: "chen", label: "7 AM – 9 AM · Morning (Chen)" },
  { value: "si", label: "9 AM – 11 AM · Late Morning (Si)" },
  { value: "wu", label: "11 AM – 1 PM · Noon (Wu)" },
  { value: "wei", label: "1 PM – 3 PM · Early Afternoon (Wei)" },
  { value: "shen", label: "3 PM – 5 PM · Afternoon (Shen)" },
  { value: "you", label: "5 PM – 7 PM · Sunset (You)" },
  { value: "xu", label: "7 PM – 9 PM · Evening (Xu)" },
  { value: "hai", label: "9 PM – 11 PM · Night (Hai)" },
];

const YEAR_MIN = 1900;
const YEAR_MAX = new Date().getFullYear();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function OracleInput({ initialInput, onSubmit, onClose }: OracleInputProps) {
  const [year, setYear] = useState(initialInput?.birthYear ?? 2000);
  const [month, setMonth] = useState(initialInput?.birthMonth ?? 1);
  const [day, setDay] = useState(initialInput?.birthDay ?? 1);
  const [shichen, setShichen] = useState(initialInput?.birthShichen ?? "");
  const [question, setQuestion] = useState(initialInput?.question ?? "");
  const [showDatePicker, setShowDatePicker] = useState(false);

  const dayMax = useMemo(() => getDaysInMonth(year, month), [year, month]);

  useEffect(() => {
    setDay((prev) => clamp(prev, 1, dayMax));
  }, [dayMax]);

  const isValid = question.trim().length > 0 && shichen.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit({
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthShichen: shichen,
      question: question.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-[#0B0815] to-black">
      <div className="relative mx-auto max-w-xl px-6 py-16">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="mb-12 text-center">
          <h2 className="font-verse mb-6 text-2xl text-purple-200">You&apos;re about to ask</h2>

          <div className="mb-6 space-y-2 text-white/80 italic">
            <p>One question.</p>
            <p>Honest question.</p>
            <p>60 characters.</p>
          </div>

          <p className="italic text-purple-300">A sincere heart opens the channel.</p>

          <div className="mt-8 border-t border-white/10 pt-8">
            <p className="text-sm italic leading-relaxed text-white/60">
              There are no good glyphs and no bad glyphs.
              <br />
              Only honest mirrors of this moment.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <label className="mb-3 block text-sm tracking-wide text-white/80">
              Your birth date
            </label>
            <button
              type="button"
              onClick={() => setShowDatePicker(true)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-left text-white transition-colors hover:border-purple-300/60 focus:border-purple-400 focus:outline-none"
            >
              {formatDate(year, month, day)}
            </button>
          </div>

          <div>
            <label className="mb-3 block text-sm tracking-wide text-white/80">
              Your birth hour
            </label>
            <select
              value={shichen}
              onChange={(e) => setShichen(e.target.value)}
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white transition-colors focus:border-purple-400 focus:outline-none"
            >
              <option value="" className="bg-[#0B0815] text-white/50">
                Select birth hour
              </option>
              {SHICHEN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0B0815]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-3 block text-sm tracking-wide text-white/80">
              Please describe: what is trapping you, and what question or event are you seeking interpretation for?
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 60))}
              placeholder="e.g. Should I take this new job offer?"
              rows={3}
              className="w-full resize-none rounded-lg border border-white/20 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 transition-colors focus:border-purple-400 focus:outline-none"
            />
            <div className="mt-1 text-right text-xs text-white/40">
              {question.length} / 60
            </div>
            <p className="mt-3 text-sm italic text-white/50">
              Think of one thing. One real thing. If it&apos;s many, choose the one that weighs
              most.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`w-full rounded-full py-4 font-medium tracking-wide transition-all ${
              isValid
                ? "cursor-pointer bg-purple-500 text-white shadow-lg shadow-purple-500/30 hover:bg-purple-600"
                : "cursor-not-allowed bg-white/10 text-white/40"
            }`}
          >
            Begin →
          </button>
        </div>
      </div>

      {showDatePicker ? (
        <BirthDatePicker
          year={year}
          month={month}
          day={day}
          onCancel={() => setShowDatePicker(false)}
          onConfirm={(nextYear, nextMonth, nextDay) => {
            setYear(nextYear);
            setMonth(nextMonth);
            setDay(nextDay);
            setShowDatePicker(false);
          }}
        />
      ) : null}
    </div>
  );
}

function BirthDatePicker({
  year,
  month,
  day,
  onCancel,
  onConfirm,
}: {
  year: number;
  month: number;
  day: number;
  onCancel: () => void;
  onConfirm: (year: number, month: number, day: number) => void;
}) {
  const [draftYear, setDraftYear] = useState(year);
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftDay, setDraftDay] = useState(day);

  const draftDayMax = useMemo(
    () => getDaysInMonth(draftYear, draftMonth),
    [draftYear, draftMonth],
  );

  useEffect(() => {
    setDraftDay((prev) => clamp(prev, 1, draftDayMax));
  }, [draftDayMax]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 px-4 pb-6 pt-16 sm:items-center sm:pb-0">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0C0A16] p-4 shadow-2xl shadow-black/50 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-verse text-lg text-white">Select your birth date</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white/10 px-3 py-1 text-sm text-white/80 hover:bg-white/20"
          >
            Close
          </button>
        </div>

        <p className="mb-4 text-sm text-white/55">
          Center year starts around 2000. Use mouse wheel, drag, or up/down buttons.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <WheelColumn
            label="Year"
            min={YEAR_MIN}
            max={YEAR_MAX}
            value={draftYear}
            onChange={setDraftYear}
          />
          <WheelColumn
            label="Month"
            min={1}
            max={12}
            value={draftMonth}
            onChange={setDraftMonth}
            formatValue={(v) => String(v).padStart(2, "0")}
          />
          <WheelColumn
            label="Day"
            min={1}
            max={draftDayMax}
            value={draftDay}
            onChange={setDraftDay}
            formatValue={(v) => String(v).padStart(2, "0")}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="text-sm text-white/70">{formatDate(draftYear, draftMonth, draftDay)}</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(draftYear, draftMonth, draftDay)}
              className="rounded-full bg-purple-500 px-5 py-2 text-sm font-medium text-white hover:bg-purple-600"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WheelColumn({
  label,
  min,
  max,
  value,
  onChange,
  formatValue,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (next: number) => void;
  formatValue?: (value: number) => string;
}) {
  const dragStateRef = useRef<{ startY: number; startValue: number } | null>(null);
  const stepPx = 26;
  const display = formatValue ?? ((v: number) => String(v));
  const inRange = (v: number) => v >= min && v <= max;
  const maybeDisplay = (v: number) => (inRange(v) ? display(v) : "");

  const shift = (delta: number) => {
    onChange(clamp(value + delta, min, max));
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    dragStateRef.current = { startY: e.clientY, startValue: value };
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    const state = dragStateRef.current;
    if (!state) return;
    const delta = Math.round((state.startY - e.clientY) / stepPx);
    onChange(clamp(state.startValue + delta, min, max));
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = () => {
    dragStateRef.current = null;
  };

  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.03] p-2">
      <p className="mb-2 text-center text-xs tracking-[0.2em] text-white/50">{label}</p>
      <button
        type="button"
        onClick={() => shift(1)}
        className="mb-2 flex h-8 w-full items-center justify-center rounded-md bg-white/10 text-white/75 hover:bg-white/20"
        aria-label={`${label} up`}
      >
        ▲
      </button>
      <div
        className="relative h-[136px] touch-none overflow-hidden rounded-md border border-white/15 bg-black/35"
        onWheel={(e) => {
          e.preventDefault();
          shift(e.deltaY > 0 ? -1 : 1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-md border border-purple-300/55 bg-purple-300/10 py-1 text-center text-lg font-semibold text-white">
          {display(value)}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-white/35">
          <span>{maybeDisplay(value + 2)}</span>
          <span>{maybeDisplay(value + 1)}</span>
          <span className="opacity-0">{display(value)}</span>
          <span>{maybeDisplay(value - 1)}</span>
          <span>{maybeDisplay(value - 2)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => shift(-1)}
        className="mt-2 flex h-8 w-full items-center justify-center rounded-md bg-white/10 text-white/75 hover:bg-white/20"
        aria-label={`${label} down`}
      >
        ▼
      </button>
    </div>
  );
}
