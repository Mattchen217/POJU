"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import {
  addDaysKey,
  diffDaysKey,
  formatDateKey,
  parseDateKey,
  startOfWeekSundayKey,
} from "@/lib/companion/date-keys";
import type { CompanionDayCards, CompanionDayRecord } from "@/lib/companion/types";
import { COMPANION_WINDOW_DAYS } from "@/lib/companion/types";
import { formatAtmosMonthLabel, getAtmosWeekdayLabels } from "@/lib/atmos/atmos-calendar-copy";
import type { ProfileStructured } from "@/lib/calculations/build-profile-structured";
import { resolveBaziDayContext } from "@/lib/calculations/liuri";

type PublicJob = {
  id: string;
  session_id: string;
  email: string | null;
  timezone: string;
  mail_opt_in: boolean;
  delivery_day_key: string;
  ends_day_key: string;
  brief: {
    primary: { name: string };
    backup: { name: string };
    locale: string;
  };
  days: CompanionDayRecord[];
};

type Props = {
  sessionId: string;
  fullText: string;
  structured: ProfileStructured | null;
  originalQuestion?: string;
  /** When false, frame stays hidden (delivery still streaming). */
  ready: boolean;
  profileId?: string | null;
  initialEmail?: string | null;
};

type CellTone = "past" | "active" | "beyond";

type DayCell = {
  dateKey: string;
  dayNum: number;
  monthLabel: string;
  tone: CellTone;
  isToday: boolean;
  dayIndex: number | null;
};

function buildCells(
  deliveryDayKey: string,
  todayKey: string,
  locale: string,
): DayCell[] {
  const gridStart = startOfWeekSundayKey(deliveryDayKey);
  const built: DayCell[] = [];
  for (let i = 0; i < 35; i++) {
    const dateKey = addDaysKey(gridStart, i);
    const offsetFromDelivery = diffDaysKey(deliveryDayKey, dateKey);
    let tone: CellTone = "beyond";
    if (offsetFromDelivery < 0) tone = "past";
    else if (offsetFromDelivery >= 0 && offsetFromDelivery < COMPANION_WINDOW_DAYS) {
      tone = "active";
    }
    const ymd = parseDateKey(dateKey);
    built.push({
      dateKey,
      dayNum: ymd.day,
      monthLabel: formatAtmosMonthLabel(ymd.month, locale),
      tone,
      isToday: dateKey === todayKey,
      dayIndex:
        tone === "active" && offsetFromDelivery >= 0 && offsetFromDelivery < COMPANION_WINDOW_DAYS
          ? offsetFromDelivery
          : null,
    });
  }
  return built;
}

