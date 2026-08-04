/**
 * Phase-4 center: large dual-pane glass delivery book.
 * Left = cover + TOC; right = one section at a time with progressive next/waiting.
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { GlossaryText } from "@/components/cross-product/GlossaryText";
import {
  buildDeliveryShelfSlots,
  DELIVERY_SHELF_SLOT_IDS,
  type DeliveryShelfSlotId,
  type DeliveryShelfSlotState,
} from "@/lib/poju/delivery-shelf-slots";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import { DELIVERY_SECTION_HEADINGS, type DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  getStoredProfile,
  getStoredProfileRecord,
  listStoredProfiles,
} from "@/lib/profile/stored-profiles-service";
import type { Locale } from "@/lib/glossary/term-glossary";

import "@/styles/delivery-book-stage.css";
import "@/styles/delivery-report-v2.css";

export type DeliveryBookStageProps = {
  fullText: string;
  locale: string;
  sessionId: string;
  complete: boolean;
  originalQuestion?: string;
  profileId?: string | null;
  reportId?: string;
  /** Bump to jump to last-read prose page (rail open). */
  jumpRequest?: number;
  initialProseIndex?: number;
  onProseIndexChange?: (index: number) => void;
  /** Footer actions (download / email) when complete */
  footer?: ReactNode;
  interruptedSlot?: ReactNode;
  networkSlot?: ReactNode;
};

function isProseSlot(id: DeliveryShelfSlotId): boolean {
  return id !== "cover" && id !== "toc";
}

