"use client";

/**
 * Personal baseline profile reader — exact Stage-4 DeliveryBookStage chrome
 * (header / left TOC / right pane / footer pager), packed with 5 baseline pages.
 * Delivery (Pivot P1–P7) stays on DeliveryBookStage + DeliveryShelfView unchanged.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { DeliveryChromeIconBtn } from "@/components/poju/DeliveryChromeIconBtn";
import {
  PojuEnergyMatrix,
  BASELINE_MATRIX_BLOCKS,
  type BaselineMatrixBlockId,
} from "@/components/poju/PojuEnergyMatrix";
import { PojuLogo } from "@/components/ui/poju-logo";
import { WorkspaceScrollArea } from "@/components/workspace/WorkspaceScrollArea";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { normalizeMatrixLocale, tMatrix } from "@/lib/poju/poju-matrix-i18n";

import "@/styles/delivery-book-stage.css";
import "@/styles/poju-celestial-matrix.css";

const PREV_ICON = "/v2/shangicon.svg";
const NEXT_ICON = "/v2/xiaicon.svg";

export type BaselinePortraitBookProps = {
  payload: PojuMatrixPayload;
  locale: string;
  /** Optional left chrome (download / email) — same slot as DeliveryBookStage. */
  chromeLeft?: ReactNode;
  coverTitle?: string;
  suppressNarrative?: boolean;
  className?: string;
};

function keepEasternOsTogether(text: string): string {
  return text.replace(/Eastern OS/g, "Eastern\u00a0OS");
}