export function PojuCompanionFrame({
  sessionId,
  fullText,
  structured,
  originalQuestion,
  ready,
  profileId,
  initialEmail,
}: Props) {
  const locale = useLocale();
  const t = useTranslations("poju.companion");
  const weekdays = useMemo(() => getAtmosWeekdayLabels(locale), [locale]);

  const [job, setJob] = useState<PublicJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [emailDraft, setEmailDraft] = useState(initialEmail ?? "");

  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC";
  const todayKey = useMemo(
    () => formatDateKey(resolveBaziDayContext(new Date(), timezone).baziDay),
    [timezone],
  );

  const ensureJob = useCallback(async () => {
    if (!ready || !structured || !fullText.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/companion/job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          profile_id: profileId ?? null,
          full_text: fullText,
          locale,
          original_question: originalQuestion,
          structured,
          timezone,
          email: emailDraft.trim() || null,
          mail_opt_in: true,
          deliver_day_zero: true,
        }),
      });
      const data = (await res.json()) as { job?: PublicJob; error?: string };
      if (!res.ok || !data.job) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setJob(data.job);
      if (data.job.email) setEmailDraft(data.job.email);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    busy,
    emailDraft,
    fullText,
    locale,
    originalQuestion,
    profileId,
    ready,
    sessionId,
    structured,
    timezone,
  ]);

  useEffect(() => {
    if (!ready || !structured || job) return;
    void ensureJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seal once when ready
  }, [ready, structured, sessionId]);

  const cells = useMemo(() => {
    if (!job) return [];
    return buildCells(job.delivery_day_key, todayKey, locale);
  }, [job, todayKey, locale]);

  const rows = [
    cells.slice(0, 7),
    cells.slice(7, 14),
    cells.slice(14, 21),
    cells.slice(21, 28),
    cells.slice(28, 35),
  ];

  async function toggleMail(next: boolean) {
    if (!job) return;
    setBusy(true);
    try {
      const res = await fetch("/api/companion/job", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: job.id,
          mail_opt_in: next,
          email: emailDraft.trim() || job.email,
        }),
      });
      const data = (await res.json()) as { job?: PublicJob; error?: string };
      if (!res.ok || !data.job) throw new Error(data.error || "patch_failed");
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const expandedDay =
    expandedIndex != null && job ? job.days[expandedIndex] : null;
  const expandedCards = expandedDay?.cards as CompanionDayCards | null;

  if (!ready) return null;

  return (
    <section className="poju-companion-frame" aria-label={t("frame_title")}>
      <header className="poju-companion-frame__header">
        <h2 className="poju-companion-frame__title">{t("frame_title")}</h2>
        <p className="poju-companion-frame__sub">{t("frame_sub")}</p>
      </header>

      {!structured ? (
        <p className="poju-companion-frame__error" role="status">
          {t("need_chart")}
        </p>
      ) : null}

      {error ? (
        <p className="poju-companion-frame__error" role="alert">
          {error}
          <button type="button" className="poju-companion-frame__retry" onClick={() => void ensureJob()}>
            {t("retry")}
          </button>
        </p>
      ) : null}

      {busy && !job ? (
        <p className="poju-companion-frame__pending" role="status">
          {t("preparing")}
        </p>
      ) : null}

      {job ? (
        <>
          <div className="atmos-forecast__cal" role="grid" aria-label={t("frame_title")}>
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
                  const dayRec =
                    cell.dayIndex != null ? job.days[cell.dayIndex] : null;
                  const readyDay =
                    dayRec &&
                    (dayRec.status === "delivered" ||
                      dayRec.status === "sent" ||
                      dayRec.status === "generated");
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
                      }${readyDay ? " is-ready" : ""}`}
                      role="gridcell"
                    >
                      <div className="atmos-forecast__date">
                        <span className="atmos-forecast__day-num">{cell.dayNum}</span>
                        <span className="atmos-forecast__month-tag">{cell.monthLabel}</span>
                      </div>
                      {cell.tone === "active" && cell.dayIndex != null ? (
                        readyDay && dayRec?.cards ? (
                          <button
                            type="button"
                            className="atmos-forecast__snippet"
                            onClick={() => setExpandedIndex(cell.dayIndex)}
                          >
                            <span className="atmos-forecast__snippet-text">
                              {dayRec.cards.primary.one_move.slice(0, 48)}
                              {dayRec.cards.primary.one_move.length > 48 ? "…" : ""}
                            </span>
                            <span className="atmos-forecast__expand">{t("open_day")}</span>
                          </button>
                        ) : (
                          <div className="atmos-forecast__pending-row">
                            <span className="atmos-forecast__pending-label">
                              {dayRec?.status === "failed"
                                ? t("day_failed")
                                : t("day_pending")}
                            </span>
                          </div>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="poju-companion-frame__mail">
            <label className="poju-companion-frame__toggle">
              <input
                type="checkbox"
                checked={job.mail_opt_in}
                disabled={busy}
                onChange={(e) => void toggleMail(e.target.checked)}
              />
              <span>{t("mail_opt_in")}</span>
            </label>
            {job.mail_opt_in ? (
              <input
                type="email"
                className="poju-companion-frame__email"
                value={emailDraft}
                placeholder={t("email_placeholder")}
                onChange={(e) => setEmailDraft(e.target.value)}
                onBlur={() => {
                  if (emailDraft.trim() && emailDraft !== job.email) {
                    void toggleMail(true);
                  }
                }}
              />
            ) : null}
          </div>
        </>
      ) : null}

      {expandedCards && expandedDay ? (
        <div className="poju-companion-sheet" role="dialog" aria-modal="true">
          <div className="poju-companion-sheet__panel">
            <header className="poju-companion-sheet__head">
              <h3>
                {t("day_title", {
                  date: expandedDay.date_key,
                  n: (expandedIndex ?? 0) + 1,
                })}
              </h3>
              <button type="button" onClick={() => setExpandedIndex(null)}>
                {t("close")}
              </button>
            </header>
            <CompanionCardBlock
              title={`${t("primary")} · ${job?.brief.primary.name ?? ""}`}
              cards={expandedCards.primary}
            />
            <CompanionCardBlock
              title={`${t("backup")} · ${job?.brief.backup.name ?? ""}`}
              cards={expandedCards.backup}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CompanionCardBlock({
  title,
  cards,
}: {
  title: string;
  cards: CompanionDayCards["primary"];
}) {
  const t = useTranslations("poju.companion");
  return (
    <article className="poju-companion-sheet__card">
      <h4>{title}</h4>
      <h5>{t("field_tone")}</h5>
      <p>{cards.field_tone}</p>
      <h5>{t("against_plan")}</h5>
      <p>{cards.against_plan}</p>
      <h5>{t("one_move")}</h5>
      <p>{cards.one_move}</p>
    </article>
  );
}