function truncateOneLine(text: string, maxChars: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

function formatProfileLine(
  p: {
    display_name?: string;
    birth_date: string;
    hour_period?: string | null;
    hour?: number;
    minute?: number;
  },
  locale: string,
): string {
  const name = p.display_name?.trim() || (locale.startsWith("zh") ? "档案" : "Profile");
  const birth = p.birth_date;
  let time = "";
  if (typeof p.hour === "number") {
    const mm = typeof p.minute === "number" ? String(p.minute).padStart(2, "0") : "00";
    time = `${String(p.hour).padStart(2, "0")}:${mm}`;
  } else if (p.hour_period) {
    time = p.hour_period;
  }
  return [name, birth, time].filter(Boolean).join(" · ");
}

function tocLabel(slotId: DeliveryShelfSlotId, locale: string): string {
  const zh = locale.startsWith("zh");
  if (slotId === "appendix") {
    return zh ? "附录 · 结构数据与术语说明" : "Appendix · Structural Data & Terms";
  }
  if (slotId === "cover" || slotId === "toc") return "";
  const h = DELIVERY_SECTION_HEADINGS[slotId as DeliverySegmentKey];
  return zh ? h.zh : h.en;
}

export function DeliveryBookStage({
  fullText,
  locale,
  sessionId,
  complete,
  originalQuestion = "",
  profileId = null,
  reportId,
  jumpRequest = 0,
  initialProseIndex = 0,
  onProseIndexChange,
  footer,
  interruptedSlot,
  networkSlot,
}: DeliveryBookStageProps) {
  const t = useTranslations("workspace.deliveryShelf");
  const zh = locale.startsWith("zh");

  const slots = useMemo(
    () => buildDeliveryShelfSlots(fullText, { locale, complete }),
    [fullText, locale, complete],
  );

  const readyById = useMemo(() => {
    const map = new Map<DeliveryShelfSlotId, Extract<DeliveryShelfSlotState, { kind: "ready" }>>();
    for (const s of slots) {
      if (s.kind === "ready") map.set(s.slotId, s);
    }
    return map;
  }, [slots]);

  const proseReady = useMemo(
    () =>
      DELIVERY_SHELF_SLOT_IDS.filter(isProseSlot)
        .map((id) => readyById.get(id))
        .filter((s): s is Extract<DeliveryShelfSlotState, { kind: "ready" }> => Boolean(s)),
    [readyById],
  );

  const bootstrapReady = Boolean(
    readyById.get("cover") && readyById.get("toc") && readyById.get("preface"),
  );

  const waitingSlot = slots.find((s) => s.kind === "waiting");

  const [viewIndex, setViewIndex] = useState(() => Math.max(0, initialProseIndex));
  const [profileLine, setProfileLine] = useState<string | null>(null);
  const [reportDate] = useState(() => new Date().toISOString().slice(0, 10));

  const setProseIndex = useCallback(
    (next: number | ((prev: number) => number)) => {
      setViewIndex((prev) => {
        const raw = typeof next === "function" ? next(prev) : next;
        return Math.max(0, Math.min(raw, Math.max(0, proseReady.length - 1)));
      });
    },
    [proseReady.length],
  );

  useEffect(() => {
    onProseIndexChange?.(viewIndex);
  }, [viewIndex, onProseIndexChange]);

  useEffect(() => {
    if (viewIndex > Math.max(0, proseReady.length - 1)) {
      setViewIndex(Math.max(0, proseReady.length - 1));
    }
  }, [proseReady.length, viewIndex]);

  useEffect(() => {
    if (jumpRequest <= 0 || proseReady.length === 0) return;
    setViewIndex(Math.min(Math.max(0, initialProseIndex), proseReady.length - 1));
  }, [jumpRequest, initialProseIndex, proseReady.length]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!profileId?.trim()) {
        setProfileLine(null);
        return;
      }
      try {
        const list = await listStoredProfiles();
        const hit = list.find((p) => p.profile_id === profileId);
        if (!cancelled && hit) {
          setProfileLine(formatProfileLine(hit, locale));
          return;
        }
        const [record, data] = await Promise.all([
          getStoredProfileRecord(profileId),
          getStoredProfile(profileId),
        ]);
        if (cancelled || !data) return;
        const b = data.birth_info;
        setProfileLine(
          formatProfileLine(
            {
              display_name: record?.display_name ?? "",
              birth_date: `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
              hour_period: b.hour_period,
              hour: typeof b.hour === "number" ? b.hour : undefined,
              minute: typeof b.minute === "number" ? b.minute : undefined,
            },
            locale,
          ),
        );
      } catch {
        if (!cancelled) setProfileLine(null);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileId, locale]);

  const active = proseReady[viewIndex] ?? null;
  const hasNextReady = viewIndex < proseReady.length - 1;
  const stillGenerating = !complete && Boolean(waitingSlot);
  const showPager = complete && proseReady.length > 0;
  const showNextButton = bootstrapReady && hasNextReady && !complete;
  const showCornerWait = bootstrapReady && !hasNextReady && stillGenerating && !complete;

  const goNext = useCallback(() => {
    setProseIndex((i) => i + 1);
  }, [setProseIndex]);

  const goPrev = useCallback(() => {
    setProseIndex((i) => i - 1);
  }, [setProseIndex]);

  const jumpToSlot = useCallback(
    (slotId: DeliveryShelfSlotId) => {
      if (!isProseSlot(slotId)) return;
      const idx = proseReady.findIndex((p) => p.slotId === slotId);
      if (idx >= 0) setProseIndex(idx);
    },
    [proseReady, setProseIndex],
  );

  const questionLine = truncateOneLine(
    originalQuestion ||
      readyById.get("cover")?.page.title?.replace(/^关于「|」的能量决策报告$/g, "").replace(/^Energy Decision Report ·\s*/i, "") ||
      "",
    zh ? 28 : 52,
  );

  const metaId =
    reportId?.trim() ||
    `POJU-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const metaDate = reportDate;

  const tocItems = DELIVERY_SHELF_SLOT_IDS.filter(isProseSlot);

  const modules = useMemo(() => {
    if (!active) return [];
    return buildDeliveryBookModules({
      pageTitle: active.page.title,
      body: active.page.body,
      dualLayer: active.page.dualLayer !== false,
      pageIndex: viewIndex,
    });
  }, [active, viewIndex]);

  const evidenceLabel = zh ? "依据与推理" : "Evidence & reasoning";
  const loc = locale as Locale;

  return (
    <div
      className="delivery-book-stage"
      data-locale={zh ? "zh" : locale.slice(0, 2)}
      data-bootstrap={bootstrapReady ? "1" : "0"}
    >
      {networkSlot}
      <div className="delivery-book-stage__card" role="region" aria-label={t("shelf_label")}>
        {!bootstrapReady ? (
          <div className="delivery-book-stage__boot" role="status" aria-live="polite">
            <div className="delivery-book-stage__boot-panes" aria-hidden>
              <div className="delivery-book-stage__boot-left" />
              <div className="delivery-book-stage__boot-right" />
            </div>
            <div className="delivery-book-stage__boot-center">
              <span className="delivery-book-stage__spin delivery-book-stage__spin--lg" aria-hidden />
              <div className="delivery-book-stage__wait-copy">
                <p>{t("long_wait_lead")}</p>
                <p>{t("long_wait_leave")}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="delivery-book-stage__panes">
            <aside className="delivery-book-stage__left">
              <div className="delivery-book-stage__brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="delivery-book-stage__logo"
                  src="/v2/LOGO.png"
                  alt=""
                  width={120}
                  height={36}
                  decoding="async"
                />
                <h1 className="delivery-book-stage__product-title">
                  {zh ? (
                    "破局方案"
                  ) : (
                    <>
                      Pivot
                      <br />
                      Breakthrough
                      <br />
                      Plan
                    </>
                  )}
                </h1>
                <div className="delivery-book-stage__gold-rule" aria-hidden />
                {questionLine ? (
                  <p className="delivery-book-stage__question" title={originalQuestion}>
                    {questionLine}
                  </p>
                ) : null}
              </div>

              <div className="delivery-book-stage__identity">
                {profileLine ? (
                  <div className="delivery-book-stage__identity-card">
                    <div className="delivery-book-stage__identity-label">{t("subject_label")}</div>
                    <div className="delivery-book-stage__identity-value">{profileLine}</div>
                  </div>
                ) : null}
                <div className="delivery-book-stage__meta">
                  <span className="delivery-book-stage__chip">
                    <span className="delivery-book-stage__chip-dot" aria-hidden />
                    {metaId}
                  </span>
                  <span className="delivery-book-stage__chip">{metaDate}</span>
                  <span className="delivery-book-stage__chip">
                    {zh ? "中文" : locale.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              </div>

              <nav className="delivery-book-stage__toc" aria-label={t("toc_nav_label")}>
                <div className="delivery-book-stage__toc-head">{t("toc_thumb")}</div>
                <ol className="delivery-book-stage__toc-list">
                  {tocItems.map((id, i) => {
                    const ready = readyById.has(id);
                    const activeHere = active?.slotId === id;
                    const label = tocLabel(id, locale);
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={
                            activeHere
                              ? "delivery-book-stage__toc-item delivery-book-stage__toc-item--active"
                              : ready
                                ? "delivery-book-stage__toc-item"
                                : "delivery-book-stage__toc-item delivery-book-stage__toc-item--pending"
                          }
                          disabled={!ready}
                          onClick={() => jumpToSlot(id)}
                        >
                          <span className="delivery-book-stage__toc-num">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="delivery-book-stage__toc-label">{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              <div className="delivery-book-stage__left-foot">
                <p>{t("reading_hint")}</p>
                <p>{t("privacy_line")}</p>
                <p>{t("disclaimer_line")}</p>
              </div>
            </aside>

            <section className="delivery-book-stage__right">
              {modules.length > 0 ? (
                <div className="delivery-book-stage__modules">
                  {modules.map((mod, mi) => (
                    <article
                      key={`${active?.slotId ?? "p"}-${mi}-${mod.title.slice(0, 24)}`}
                      className="delivery-book-stage__module"
                    >
                      <header className="delivery-book-stage__section-head">
                        {mod.showIndex ? (
                          <span className="delivery-book-stage__section-rail" aria-hidden>
                            <span className="delivery-book-stage__section-node" />
                          </span>
                        ) : (
                          <span className="delivery-book-stage__section-rail delivery-book-stage__section-rail--sub" aria-hidden>
                            <span className="delivery-book-stage__section-node delivery-book-stage__section-node--sub" />
                          </span>
                        )}
                        {mod.showIndex ? (
                          <span className="delivery-book-stage__section-num">{mod.indexLabel}</span>
                        ) : null}
                        <h2 className="delivery-book-stage__section-title">{mod.title}</h2>
                      </header>
                      <div className="delivery-book-stage__section-card">
                        {mod.body.trim() ? (
                          <div className="delivery-book-stage__section-body poju-delivery-v2__body">
                            <div className="poju-delivery-v2__prose">
                              <GlossaryText text={mod.body} locale={loc} layer="body" />
                            </div>
                          </div>
                        ) : null}
                        {mod.evidence.trim() ? (
                          <EvidenceBlock
                            label={evidenceLabel}
                            defaultOpen={false}
                            className="delivery-book-stage__evidence"
                          >
                            <div className="poju-delivery-v2__evidence-body">
                              <GlossaryText
                                text={mod.evidence}
                                locale={loc}
                                layer="evidence"
                                bracketSoft={false}
                              />
                            </div>
                          </EvidenceBlock>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="delivery-book-stage__right-empty" aria-hidden />
              )}
            </section>
          </div>
        )}

        {(showPager || showNextButton || showCornerWait) && bootstrapReady ? (
          <div className="delivery-book-stage__chrome" role="navigation" aria-label={t("shelf_label")}>
            {showPager ? (
              <div className="delivery-book-stage__pager">
                <button
                  type="button"
                  className="delivery-book-stage__nav-btn"
                  disabled={viewIndex <= 0}
                  onClick={goPrev}
                >
                  {t("prev_page")}
                </button>
                <span className="delivery-book-stage__pager-pos">
                  {viewIndex + 1} / {proseReady.length}
                </span>
                <button
                  type="button"
                  className="delivery-book-stage__nav-btn"
                  disabled={viewIndex >= proseReady.length - 1}
                  onClick={goNext}
                >
                  {t("next_page")}
                </button>
              </div>
            ) : null}

            {showNextButton ? (
              <button type="button" className="delivery-book-stage__next-btn" onClick={goNext}>
                {t("next_page")}
              </button>
            ) : null}

            {showCornerWait ? (
              <div className="delivery-book-stage__corner-wait" role="status" aria-live="polite">
                <span className="delivery-book-stage__spin" aria-hidden />
                <span>
                  {t("writing_next_page", {
                    n: waitingSlot?.pageNumber ?? proseReady.length + 1,
                  })}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {interruptedSlot}
      {footer ? <div className="delivery-book-stage__cta">{footer}</div> : null}
    </div>
  );
}
