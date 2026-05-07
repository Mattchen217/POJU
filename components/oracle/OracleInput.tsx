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

const SHICHEN_VALUES = SHICHEN_OPTIONS.map((opt) => opt.value);

const SHICHEN_SHORT_LABEL: Record<string, string> = {
  zi: "Zi",
  chou: "Chou",
  yin: "Yin",
  mao: "Mao",
  chen: "Chen",
  si: "Si",
  wu: "Wu",
  wei: "Wei",
  shen: "Shen",
  you: "You",
  xu: "Xu",
  hai: "Hai",
};

const SHICHEN_RANGE_LABEL: Record<string, string> = {
  zi: "11PM-1AM",
  chou: "1AM-3AM",
  yin: "3AM-5AM",
  mao: "5AM-7AM",
  chen: "7AM-9AM",
  si: "9AM-11AM",
  wu: "11AM-1PM",
  wei: "1PM-3PM",
  shen: "3PM-5PM",
  you: "5PM-7PM",
  xu: "7PM-9PM",
  hai: "9PM-11PM",
};

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
      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-20 flex h-10 w-10 items-center justify-center rounded-full text-white/60 transition-all hover:bg-white/10 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="rounded-2xl border border-white/10 bg-[#121022]/70 px-5 py-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-8 sm:py-10">
          <div className="mb-10 text-center">
            <p className="mb-3 text-xs uppercase tracking-[0.25em] text-purple-300/70">POJU Glyph</p>
            <h2 className="font-verse mb-4 text-3xl text-purple-100 sm:text-4xl">Ask one real question</h2>
            <p className="mx-auto max-w-2xl text-sm text-white/60 sm:text-base">
              Enter your birth date and hour, then describe the one question that truly matters right now.
            </p>
          </div>

          <div className="space-y-8">
            <div>
              <label className="mb-3 block text-sm tracking-wide text-white/80">
                Birth date and time
              </label>
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="w-full rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-left text-white transition-colors hover:border-purple-300/60 focus:border-purple-400 focus:outline-none"
              >
                {formatDate(year, month, day)}
                {shichen ? ` · ${SHICHEN_RANGE_LABEL[shichen] ?? shichen}` : ""}
              </button>
            </div>

            <div>
              <label className="mb-3 block text-sm tracking-wide text-white/80">
                What question or dilemma do you want interpreted?
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value.slice(0, 60))}
                placeholder="e.g. Should I take this new job offer?"
                rows={4}
                className="w-full resize-none rounded-xl border border-white/20 bg-white/[0.04] px-4 py-3 text-white placeholder:text-white/40 transition-colors focus:border-purple-400 focus:outline-none"
              />
              <div className="mt-1 text-right text-xs text-white/40">{question.length} / 60</div>
              <p className="mt-3 text-sm italic text-white/50">
                Keep it specific and honest. One real question gets the clearest reading.
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
      </div>

      {showDatePicker ? (
        <BirthDatePicker
          year={year}
          month={month}
          day={day}
          shichen={shichen}
          onCancel={() => setShowDatePicker(false)}
          onConfirm={(nextYear, nextMonth, nextDay, nextShichen) => {
            setYear(nextYear);
            setMonth(nextMonth);
            setDay(nextDay);
            setShichen(nextShichen);
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
  shichen,
  onCancel,
  onConfirm,
}: {
  year: number;
  month: number;
  day: number;
  shichen: string;
  onCancel: () => void;
  onConfirm: (year: number, month: number, day: number, shichen: string) => void;
}) {
  const [draftYear, setDraftYear] = useState(year);
  const [draftMonth, setDraftMonth] = useState(month);
  const [draftDay, setDraftDay] = useState(day);
  const [draftShichenIndex, setDraftShichenIndex] = useState(
    Math.max(0, SHICHEN_VALUES.indexOf(shichen || "zi")),
  );

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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
          <WheelColumn
            label="Time"
            min={0}
            max={SHICHEN_VALUES.length - 1}
            value={draftShichenIndex}
            onChange={setDraftShichenIndex}
            formatValue={(idx) => SHICHEN_RANGE_LABEL[SHICHEN_VALUES[idx] ?? "zi"] ?? "11PM-1AM"}
          />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="text-sm text-white/70">
            {formatDate(draftYear, draftMonth, draftDay)} ·{" "}
            {SHICHEN_OPTIONS.find((opt) => opt.value === SHICHEN_VALUES[draftShichenIndex])?.label ??
              "11 PM – 1 AM · Midnight (Zi)"}
          </div>
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
              onClick={() =>
                onConfirm(
                  draftYear,
                  draftMonth,
                  draftDay,
                  SHICHEN_VALUES[draftShichenIndex] ?? "zi",
                )
              }
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
  const stepPx = 34;
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
    // Dragging down should increase value; dragging up should decrease value.
    const delta = Math.round((e.clientY - state.startY) / stepPx);
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
        onClick={() => shift(-1)}
        className="mb-2 flex h-8 w-full items-center justify-center rounded-md bg-white/10 text-white/75 hover:bg-white/20"
        aria-label={`${label} up`}
      >
        ▲
      </button>
      <div
        className="relative h-[176px] touch-none overflow-hidden rounded-md border border-white/15 bg-black/35"
        onWheel={(e) => {
          e.preventDefault();
          // Wheel down should increase value.
          shift(e.deltaY > 0 ? 1 : -1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 rounded-md border border-purple-300/55 bg-purple-300/10 py-1 text-center text-[1.25rem] font-semibold leading-none text-white">
          {display(value)}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/35">
          {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
            const rowValue = value + offset;
            const isCenter = offset === 0;
            return (
              <span
                key={offset}
                className={`flex h-[34px] items-center justify-center leading-none ${
                  isCenter ? "opacity-0" : "text-[0.92rem]"
                }`}
              >
                {maybeDisplay(rowValue)}
              </span>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => shift(1)}
        className="mt-2 flex h-8 w-full items-center justify-center rounded-md bg-white/10 text-white/75 hover:bg-white/20"
        aria-label={`${label} down`}
      >
        ▼
      </button>
    </div>
  );
}