export function BaselinePortraitBook({
  payload,
  locale,
  chromeLeft,
  coverTitle,
  suppressNarrative = true,
  className,
}: BaselinePortraitBookProps) {
  const tShelf = useTranslations("workspace.deliveryShelf");
  const tPortrait = useTranslations("portrait");
  const tm = useTranslations("poju_matrix");
  const matrixLocale = normalizeMatrixLocale(locale);
  const zh = matrixLocale === "zh";

  const [pageIndex, setPageIndex] = useState(0);
  const pageCount = BASELINE_MATRIX_BLOCKS.length;
  const activeBlock = BASELINE_MATRIX_BLOCKS[pageIndex]?.id ?? "calibration";

  const setPage = useCallback(
    (next: number) => {
      setPageIndex(Math.max(0, Math.min(pageCount - 1, next)));
    },
    [pageCount],
  );

  const goPrev = useCallback(() => setPage(pageIndex - 1), [pageIndex, setPage]);
  const goNext = useCallback(() => setPage(pageIndex + 1), [pageIndex, setPage]);

  const title = coverTitle?.trim() || tPortrait("title") || tMatrix(locale, "main_title");
  const subtitle = tPortrait("subtitle") || tMatrix(locale, "main_description");

  const bornLine = useMemo(() => {
    const profile = payload.user_profile;
    if (!profile?.birth) return "";
    const b = profile.birth;
    const pad = (n: number) => String(n).padStart(2, "0");
    const time =
      profile.tst_meta?.original_time ??
      profile.birth.tst_meta?.original_time ??
      "";
    const date = `${b.year} - ${pad(b.month)} - ${pad(b.day)}`;
    return time ? `${date} - ${time}` : date;
  }, [payload.user_profile]);

  const placeLine = useMemo(() => {
    const profile = payload.user_profile;
    if (!profile) return "";
    const loc = profile.birth?.birth_location;
    const tstLon =
      profile.tst_meta?.longitude ?? profile.birth?.tst_meta?.longitude;
    const lon = loc?.longitude ?? tstLon;
    if (loc?.name && lon != null && !loc.use_defaults) {
      const dir = lon >= 0 ? "E" : "W";
      return `${loc.name} ${Math.abs(lon).toFixed(2)}°${dir}`;
    }
    return loc?.name || profile.birth?.timezone || "";
  }, [payload.user_profile]);

  const activeLabel = tm(`blocks.${BASELINE_MATRIX_BLOCKS[pageIndex]?.labelKey ?? "block_1"}`);

  return (
    <div
      className={`delivery-book-stage${className ? ` ${className}` : ""}`}
      data-locale={zh ? "zh" : locale.slice(0, 2)}
      data-baseline="1"
      data-bootstrap="1"
      data-awaiting-first="0"
    >
      <div className="delivery-book-stage__shell">
        <header
          className="delivery-book-stage__chrome delivery-book-stage__chrome--header"
          aria-label="Eastern OS"
        >
          <div className="delivery-book-stage__chrome-left" aria-hidden />
          <div className="delivery-book-stage__chrome-center">
            <PojuLogo
              className="delivery-book-stage__header-logo-link"
              size="sidebar"
              hardNavigate
            />
          </div>
          <div className="delivery-book-stage__chrome-right" aria-hidden />
        </header>

        <div
          className="delivery-book-stage__card"
          role="region"
          aria-label={title}
        >
          <div className="delivery-book-stage__panes">
            <aside className="delivery-book-stage__left">
              <div className="delivery-book-stage__brand">
                <h1 className="delivery-book-stage__product-title">
                  <span>{title}</span>
                  <span className="delivery-book-stage__product-title-line3">
                    {subtitle}
                  </span>
                </h1>
              </div>

              <div className="delivery-book-stage__meta-card">
                {bornLine ? (
                  <p className="delivery-book-stage__meta-question" title={bornLine}>
                    {tMatrix(locale, "born")} {bornLine}
                  </p>
                ) : null}
                <div className="delivery-book-stage__meta-row delivery-book-stage__meta-row--pair">
                  {placeLine ? (
                    <span className="delivery-book-stage__meta-cell">
                      <span className="material-symbols-outlined" aria-hidden>
                        location_on
                      </span>
                      <span className="delivery-book-stage__meta-text">{placeLine}</span>
                    </span>
                  ) : null}
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

              <nav
                className="delivery-book-stage__toc"
                aria-label={tShelf("toc_nav_label")}
              >
                <div className="delivery-book-stage__toc-head">
                  <span className="delivery-book-stage__toc-head-rule" aria-hidden />
                  {tShelf("toc_thumb")}
                </div>
                <WorkspaceScrollArea
                  className="delivery-book-stage__toc-scroll"
                  fixedThumbPx={48}
                >
                  <ol className="delivery-book-stage__toc-list">
                    {BASELINE_MATRIX_BLOCKS.map((block, i) => {
                      const activeHere = block.id === activeBlock;
                      const label = tm(`blocks.${block.labelKey}`);
                      return (
                        <li key={block.id}>
                          <button
                            type="button"
                            className={
                              activeHere
                                ? "delivery-book-stage__toc-item delivery-book-stage__toc-item--active"
                                : "delivery-book-stage__toc-item delivery-book-stage__toc-item--ready"
                            }
                            onClick={() => setPage(i)}
                            aria-label={label}
                            aria-current={activeHere ? "page" : undefined}
                          >
                            <span className="delivery-book-stage__toc-num">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="delivery-book-stage__toc-text">
                              <span className="delivery-book-stage__toc-tag">
                                B{i + 1}
                              </span>
                              <span className="delivery-book-stage__toc-title">
                                {label}
                              </span>
                            </span>
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
                          {tShelf("privacy_label")}
                        </span>
                        <span className="delivery-book-stage__left-foot-body">
                          {keepEasternOsTogether(tShelf("privacy_body"))}
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
                          {tShelf("disclaimer_label")}
                        </span>
                        <span className="delivery-book-stage__left-foot-body">
                          {keepEasternOsTogether(tShelf("disclaimer_body"))}
                        </span>
                      </p>
                    </div>
                  </div>
                </WorkspaceScrollArea>
              </div>
            </aside>

            <section className="delivery-book-stage__right">
              <WorkspaceScrollArea
                className="delivery-book-stage__right-scroll"
                fixedThumbPx={48}
              >
                <header className="delivery-book-stage__page-chrome">
                  <p className="delivery-book-stage__page-tag">
                    【B{pageIndex + 1}】
                  </p>
                  <h1 className="delivery-book-stage__page-title">{activeLabel}</h1>
                  <p className="delivery-book-stage__page-subtitle">{subtitle}</p>
                </header>
                <div className="delivery-book-stage__page-slots baseline-portrait-book__page">
                  <PojuEnergyMatrix
                    payload={payload}
                    locale={locale}
                    suppressNarrative={suppressNarrative}
                    bodyOnly
                    activeBlockId={activeBlock as BaselineMatrixBlockId}
                    coverTitle={coverTitle}
                    expanded
                  />
                </div>
              </WorkspaceScrollArea>
            </section>
          </div>
        </div>

        <footer
          className="delivery-book-stage__chrome delivery-book-stage__chrome--footer"
          role="navigation"
          aria-label={tShelf("shelf_label")}
        >
          <div className="delivery-book-stage__chrome-left">{chromeLeft}</div>
          <div className="delivery-book-stage__chrome-center" />
          <div className="delivery-book-stage__chrome-right">
            <div className="delivery-book-stage__pager">
              <DeliveryChromeIconBtn
                src={PREV_ICON}
                label={tShelf("tip_prev")}
                tip={tShelf("tip_prev")}
                disabled={pageIndex <= 0}
                onClick={goPrev}
              />
              <span className="delivery-book-stage__pager-pos">
                {pageIndex + 1} / {pageCount}
              </span>
              <DeliveryChromeIconBtn
                src={NEXT_ICON}
                label={tShelf("tip_next")}
                tip={tShelf("tip_next")}
                disabled={pageIndex >= pageCount - 1}
                onClick={goNext}
              />
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
