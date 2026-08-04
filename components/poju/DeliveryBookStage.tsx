/**
 * Phase-4 center: large dual-pane glass delivery book.
 * Left = cover + TOC; right = one section at a time with progressive next/waiting.
 */

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DeliveryAudioChrome } from "@/components/poju/DeliveryAudioChrome";
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
  /** Left chrome actions (download / email) — same style as pager buttons. */
  chromeLeft?: ReactNode;
  /** Optional slot below the book (interrupted / network). */
  interruptedSlot?: ReactNode;
  networkSlot?: ReactNode;
};

function isProseSlot(id: DeliveryShelfSlotId): boolean {
  return id !== "cover" && id !== "toc";
}

function formatBirthDateOnly(birthDate: string): string {
  const m = birthDate.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? birthDate.trim();
}

/** Strip "Part I ·" / "第一部分 ·" from TOC and page titles for display. */
function stripPartPrefix(title: string): string {
  return title
    .replace(/^第[一二三四五六七八九十百零〇两\d]+部分\s*[·•\-—–]\s*/u, "")
    .replace(/^Part\s+[IVXLCDM\d]+\s*[·•\-—–]\s*/iu, "")
    .trim();
}

function tocLabel(slotId: DeliveryShelfSlotId, locale: string): string {
  const zh = locale.startsWith("zh");
  if (slotId === "appendix") {
    return zh ? "结构数据与术语说明" : "Structural Data & Terms";
  }
  if (slotId === "cover" || slotId === "toc") return "";
  const h = DELIVERY_SECTION_HEADINGS[slotId as DeliverySegmentKey];
  return stripPartPrefix(zh ? h.zh : h.en);
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
  chromeLeft = null,
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
          setProfileLine(formatBirthDateOnly(hit.birth_date));
          return;
        }
        const data = await getStoredProfile(profileId);
        if (cancelled || !data) return;
        const b = data.birth_info;
        setProfileLine(
          formatBirthDateOnly(
            `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
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

  const questionLine = (
    originalQuestion ||
    readyById
      .get("cover")
      ?.page.title?.replace(/^关于「|」的能量决策报告$/g, "")
      .replace(/^Energy Decision Report ·\s*/i, "") ||
    ""
  ).trim();

  const metaId =
    reportId?.trim()?.replace(/^POJU-/i, "PIVOT-") ||
    `PIVOT-${sessionId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
  const metaDate = reportDate;
  const pageTitleDisplay = active ? stripPartPrefix(active.page.title) : "";

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
                <div className="delivery-book-stage__brand-row">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="delivery-book-stage__logo"
                    src="/v2/LOGO.png"
                    alt=""
                    width={120}
                    height={36}
                    decoding="async"
                  />
                </div>
                <h1 className="delivery-book-stage__product-title">
                  <span>Pivot</span>
                  <span>Breakthrough</span>
                  <span>Plan</span>
                </h1>
              </div>

              <div className="delivery-book-stage__meta-card">
                {questionLine ? (
                  <p className="delivery-book-stage__meta-question" title={questionLine}>
                    {questionLine}
                  </p>
                ) : null}
                <div className="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
                  {profileLine ? (
                    <span className="delivery-book-stage__meta-cell">
                      <span className="material-symbols-outlined" aria-hidden>
                        person
                      </span>
                      <span className="delivery-book-stage__meta-text">{profileLine}</span>
                    </span>
                  ) : null}
                  <span className="delivery-book-stage__meta-cell">
                    <span className="material-symbols-outlined" aria-hidden>
                      calendar_today
                    </span>
                    <span className="delivery-book-stage__meta-text">{metaDate}</span>
                  </span>
                </div>
                <div className="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
                  <span className="delivery-book-stage__meta-cell">
                    <span className="material-symbols-outlined" aria-hidden>
                      tag
                    </span>
                    <span className="delivery-book-stage__meta-text delivery-book-stage__meta-text--mono">
                      {metaId}
                    </span>
                  </span>
                  <span className="delivery-book-stage__meta-cell">
                    <span className="material-symbols-outlined" aria-hidden>
                      translate
                    </span>
                    <span className="delivery-book-stage__meta-text">
                      {zh ? "中文" : locale.slice(0, 2).toUpperCase()}
                    </span>
                  </span>
                </div>
              </div>

              <nav className="delivery-book-stage__toc" aria-label={t("toc_nav_label")}>
                <div className="delivery-book-stage__toc-head">
                  <span className="delivery-book-stage__toc-head-rule" aria-hidden />
                  {t("toc_thumb")}
                </div>
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
              {pageTitleDisplay ? (
                <h1 className="delivery-book-stage__page-title">{pageTitleDisplay}</h1>
              ) : null}
              {modules.length > 0 ? (
                <div className="delivery-book-stage__modules">
                  {modules.map((mod, mi) => {
                    const hideTitle =
                      Boolean(pageTitleDisplay) &&
                      stripPartPrefix(mod.title).trim() === pageTitleDisplay.trim();
                    const isLast = mi === modules.length - 1;
                    return (
                      <article
                        key={`${active?.slotId ?? "p"}-${mi}-${mod.title.slice(0, 24)}`}
                        className={`delivery-book-stage__module${isLast ? " is-last" : ""}`}
                      >
                        {!hideTitle ? (
                          <header className="delivery-book-stage__section-head">
                            <span className="delivery-book-stage__section-dot" aria-hidden />
                            <h2 className="delivery-book-stage__section-title">
                              {stripPartPrefix(mod.title)}
                            </h2>
                          </header>
                        ) : null}
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
                              toggleIcon="play"
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
                    );
                  })}
                </div>
              ) : (
                <div className="delivery-book-stage__right-empty" aria-hidden />
              )}
            </section>
          </div>
        )}

        {bootstrapReady ? (
          <div className="delivery-book-stage__chrome" role="navigation" aria-label={t("shelf_label")}>
            <div className="delivery-book-stage__chrome-left">
              {chromeLeft}
            </div>
            <div className="delivery-book-stage__chrome-center">
              <DeliveryAudioChrome disabled={!complete && !showPager} />
            </div>
            <div className="delivery-book-stage__chrome-right">
              {showPager ? (
                <div className="delivery-book-stage__pager">
                  <button
                    type="button"
                    className="delivery-book-stage__chrome-btn"
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
                    className="delivery-book-stage__chrome-btn"
                    disabled={viewIndex >= proseReady.length - 1}
                    onClick={goNext}
                  >
                    {t("next_page")}
                  </button>
                </div>
              ) : null}

              {showNextButton ? (
                <button type="button" className="delivery-book-stage__chrome-btn" onClick={goNext}>
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
          </div>
        ) : null}
      </div>

      {interruptedSlot}
    </div>
  );
}
