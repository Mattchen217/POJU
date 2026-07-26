"use client";

import { useMemo, useState } from "react";
import { useLocale } from "next-intl";

import { useWorkspaceAtmosPrepare } from "@/components/workspace/WorkspaceAtmosPrepareContext";
import { AtmosPaywallModal } from "@/components/workspace/AtmosPaywallModal";
import { AtmosDayReadingSheet } from "@/components/workspace/AtmosDayReadingSheet";
import { AtmosDayInquiryModal } from "@/components/workspace/AtmosDayInquiryModal";
import {
  formatAtmosMonthLabel,
  getAtmosCalendarCopy,
  getAtmosWeekdayLabels,
} from "@/lib/atmos/atmos-calendar-copy";
import { buildAtmosEngineSnapshot } from "@/lib/atmos/build-atmos-engine-snapshot";
import { resolveBaziDayContext } from "@/lib/calculations/liuri";
import { zonedLocalToUtc } from "@/lib/syncro/true-solar-time";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

type Ymd = { year: number; month: number; day: number };

function addDays(ymd: Ymd, offset: number): Ymd {
  const dt = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + offset));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function formatKey(ymd: Ymd): string {
  return `${ymd.year}-${pad2(ymd.month)}-${pad2(ymd.day)}`;
}

function parseKey(dateKey: string): Ymd {
  const [y, m, d] = dateKey.split("-").map((x) => Number(x));
  return { year: y!, month: m!, day: d! };
}

function diffDays(a: Ymd, b: Ymd): number {
  const ta = Date.UTC(a.year, a.month - 1, a.day);
  const tb = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((tb - ta) / 86_400_000);
}

function startOfWeekSunday(ymd: Ymd): Ymd {
  const dt = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day));
  const dow = dt.getUTCDay();
  return addDays(ymd, -dow);
}

type CellTone = "past" | "active" | "beyond";

type DayCell = {
  dateKey: string;
  dayNum: number;
  month: number;
  monthLabel: string;
  label: string;
  tone: CellTone;
  isToday: boolean;
};

