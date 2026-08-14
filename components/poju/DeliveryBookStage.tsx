/**
 * Phase-4 center: large dual-pane glass delivery book.
 * Left = cover + TOC; right = one section at a time with progressive next/waiting.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DeliveryAudioChrome } from "@/components/poju/DeliveryAudioChrome";
import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import { DeliveryEnergyDashboard } from "@/components/poju/DeliveryEnergyDashboard";
import { DeliveryThirtyDayGantt } from "@/components/poju/DeliveryThirtyDayGantt";
import { DeliveryPageScanCard } from "@/components/poju/DeliveryPageScanCard";
import { DeliveryThreePhaseRoadmap } from "@/components/poju/DeliveryThreePhaseRoadmap";
import {
  DeliveryPageSlots,
  DeliveryPageSlotSkeleton,
  deliveryMarkdownWithoutSchemaFence,
} from "@/components/poju/delivery-pages/DeliveryPageSlots";
import { extractPageSchemaFromMarkdown } from "@/lib/llm/pro/delivery/page-schema/render";
import { EvidenceBlock } from "@/components/cross-product/EvidenceBlock";
import { GlossaryText } from "@/components/cross-product/GlossaryText";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import {
  buildDeliveryShelfSlots,
  DELIVERY_SHELF_SLOT_IDS,
  isDeliveryProseShelfSlot,
  nextSequentialProseGap,
  sequentialDeliveryProseReady,
  type DeliveryShelfSlotId,
  type DeliveryShelfSlotState,
} from "@/lib/poju/delivery-shelf-slots";
import { buildDeliveryBookModules } from "@/lib/poju/build-delivery-book-modules";
import {
  collectDeliveryEvidenceTerms,
  isDeliveryAppendixEmptyPlaceholder,
} from "@/lib/poju/collect-delivery-evidence-terms";
import { type DeliverySegmentKey } from "@/lib/llm/pro/delivery/delivery-schema";
import {
  parsePojuStructPayloads,
  stripPojuStructFences,
  stripRenderedStructFallbacks,
  buildEnergyDashboardStruct,
  localizePageScanCardLabels,
  localizeThirtyDayGanttLabels,
  normalizePageScanCardStruct,
  normalizeThirtyDayGanttStruct,
  type EnergyDashboardStruct,
  type ThirtyDayGanttStruct,
  type ThreePhaseRoadmapStruct,
  type PageScanCardStruct,
} from "@/lib/llm/pro/delivery/poju-struct-blocks";
import {
  deliveryAppendixCopy,
  deliveryEvidenceLabelPlain,
  deliveryRxMethodsLabel,
  deliveryRxStrategyLabel,
  deliverySectionHeading,
} from "@/lib/llm/pro/delivery/delivery-locale";
import { buildMetaphysicsPackFromProfile } from "@/lib/calculations/metaphysics-pack";
import {
  getStoredProfile,
  listStoredProfiles,
} from "@/lib/profile/stored-profiles-service";
import type { Locale } from "@/lib/glossary/term-glossary";

import "@/styles/delivery-book-stage.css";
import "@/styles/delivery-report-v2.css";

const PREV_ICON = "/v2/shangicon.svg";
const NEXT_ICON = "/v2/xiaicon.svg";

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
  return isDeliveryProseShelfSlot(id);
}

/** Corner-wait page index: prose 1–10 only (cover/toc excluded). */
function cornerWaitPageNumber(
  waiting: { pageNumber: number } | null | undefined,
  readyProseCount: number,
): number {
  const n = waiting?.pageNumber ?? readyProseCount + 1;
  return Math.max(1, Math.min(10, n));
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

/** Brand name must stay on one line in narrow footers. */
function keepEasternOsTogether(text: string): string {
  return text.replace(/Eastern OS/g, "Eastern\u00A0OS");
}

function tocLabel(slotId: DeliveryShelfSlotId, locale: string): string {
  if (slotId === "appendix") {
    return deliveryAppendixCopy(locale).heading;
  }
  if (slotId === "cover" || slotId === "toc") return "";
  return stripPartPrefix(deliverySectionHeading(slotId as DeliverySegmentKey, locale));
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

  const proseReady = useMemo(() => sequentialDeliveryProseReady(slots), [slots]);

  const bootstrapReady = Boolean(
    readyById.get("cover") && readyById.get("toc") && readyById.get("direct_answer"),
  );

  /** Next prose gap in order (may already have later pages buffered). */
  const sequentialGap = useMemo(
    () => (!complete ? nextSequentialProseGap(slots) : null),
    [slots, complete],
  );

  const [viewIndex, setViewIndex] = useState(() => Math.max(0, initialProseIndex));
  const [profileLine, setProfileLine] = useState<string | null>(null);
  const [reportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const rightViewportRef = useRef<HTMLDivElement | null>(null);

  /** Page turn → right pane starts at the top. */
  useEffect(() => {
    const el = rightViewportRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [viewIndex]);

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

  const [liveDashboard, setLiveDashboard] = useState<EnergyDashboardStruct | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      if (!profileId?.trim()) {
        setProfileLine(null);
        setLiveDashboard(null);
        return;
      }
      try {
        const list = await listStoredProfiles();
        const hit = list.find((p) => p.profile_id === profileId);
        if (!cancelled && hit) {
          setProfileLine(formatBirthDateOnly(hit.birth_date));
        }
        const data = await getStoredProfile(profileId);
        if (cancelled || !data) return;
        if (!hit) {
          const b = data.birth_info;
          setProfileLine(
            formatBirthDateOnly(
              `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`,
            ),
          );
        }
        // Recompute chart scores for empty dashboards baked into older reports.
        try {
          const profile = data.user_profile;
          if (!profile?.birth) {
            if (!cancelled) setLiveDashboard(null);
          } else {
            const pack = buildMetaphysicsPackFromProfile(profile);
            const dash = buildEnergyDashboardStruct(pack, locale);
            if (!cancelled) setLiveDashboard(dash.source === "empty" ? null : dash);
          }
        } catch {
          if (!cancelled) setLiveDashboard(null);
        }
      } catch {
        if (!cancelled) {
          setProfileLine(null);
          setLiveDashboard(null);
        }
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileId, locale]);

  const active = proseReady[viewIndex] ?? null;
  const hasNextReady = viewIndex < proseReady.length - 1;
  const hasPrevReady = viewIndex > 0;
  const stillGenerating = !complete && Boolean(sequentialGap);
  const showPager = complete && proseReady.length > 0;
  /** While streaming: prev when a prior page exists; next when next sequential page ready; else wait tip. */
  const showPrevButton = hasPrevReady && !complete;
  const showNextButton = hasNextReady && !complete;
  const showCornerWait = proseReady.length > 0 && !hasNextReady && stillGenerating && !complete;
  /** First pages not ready yet — left chrome stays up; wait copy lives on the right. */
  const awaitingFirstPage = !active;

  const unlockedSlotIds = useMemo(
    () => new Set(proseReady.map((p) => p.slotId)),
    [proseReady],
  );

  const goNext = useCallback(() => {
    setProseIndex((i) => i + 1);
  }, [setProseIndex]);

  const goPrev = useCallback(() => {
    setProseIndex((i) => i - 1);
  }, [setProseIndex]);

  const jumpToSlot = useCallback(
    (slotId: DeliveryShelfSlotId) => {
      if (!isProseSlot(slotId) || !unlockedSlotIds.has(slotId)) return;
      const idx = proseReady.findIndex((p) => p.slotId === slotId);
      if (idx >= 0) setProseIndex(idx);
    },
    [proseReady, setProseIndex, unlockedSlotIds],
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

  const activePageSchema = useMemo(() => {
    if (!active?.page.body) return null;
    return extractPageSchemaFromMarkdown(active.page.body);
  }, [active?.page.body]);

  const tocItems = DELIVERY_SHELF_SLOT_IDS.filter(isProseSlot);

  const structWidgets = useMemo(() => {
    if (!active) {
      return {
        dashboard: null as EnergyDashboardStruct | null,
        gantt: null as ThirtyDayGanttStruct | null,
        roadmap: null as ThreePhaseRoadmapStruct | null,
        scan: null as PageScanCardStruct | null,
        bodyForModules: "",
      };
    }
    const payloads = parsePojuStructPayloads(active.page.body);
    const stripped = deliveryMarkdownWithoutSchemaFence(
      stripPojuStructFences(active.page.body),
    );
    const bodyForModules = stripRenderedStructFallbacks(stripped, payloads, locale);

    const skipScan =
      active.slotId === "cover" ||
      active.slotId === "toc" ||
      active.slotId === "appendix";
    const scanFromStruct = payloads.find((p) => p.kind === "page_scan_card");
    const scan =
      skipScan || !scanFromStruct
        ? null
        : (() => {
            const normalized = normalizePageScanCardStruct(scanFromStruct, locale);
            return normalized ? localizePageScanCardLabels(normalized, locale) : null;
          })();

    // P2 foundation only — never surface the energy dashboard on other shelf pages.
    const fromBody =
      active.slotId === "foundation"
        ? (payloads.find((p) => p.kind === "energy_dashboard") as
            | EnergyDashboardStruct
            | undefined)
        : undefined;
    const dashboard =
      active.slotId !== "foundation"
        ? null
        : fromBody && fromBody.source !== "empty"
          ? fromBody
          : liveDashboard ?? fromBody ?? null;

    return {
      dashboard,
      gantt: (() => {
        const raw = payloads.find((p) => p.kind === "thirty_day_gantt");
        if (!raw || raw.kind !== "thirty_day_gantt") return null;
        const normalized = normalizeThirtyDayGanttStruct(raw, locale);
        return normalized ? localizeThirtyDayGanttLabels(normalized, locale) : null;
      })(),
      roadmap:
        (payloads.find((p) => p.kind === "three_phase_roadmap") as
          | ThreePhaseRoadmapStruct
          | undefined) ?? null,
      scan,
      bodyForModules,
    };
  }, [active, locale, liveDashboard]);

  const modules = useMemo(() => {
    if (!active) return [];
    return buildDeliveryBookModules({
      pageTitle: active.page.title,
      body: structWidgets.bodyForModules,
      dualLayer: active.page.dualLayer !== false,
      pageIndex: viewIndex,
    });
  }, [active, viewIndex, structWidgets.bodyForModules]);

  const evidenceTerms = useMemo(
    () => collectDeliveryEvidenceTerms(fullText, locale),
    [fullText, locale],
  );
  const appendixCopy = useMemo(() => deliveryAppendixCopy(locale), [locale]);
  const showAppendixGlossary =
    active?.slotId === "appendix" && evidenceTerms.length > 0;
  const hideAppendixEmptyBody =
    showAppendixGlossary &&
    modules.every((m) => isDeliveryAppendixEmptyPlaceholder(m.body));

  const evidenceLabel = deliveryEvidenceLabelPlain(locale);
  const loc = locale as Locale;

  return (
    <div
      className="delivery-book-stage"
      data-locale={zh ? "zh" : locale.slice(0, 2)}
      data-bootstrap={bootstrapReady ? "1" : "0"}
      data-awaiting-first={awaitingFirstPage ? "1" : "0"}
    >
      {networkSlot}
      <div className="delivery-book-stage__shell">
        <header
          className="delivery-book-stage__chrome delivery-book-stage__chrome--header"
          aria-label="Eastern OS"
        >
          <div className="delivery-book-stage__chrome-left" aria-hidden />
          <div className="delivery-book-stage__chrome-center">
            <a
              href="/"
              className="delivery-book-stage__header-logo-link"
              aria-label="Eastern OS home"
              onClick={(e) => {
                e.preventDefault();
                window.location.assign("/");
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="delivery-book-stage__header-logo"
                src="/v2/LOGO.png"
                alt=""
                width={72}
                height={16}
                decoding="async"
              />
            </a>
          </div>
          <div className="delivery-book-stage__chrome-right" aria-hidden />
        </header>

      <div className="delivery-book-stage__card" role="region" aria-label={t("shelf_label")}>
          <div className="delivery-book-stage__panes">
            <aside className="delivery-book-stage__left">
              <div className="delivery-book-stage__brand">
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
                <WorkspaceScrollArea
                  className="delivery-book-stage__toc-scroll"
                  fixedThumbPx={48}
                >
                  <ol className="delivery-book-stage__toc-list">
                    {tocItems.map((id, i) => {
                      const unlocked = unlockedSlotIds.has(id);
                      const activeHere = active?.slotId === id;
                      const label = tocLabel(id, locale);
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className={
                              activeHere
                                ? "delivery-book-stage__toc-item delivery-book-stage__toc-item--active"
                                : unlocked
                                  ? "delivery-book-stage__toc-item delivery-book-stage__toc-item--ready"
                                  : "delivery-book-stage__toc-item delivery-book-stage__toc-item--pending"
                            }
                            disabled={!unlocked}
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
                </WorkspaceScrollArea>
              </nav>

              <div className="delivery-book-stage__left-foot">
                <WorkspaceScrollArea
                  className="delivery-book-stage__left-foot-scroll"
                  fixedThumbPx={48}
                >
                  <div className="delivery-book-stage__left-foot-inner">
                    <div className="delivery-book-stage__left-foot-row">
                      <span
                        className="material-symbols-outlined delivery-book-stage__left-foot-icon"
                        aria-hidden
                      >
                        lock
                      </span>
                      <p className="delivery-book-stage__left-foot-copy">
                        <span className="delivery-book-stage__left-foot-label">
                          {t("privacy_label")}
                        </span>
                        <span className="delivery-book-stage__left-foot-body">
                          {keepEasternOsTogether(t("privacy_body"))}
                        </span>
                      </p>
                    </div>
                    <div className="delivery-book-stage__left-foot-row">
                      <span
                        className="material-symbols-outlined delivery-book-stage__left-foot-icon"
                        aria-hidden
                      >
                        balance
                      </span>
                      <p className="delivery-book-stage__left-foot-copy">
                        <span className="delivery-book-stage__left-foot-label">
                          {t("disclaimer_label")}
                        </span>
                        <span className="delivery-book-stage__left-foot-body">
                          {keepEasternOsTogether(t("disclaimer_body"))}
                        </span>
                      </p>
                    </div>
                  </div>
                </WorkspaceScrollArea>
              </div>
            </aside>

            <section className="delivery-book-stage__right">
              {awaitingFirstPage ? (
                <div
                  className="delivery-book-stage__right-wait delivery-book-stage__right-wait--skeleton"
                  role="status"
                  aria-live="polite"
                >
                  <DeliveryPageSlotSkeleton />
                  <div className="delivery-book-stage__wait-copy">
                    <p>{t("long_wait_lead")}</p>
                    <p>{t("long_wait_leave")}</p>
                  </div>
                </div>
              ) : (
              <WorkspaceScrollArea
                className="delivery-book-stage__right-scroll"
                fixedThumbPx={48}
                viewportRef={rightViewportRef}
              >
                {pageTitleDisplay ? (
                  <h1 className="delivery-book-stage__page-title">{pageTitleDisplay}</h1>
                ) : null}
                {activePageSchema && active ? (
                  <div className="delivery-book-stage__page-slots">
                    <DeliveryPageSlots
                      markdown={active.page.body}
                      locale={locale}
                      pageSchema={activePageSchema}
                    />
                  </div>
                ) : null}
                {!activePageSchema && structWidgets.scan ? (
                  <DeliveryPageScanCard data={structWidgets.scan} />
                ) : null}
                {!activePageSchema &&
                structWidgets.dashboard &&
                active?.slotId === "foundation" ? (
                  <article className="delivery-book-stage__module delivery-book-stage__module--widget">
                    <div className="delivery-book-stage__section-card">
                      <DeliveryEnergyDashboard data={structWidgets.dashboard} />
                    </div>
                  </article>
                ) : null}
                {!activePageSchema && structWidgets.roadmap ? (
                  <DeliveryThreePhaseRoadmap data={structWidgets.roadmap} />
                ) : null}
                {!activePageSchema && structWidgets.gantt ? (
                  <DeliveryThirtyDayGantt
                    data={structWidgets.gantt}
                    storageKey={`poju-gantt:${sessionId}:${reportId ?? "draft"}`}
                  />
                ) : null}
                {modules.length > 0 || showAppendixGlossary ? (
                  <div className="delivery-book-stage__modules">
                    {activePageSchema
                      ? modules
                          .filter((m) => m.evidence.trim())
                          .map((mod, mi) => (
                            <article
                              key={`ev-${active?.slotId ?? "p"}-${mi}`}
                              className="delivery-book-stage__module"
                            >
                              <div className="delivery-book-stage__section-card">
                                <EvidenceBlock
                                  label={evidenceLabel}
                                  locale={locale}
                                  defaultOpen={false}
                                  toggleIcon="play"
                                  className="delivery-book-stage__evidence"
                                >
                                  <div className="poju-delivery-v2__evidence-body">
                                    <div className="poju-delivery-v2__prose">
                                      <GlossaryText
                                        text={mod.evidence}
                                        locale={loc}
                                        layer="evidence"
                                        bracketSoft={false}
                                      />
                                    </div>
                                  </div>
                                </EvidenceBlock>
                              </div>
                            </article>
                          ))
                      : !hideAppendixEmptyBody
                      ? modules.map((mod, mi) => {
                          const hideTitle =
                            Boolean(pageTitleDisplay) &&
                            stripPartPrefix(mod.title).trim() === pageTitleDisplay.trim();
                          const isLast =
                            mi === modules.length - 1 && !showAppendixGlossary;
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
                                {mod.strategy?.trim() || mod.methods?.trim() ? (
                                  <div className="delivery-book-stage__rx-parts">
                                    {mod.strategy?.trim() ? (
                                      <div className="delivery-book-stage__rx-part">
                                        <div className="delivery-book-stage__rx-label">
                                          {deliveryRxStrategyLabel(locale)}
                                        </div>
                                        <div className="delivery-book-stage__section-body poju-delivery-v2__body">
                                          <div className="poju-delivery-v2__prose">
                                            <GlossaryText
                                              text={mod.strategy}
                                              locale={loc}
                                              layer="body"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                    {mod.methods?.trim() ? (
                                      <div className="delivery-book-stage__rx-part">
                                        <div className="delivery-book-stage__rx-label">
                                          {deliveryRxMethodsLabel(locale)}
                                        </div>
                                        <div className="delivery-book-stage__section-body poju-delivery-v2__body">
                                          <div className="poju-delivery-v2__prose">
                                            <GlossaryText
                                              text={mod.methods}
                                              locale={loc}
                                              layer="body"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : null}
                                    {mod.body.trim() ? (
                                      <div className="delivery-book-stage__section-body poju-delivery-v2__body">
                                        <div className="poju-delivery-v2__prose">
                                          <GlossaryText text={mod.body} locale={loc} layer="body" />
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : mod.body.trim() ? (
                                  <div className="delivery-book-stage__section-body poju-delivery-v2__body">
                                    <div className="poju-delivery-v2__prose">
                                      <GlossaryText text={mod.body} locale={loc} layer="body" />
                                    </div>
                                  </div>
                                ) : null}
                                {mod.evidence.trim() ? (
                                  <EvidenceBlock
                                    label={evidenceLabel}
                                    locale={locale}
                                    defaultOpen={false}
                                    toggleIcon="play"
                                    className="delivery-book-stage__evidence"
                                  >
                                    <div className="poju-delivery-v2__evidence-body">
                                      <div className="poju-delivery-v2__prose">
                                        <GlossaryText
                                          text={mod.evidence}
                                          locale={loc}
                                          layer="evidence"
                                          bracketSoft={false}
                                        />
                                      </div>
                                    </div>
                                  </EvidenceBlock>
                                ) : null}
                              </div>
                            </article>
                          );
                        })
                      : null}
                    {showAppendixGlossary ? (
                      <article className="delivery-book-stage__module is-last">
                        {!hideAppendixEmptyBody ? (
                          <header className="delivery-book-stage__section-head">
                            <span className="delivery-book-stage__section-dot" aria-hidden />
                            <h2 className="delivery-book-stage__section-title">
                              {appendixCopy.terms}
                            </h2>
                          </header>
                        ) : null}
                        <div className="delivery-book-stage__section-card">
                          <p className="delivery-book-stage__term-lead">
                            {appendixCopy.evidenceGlossaryLead}
                          </p>
                          <table className="delivery-book-stage__term-table">
                            <thead>
                              <tr>
                                <th scope="col">{appendixCopy.termCol}</th>
                                <th scope="col">{appendixCopy.glossCol}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {evidenceTerms.map((term) => (
                                <tr key={term.id}>
                                  <th scope="row" className="delivery-book-stage__term-table-term">
                                    {term.soft}
                                  </th>
                                  <td className="delivery-book-stage__term-table-gloss">
                                    {term.gloss || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    ) : null}
                  </div>
                ) : (
                  <div className="delivery-book-stage__right-empty" aria-hidden />
                )}
              </WorkspaceScrollArea>
              )}
            </section>
          </div>
      </div>

        <footer
          className="delivery-book-stage__chrome delivery-book-stage__chrome--footer"
          role="navigation"
          aria-label={t("shelf_label")}
        >
          <div className="delivery-book-stage__chrome-left">{chromeLeft}</div>
          <div className="delivery-book-stage__chrome-center">
            <DeliveryAudioChrome
              disabled={!complete && !showPager}
              enabled={complete}
              sessionId={sessionId}
              fullText={fullText}
              locale={locale}
            />
          </div>
          <div className="delivery-book-stage__chrome-right">
            {showPager ? (
              <div className="delivery-book-stage__pager">
                <DeliveryChromeIconBtn
                  src={PREV_ICON}
                  label={t("tip_prev")}
                  tip={t("tip_prev")}
                  disabled={viewIndex <= 0}
                  onClick={goPrev}
                />
                <span className="delivery-book-stage__pager-pos">
                  {viewIndex + 1} / {proseReady.length}
                </span>
                <DeliveryChromeIconBtn
                  src={NEXT_ICON}
                  label={t("tip_next")}
                  tip={t("tip_next")}
                  disabled={viewIndex >= proseReady.length - 1}
                  onClick={goNext}
                />
              </div>
            ) : null}

            {!showPager && (showPrevButton || showNextButton || showCornerWait) ? (
              <div className="delivery-book-stage__stream-nav">
                {showPrevButton ? (
                  <DeliveryChromeIconBtn
                    src={PREV_ICON}
                    label={t("tip_prev")}
                    tip={t("tip_prev")}
                    onClick={goPrev}
                  />
                ) : null}
                {showNextButton ? (
                  <DeliveryChromeIconBtn
                    src={NEXT_ICON}
                    label={t("tip_next")}
                    tip={t("tip_next")}
                    onClick={goNext}
                  />
                ) : null}
                {showCornerWait ? (
                  <div className="delivery-book-stage__corner-wait" role="status" aria-live="polite">
                    <span className="delivery-book-stage__spin" aria-hidden />
                    <span>
                      {t("writing_next_page", {
                        n: cornerWaitPageNumber(sequentialGap, proseReady.length),
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </footer>
      </div>

      {interruptedSlot}
    </div>
  );
}