/** Traditional Sun–Sat calendar: 5×7; active window = today…+29. */
export function WorkspaceAtmosForecastStage() {
  const locale = useLocale();
  const copy = useMemo(() => getAtmosCalendarCopy(locale), [locale]);
  const weekdays = useMemo(() => getAtmosWeekdayLabels(locale), [locale]);

  const {
    profileId,
    matrixPayload,
    todayUnlocked,
    dayReadings,
    readingStatus,
    readingError,
    expandedDateKey,
    paywallOpen,
    setPaywallOpen,
    setTodayUnlocked,
    setReadingStatus,
    setReadingError,
    upsertDayReading,
    setExpandedDateKey,
  } = useWorkspaceAtmosPrepare();

  const [genBusy, setGenBusy] = useState(false);
  const [generatingDateKey, setGeneratingDateKey] = useState<string | null>(null);
  const [inquiryDateKey, setInquiryDateKey] = useState<string | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [pendingDateKey, setPendingDateKey] = useState<string | null>(null);

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC";

  const { todayKey, cells } = useMemo(() => {
    const ctx = resolveBaziDayContext(new Date(), timezone);
    const today = ctx.baziDay;
    const todayKeyLocal = formatKey(today);
    const gridStart = startOfWeekSunday(today);

    const built: DayCell[] = [];
    for (let i = 0; i < 35; i++) {
      const ymd = addDays(gridStart, i);
      const offset = diffDays(today, ymd);
      let tone: CellTone = "beyond";
      if (offset < 0) tone = "past";
      else if (offset >= 0 && offset < 30) tone = "active";

      const monthLabel = formatAtmosMonthLabel(ymd.month, locale);
      built.push({
        dateKey: formatKey(ymd),
        dayNum: ymd.day,
        month: ymd.month,
        monthLabel,
        label: `${ymd.day} ${monthLabel}`,
        tone,
        isToday: offset === 0,
      });
    }

    return { todayKey: todayKeyLocal, cells: built };
  }, [timezone, locale]);

  const rows = [
    cells.slice(0, 7),
    cells.slice(7, 14),
    cells.slice(14, 21),
    cells.slice(21, 28),
    cells.slice(28, 35),
  ];

  async function generateForDate(dateKey: string, question: string) {
    if (!matrixPayload?.structured || !profileId || genBusy) return;
    setGenBusy(true);
    setGeneratingDateKey(dateKey);
    setReadingStatus("generating");
    setReadingError(null);
    try {
      const ymd = parseKey(dateKey);
      const asOf = zonedLocalToUtc(
        { year: ymd.year, month: ymd.month, day: ymd.day, hour: 12, minute: 0, second: 0 },
        timezone,
      );
      const snapshot = buildAtmosEngineSnapshot({
        structured: matrixPayload.structured,
        date: asOf,
        timezone,
      });
      const res = await fetch("/api/atmos/daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot,
          locale,
          profile_id: profileId,
          user_question: question || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        date_key?: string;
        field_tone?: string;
        what_to_watch?: string;
        one_move?: string;
        full_text?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const key = data.date_key || dateKey;
      upsertDayReading({
        dateKey: key,
        fieldTone: data.field_tone ?? "",
        whatToWatch: data.what_to_watch ?? "",
        oneMove: data.one_move ?? "",
        fullText: data.full_text ?? "",
      });
      setExpandedDateKey(key);
    } catch (e) {
      console.error("[atmos-forecast]", e);
      setReadingStatus("error");
      setReadingError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenBusy(false);
      setGeneratingDateKey(null);
    }
  }

  function openParse(dateKey: string) {
    const existing = dayReadings[dateKey];
    if (existing) {
      setExpandedDateKey(dateKey);
      return;
    }
    setInquiryDateKey(dateKey);
  }

  function handleInquirySubmit(question: string) {
    const dateKey = inquiryDateKey;
    setInquiryDateKey(null);
    if (!dateKey) return;

    if (!todayUnlocked) {
      setPendingQuestion(question);
      setPendingDateKey(dateKey);
      setPaywallOpen(true);
      return;
    }
    void generateForDate(dateKey, question);
  }

  async function handleUnlocked() {
    setPaywallOpen(false);
    setTodayUnlocked(true);
    const dateKey = pendingDateKey || todayKey;
    const question = pendingQuestion;
    setPendingDateKey(null);
    setPendingQuestion("");
    if (dateKey) {
      await generateForDate(dateKey, question);
    }
  }

  const inquiryCell = inquiryDateKey
    ? cells.find((c) => c.dateKey === inquiryDateKey)
    : null;

  return (
    <div className="atmos-forecast">
      <header className="atmos-forecast__header atmos-forecast__header--center">
        <h2 className="atmos-forecast__title">{copy.forecastTitle}</h2>
      </header>

      <div className="atmos-forecast__cal" role="grid" aria-label={copy.forecastTitle}>
        <div className="atmos-forecast__weekdays" role="row">
          {weekdays.map((label) => (
            <div key={label} className="atmos-forecast__weekday" role="columnheader">
              {label}
            </div>
          ))}
        </div>

        {rows.map((row, ri) => (
          <div key={ri} className="atmos-forecast__row" role="row">
            {row.map((cell) => {
              const reading = dayReadings[cell.dateKey];
              const generating = generatingDateKey === cell.dateKey;
              const toneClass =
                cell.tone === "active"
                  ? " is-active"
                  : cell.tone === "past"
                    ? " is-past"
                    : " is-beyond";

              return (
                <div
                  key={cell.dateKey}
                  className={`atmos-forecast__cell${toneClass}${
                    cell.isToday ? " is-today" : ""
                  }${reading ? " is-ready" : ""}`}
                  role="gridcell"
                  aria-label={cell.label}
                >
                  <div className="atmos-forecast__date">
                    <span className="atmos-forecast__day-num">{cell.dayNum}</span>
                    <span className="atmos-forecast__month-tag">{cell.monthLabel}</span>
                  </div>

                  {cell.tone === "active" ? (
                    reading ? (
                      <button
                        type="button"
                        className="atmos-forecast__snippet"
                        onClick={() => setExpandedDateKey(cell.dateKey)}
                      >
                        <span className="atmos-forecast__snippet-text">
                          {reading.oneMove.slice(0, 48)}
                          {reading.oneMove.length > 48 ? "…" : ""}
                        </span>
                        <span className="atmos-forecast__expand">{copy.expandReading}</span>
                      </button>
                    ) : (
                      <div className="atmos-forecast__pending-row">
                        <span className="atmos-forecast__pending-label">
                          {generating ? copy.generating : copy.pendingLabel}
                        </span>
                        <button
                          type="button"
                          className="atmos-forecast__parse-btn"
                          onClick={() => openParse(cell.dateKey)}
                          disabled={generating || genBusy}
                          aria-busy={generating || undefined}
                        >
                          {copy.startParse}
                        </button>
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {readingError ? (
        <p className="atmos-forecast__error" role="alert">
          {readingError}
          <button
            type="button"
            className="atmos-forecast__retry"
            onClick={() =>
              void generateForDate(pendingDateKey || todayKey, pendingQuestion)
            }
          >
            {copy.retry}
          </button>
        </p>
      ) : null}

      {inquiryDateKey && inquiryCell ? (
        <AtmosDayInquiryModal
          title={copy.inquiry.title}
          hint={copy.inquiry.hint}
          placeholder={copy.inquiry.placeholder}
          tagsLabel={copy.inquiry.tagsLabel}
          submitLabel={copy.inquiry.submit}
          cancelLabel={copy.inquiry.cancel}
          dateLabel={inquiryDateKey}
          locale={locale}
          quickTags={copy.quickTags}
          busy={genBusy}
          onClose={() => setInquiryDateKey(null)}
          onSubmit={handleInquirySubmit}
        />
      ) : null}

      {paywallOpen ? (
        <AtmosPaywallModal
          locale={locale}
          busy={genBusy}
          onClose={() => {
            setPaywallOpen(false);
            setPendingDateKey(null);
            setPendingQuestion("");
          }}
          onUnlocked={() => void handleUnlocked()}
        />
      ) : null}

      {expandedDateKey && dayReadings[expandedDateKey] ? (
        <AtmosDayReadingSheet
          title={copy.readingTitle(expandedDateKey)}
          fullText={dayReadings[expandedDateKey]!.fullText}
          onClose={() => setExpandedDateKey(null)}
        />
      ) : null}
    </div>
  );
}
