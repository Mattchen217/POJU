"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PojuDaYunTimeline } from "@/components/poju/PojuDaYunTimeline";
import {
  elementCssClass,
  formatBranchDisplay,
  getBranchInfo,
  isZhMatrixLocale,
  yongshenChipsForLocale,
  zodiacAnimalHanFromBranch,
} from "@/lib/poju/bazi-matrix-mappings";
import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { activePillarByAge } from "@/lib/poju/matrix-life-segment";
import { matrixSynopsisNarrativeState } from "@/lib/poju/matrix-narrative-text";
import { computeYearTransitProgress } from "@/lib/poju/matrix-transit-progress";
import { SoftTermHover } from "@/components/cross-product/GlossaryText";
import { MatrixSoftChip } from "@/lib/poju/matrix-soft-chip";
import {
  elementToSlug,
  matrixElementSoft,
  matrixSoftTerm,
  matrixTermSlug,
  pillarSlotSlug,
  strengthToSlug,
  zodiacHanToSlug,
} from "@/lib/poju/matrix-term-labels";
import { resolveBaziLabel } from "@/lib/poju/resolve-bazi-i18n";
import { normalizeShenshaLocale, resolveShenshaList } from "@/lib/poju/shensha";
import { tMatrix } from "@/lib/poju/poju-matrix-i18n";
import { formatBirthClockTime } from "@/lib/profile/birth-info-utils";
import { ZODIAC_ICON_BY_HAN } from "@/lib/poju/zodiac-icon-assets";
import type { UserProfile } from "@/lib/profile/types";
import "@/styles/poju-energy-matrix.css";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
  compact?: boolean;
  /** Chat: synopsis lives in MatrixNarrativeReply — hide enote / loading placeholders here. */
  suppressNarrative?: boolean;
  /** Match preview: e.g. 用户A： before born / coordinates / matrix id. */
  subjectPrefix?: string;
};

const ELEMENT_CLASS: Record<string, string> = {
  Wood: "el-w",
  Fire: "el-f",
  Earth: "el-e",
  Metal: "el-m",
  Water: "el-water",
};

const ELEMENT_BAR_CLASS: Record<string, string> = {
  Wood: "ebar-fill--wood",
  Fire: "ebar-fill--fire",
  Earth: "ebar-fill--earth",
  Metal: "ebar-fill--metal",
  Water: "ebar-fill--water",
};

const MAJOR_SHENSHA = new Set(["天乙贵人", "禄神", "prime_mentor_node", "provision_anchor"]);

function formatLayerStageLine(
  pl: {
    branch: string;
    branch_en: string;
    life_stage_label: string | null;
  },
  locale: string,
): string {
  // Zodiac animal + soft element (+ soft life-stage). Lookup uses branch char; output never shows 干支.
  const stage = pl.life_stage_label?.trim() || null;
  return formatBranchDisplay(pl.branch, locale, stage);
}

function NarrativePlaceholder({ label }: { label: string }) {
  return <span className="pem__narrative-loading">{label}</span>;
}

function formatBornLine(profile: UserProfile): string {
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ??
    profile.birth.tst_meta?.original_time ??
    formatBirthClockTime(b);
  const date = `${b.year} · ${pad(b.month)} · ${pad(b.day)}`;
  return time ? `${date} — ${time}` : date;
}

function formatCoordinates(profile: UserProfile, locale: string): string {
  const loc = profile.birth.birth_location;
  const tstLon = profile.tst_meta?.longitude ?? profile.birth.tst_meta?.longitude;
  const lon = loc?.longitude ?? tstLon;
  if (loc?.name && lon != null && !loc.use_defaults) {
    const dir = lon >= 0 ? "E" : "W";
    return `${loc.name} ${Math.abs(lon).toFixed(2)}°${dir}`;
  }
  if (loc?.name && !loc.use_defaults) return loc.name;
  return profile.birth.timezone || tMatrix(locale, "card.default_timezone");
}

function strengthLabel(
  strength: PojuMatrixPayload["strength"],
  tc: (key: string) => string,
): string {
  if (strength === "strong") return tc("strength_strong");
  if (strength === "weak") return tc("strength_weak");
  return tc("strength_balanced");
}

function vitalityPin(strength: PojuMatrixPayload["strength"]): string {
  if (strength === "strong") return "72%";
  if (strength === "weak") return "32%";
  return "50%";
}

function RadarChart({
  scores,
  locale,
}: {
  scores: PojuMatrixPayload["wuxing_scores"];
  locale: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let chart: { resize: () => void; dispose: () => void; setOption: (o: unknown) => void } | null = null;
    let cancelled = false;

    void (async () => {
      const echarts = await import("echarts");
      if (cancelled || !ref.current) return;
      chart = echarts.init(ref.current, null, { renderer: "canvas" });
      const max = Math.max(...scores.map((s) => s.count), 4);
      chart.setOption({
        backgroundColor: "transparent",
        radar: {
          center: ["50%", "52%"],
          radius: "86%",
          startAngle: 90,
          splitNumber: 4,
          axisName: {
            color: "rgba(255,255,255,0.78)",
            fontSize: 11,
            fontWeight: 500,
            fontFamily: "Inter, system-ui, sans-serif",
            padding: [0, 4],
          },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.13)" } },
          splitArea: { areaStyle: { color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"] } },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
          indicator: scores.map((s) => ({
            name: matrixElementSoft(s.element, locale),
            max: max * 1.1,
          })),
        },
        series: [
          {
            type: "radar",
            symbol: "circle",
            symbolSize: 6,
            data: [
              {
                value: scores.map((s) => s.count),
                lineStyle: { color: "#f2c994", width: 2.4 },
                itemStyle: { color: "#f2c994" },
                areaStyle: { color: "rgba(242,201,148,0.30)" },
              },
            ],
          },
        ],
      });
    })();

    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      chart?.dispose();
    };
  }, [scores, locale]);

  return <div className="radar radar--compact" ref={ref} aria-hidden />;
}

export function PojuEnergyMatrix({ payload, locale, compact = false, suppressNarrative = false, subjectPrefix }: Props) {
  const { structured, user_profile, wuxing_scores, strength, matrix_id } = payload;
  const shenshaLocale = normalizeShenshaLocale(locale);
  const isZh = isZhMatrixLocale(locale);
  const tb = useTranslations("bazi");
  const tm = useTranslations("poju_matrix");
  const tc = useTranslations("poju_matrix.card");

  const display = useMemo(() => {
    const base = buildMatrixDisplayData({
      profile: user_profile,
      structured,
      strength,
      wuxing_scores,
      locale,
    });
    const cached = payload.display;
    if (!cached) return base;
    // Lifecycle right column always uses local fact_panel (no LLM prose overlay).
    if (cached.narrative_source === "llm") {
      return {
        ...base,
        synopsis: cached.synopsis,
        enote_caption: cached.enote_caption,
        narrative_source: cached.narrative_source,
        narrative_locale: cached.narrative_locale,
        narrative_failed: cached.narrative_failed,
        fact_panel: base.fact_panel,
      };
    }
    if (cached.narrative_failed) {
      return {
        ...base,
        synopsis: cached.synopsis,
        enote_caption: cached.enote_caption,
        narrative_source: cached.narrative_source ?? "template",
        narrative_locale: cached.narrative_locale,
        narrative_failed: true,
        fact_panel: base.fact_panel,
      };
    }
    return { ...base, fact_panel: base.fact_panel };
  }, [payload.display, user_profile, structured, strength, wuxing_scores, locale]);

  const zodiacIcon = ZODIAC_ICON_BY_HAN[display.zodiac.han];

  const maxCount = Math.max(...wuxing_scores.map((s) => s.count), 1);
  const sorted = [...wuxing_scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0];
  const deficit = sorted[sorted.length - 1];
  const tst = user_profile.tst_meta ?? user_profile.birth.tst_meta;

  const genderLabel = structured.bazi_enrichment?.gender_label
    ? resolveBaziLabel(structured.bazi_enrichment.gender_label, tb)
    : user_profile.birth.gender === "M"
      ? tb("gender.qian")
      : tb("gender.kun");

  const { isLlmNarrative, showTemplateFallback, narrativeLoading } =
    matrixSynopsisNarrativeState(display);

  const [transitProgress, setTransitProgress] = useState(() => computeYearTransitProgress());
  useEffect(() => {
    setTransitProgress(computeYearTransitProgress());
    const id = window.setInterval(() => setTransitProgress(computeYearTransitProgress()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const lifeSegmentPillar = activePillarByAge(display.current_age);
  const yongshenChips = useMemo(
    () => yongshenChipsForLocale(structured.bazi_enrichment?.yongshen_analysis, locale),
    [structured.bazi_enrichment?.yongshen_analysis, locale],
  );

  return (
    <div className={`pem${compact ? " pem--compact" : ""}`}>
      <header className="rhead">
        <div className="eyebrow">{tm("eyebrow")}</div>
        <h2>{tm("main_title")}</h2>
        <p className="tag">{tm("main_description")}</p>
        <div className="subject">
          {subjectPrefix ? (
            <span className="pem__subject-prefix">
              <b>{subjectPrefix}</b>
            </span>
          ) : null}
          <span>
            {tm("born")} <b>{formatBornLine(user_profile)}</b>
          </span>
          <span>
            {tm("coordinates")} <b>{formatCoordinates(user_profile, locale)}</b>
          </span>
          <span>
            {tm("matrix_id")} <b>{matrix_id}</b>
          </span>
        </div>
      </header>

      <section className="device pem-matrix-body">
        <div className="topband">
          <div className="tcard zsign">
            <div className="zsign__art">
              {zodiacIcon ? (
                <Image
                  src={zodiacIcon}
                  alt=""
                  width={56}
                  height={56}
                  className="zsign__icon"
                />
              ) : (
                <span>{display.zodiac.han}</span>
              )}
            </div>
            <div className="zsign__en">
              {(() => {
                const zdSlug = zodiacHanToSlug(display.zodiac.han);
                return zdSlug ? (
                  <SoftTermHover
                    slug={zdSlug}
                    locale={locale}
                    fallback={display.zodiac.en}
                  />
                ) : (
                  display.zodiac.en
                );
              })()}
            </div>
            <div className="zsign__cn">
              {(() => {
                const zdSlug = zodiacHanToSlug(display.zodiac.han);
                return zdSlug ? (
                  <>
                    <SoftTermHover
                      slug={zdSlug}
                      locale={locale.startsWith("zh") ? locale : "zh"}
                      fallback={display.zodiac.han}
                    />
                    {" · "}
                    {display.zodiac.pinyin}
                  </>
                ) : (
                  <>
                    {display.zodiac.han} · {display.zodiac.pinyin}
                  </>
                );
              })()}
            </div>
            <div className="zsign__tag">{tc("your_sign_tag")}</div>
            <div className="zsign__note">{display.zodiac.note}</div>
          </div>

          <div className="topband__calibration">
            <div className="topband__calibration-head">
              <p className="topband__calibration-title">{tm("section_label")}</p>
            </div>
            <div className="topband__calibration-grid topband__calibration-grid--hero">
          <div className="tcard a tcard--nested tcard--hero-cal">
            <div className="k">
              <span className="bull" />
              {tc("calendar_alignment")} <em>· {tc("calendar_alignment_em")}</em>
            </div>
            <div className="v">
              {display.calendar.gregorian} <small>{tc("gregorian")}</small>
            </div>
            {display.calendar.lunar ? (
              <div className="v v--lunar">
                {display.calendar.lunar} <small>{tc("lunar")}</small>
              </div>
            ) : null}
            <div className="mid">
              {display.calendar.headline}
              {genderLabel ? <span className="pem__gender-tag">{genderLabel}</span> : null}
            </div>
            <div className="s">{display.calendar.mid}</div>
          </div>

          <div className="tcard a tcard--nested tcard--hero-tst">
            <div className="k">
              <span className="bull" />
              {tc("true_solar_time")} <em>· {tc("true_solar_time_em")}</em>
            </div>
            {tst ? (
              <>
                <div className="tst">
                  <div className="tst__times">
                    <div className="t">
                      <div className="vv">{tst.original_time}</div>
                      <div className="kk">{tc("standard_time")}</div>
                    </div>
                    <div className="arr">→</div>
                    <div className="t">
                      <div className="vv gold">{tst.true_solar_time}</div>
                      <div className="kk">{tc("true_solar")}</div>
                    </div>
                  </div>
                  {tst.diff_minutes !== 0 ? (
                    <div className="tst__chip">
                      {tst.diff_minutes > 0 ? "+" : "−"}
                      {Math.abs(Number(tst.diff_minutes.toFixed(2)))}m
                    </div>
                  ) : null}
                </div>
                <div className="s">
                  {tc("longitude_correction")} ·{" "}
                  {tst.longitude_diff_minutes ?? tst.diff_minutes}m
                  {tst.eq_of_time_minutes != null
                    ? ` · ${tc("eq_of_time")} ${tst.eq_of_time_minutes > 0 ? "+" : ""}${tst.eq_of_time_minutes}m`
                    : null}
                  {tst.longitude != null
                    ? ` · ${Math.abs(tst.longitude).toFixed(2)}°${tst.longitude >= 0 ? "E" : "W"}`
                    : null}
                </div>
              </>
            ) : (
              <div className="v">—</div>
            )}
          </div>

          <div className="tcard a tcard--nested tcard--hero-jieqi">
            <div className="k">
              <span className="bull" />
              {tc("solar_term")} <em>· {tc("solar_term_em")}</em>
            </div>
            <div className="v">
              {display.solar_term.name_en} <small>{display.solar_term.name}</small>
            </div>
            <div className="mid">{display.solar_term.season}</div>
            <div className="s">
              {tc("next_term")}: {display.solar_term.next_name}
            </div>
            <div className="term">
              <i style={{ width: `${display.solar_term.progress_pct}%` }} />
            </div>
          </div>
            </div>
          </div>
        </div>

        <div className="pem-row pem-row--duo">
          <div className="pem-panel pem-panel--radar">
            <div className="pem-panel__label">
              {tc("radar_matrix")} <em>· {tc("radar_matrix_em")}</em>
            </div>
            <div className="pem-panel__body pem-panel__body--radar">
              <RadarChart scores={wuxing_scores} locale={locale} />
            </div>
          </div>
          <div className="pem-panel pem-panel--bars ro ro--wuxing">
            <div className="ro__k">
              {tc("elemental_signature")} <em>· {tc("elemental_signature_em")}</em>
            </div>
            <div className="elist">
              {wuxing_scores.map((row) => {
                const soft = matrixElementSoft(row.element, locale);
                const elSlug = elementToSlug(row.element);
                return (
                  <div className="erow" key={row.element}>
                    <div className="erow__head">
                      <span className="erow__names">
                        <span className={`ename ${ELEMENT_CLASS[row.element] ?? ""}`}>
                          {elSlug ? (
                            <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                          ) : (
                            soft
                          )}
                        </span>
                      </span>
                      <span className="ecount">{row.count}</span>
                    </div>
                    <span className="ebar">
                      <i
                        style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                        className={ELEMENT_BAR_CLASS[row.element] ?? ""}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
            {yongshenChips.length > 0 ? (
              <div className="pem__yongshen-row">
                <span className="pem__yongshen-label">{tb("optimizing_vector")}</span>
                <span className="pem__yongshen-chips">
                  {yongshenChips.map((chip) => {
                    const elSlug = elementToSlug(chip.elementKey);
                    return (
                      <span
                        key={chip.label}
                        className={`pem__yongshen-chip ${elementCssClass(chip.elementKey)}`}
                      >
                        {elSlug ? (
                          <SoftTermHover
                            slug={elSlug}
                            locale={locale}
                            fallback={chip.label}
                          />
                        ) : (
                          chip.label
                        )}
                      </span>
                    );
                  })}
                </span>
              </div>
            ) : null}
            <div className="enote">
              {!suppressNarrative && narrativeLoading ? (
                <NarrativePlaceholder label={tc("narrative_loading")} />
              ) : !suppressNarrative && isLlmNarrative && display.enote_caption ? (
                display.enote_caption
              ) : !suppressNarrative && showTemplateFallback ? (
                <>
                  <SoftTermHover slug="day_master" locale={locale} fallback={tc("day_master")} />{" "}
                  <b>
                    {(() => {
                      const elSlug = elementToSlug(display.day_master.element);
                      const soft = matrixElementSoft(display.day_master.element, locale);
                      return elSlug ? (
                        <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                      ) : (
                        soft
                      );
                    })()}
                  </b>
                  {tc("with_surplus")}
                  <b>
                    {dominant
                      ? (() => {
                          const elSlug = elementToSlug(dominant.element);
                          const soft = matrixElementSoft(dominant.element, locale);
                          return elSlug ? (
                            <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                          ) : (
                            soft
                          );
                        })()
                      : ""}
                  </b>
                  {tc("surplus_and")}
                  <b>
                    {deficit
                      ? (() => {
                          const elSlug = elementToSlug(deficit.element);
                          const soft = matrixElementSoft(deficit.element, locale);
                          return elSlug ? (
                            <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                          ) : (
                            soft
                          );
                        })()
                      : ""}
                  </b>
                  {tc("deficit_period")}
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pem-row pem-row--duo">
          <div className="pem-panel ro ro--wuxing">
            <div className="ro__k">{tc("core_vitality")}</div>
            <div className="ro__v ro__v--metric">
              <SoftTermHover
                slug={strengthToSlug(strength)}
                locale={locale}
                fallback={strengthLabel(strength, tc)}
              />
            </div>
            <div className="vtrack">
              <div className="mid" />
              <div className="pin" style={{ left: vitalityPin(strength) }} />
            </div>
            <div className="vscale">
              <span>{tc("vitality_receptive")}</span>
              <span>{tc("vitality_balance")}</span>
              <span>{tc("vitality_dominant")}</span>
            </div>
          </div>
          <div className="pem-panel ro ro--wuxing pem-panel--equilibrium">
            <div className="ro__k">{tc("elemental_equilibrium")}</div>
            <div className="pem-equilibrium-grid">
              {dominant ? (
                <div className="pem-equilibrium-item">
                  <div className="ro__v ro__v--metric">
                    <span className={`ro__v-accent ${ELEMENT_CLASS[dominant.element] ?? ""}`}>
                      {(() => {
                        const elSlug = elementToSlug(dominant.element);
                        const soft = matrixElementSoft(dominant.element, locale);
                        return elSlug ? (
                          <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                        ) : (
                          soft
                        );
                      })()}
                    </span>
                    <span className="pct">
                      {tc("surplus")} · {dominant.pct}%
                    </span>
                  </div>
                  <div className="ebar pem-equilibrium-bar">
                    <i style={{ width: `${dominant.pct}%` }} className={ELEMENT_BAR_CLASS[dominant.element] ?? ""} />
                  </div>
                  <div className="ro__tag up">
                    ▲ {tc("dominant_vector")} ·{" "}
                    {(() => {
                      const elSlug = elementToSlug(dominant.element);
                      const soft = matrixElementSoft(dominant.element, locale);
                      return elSlug ? (
                        <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                      ) : (
                        soft
                      );
                    })()}
                  </div>
                </div>
              ) : null}
              {deficit ? (
                <div className="pem-equilibrium-item">
                  <div className="ro__v ro__v--metric">
                    <span className={`ro__v-accent ${ELEMENT_CLASS[deficit.element] ?? ""}`}>
                      {(() => {
                        const elSlug = elementToSlug(deficit.element);
                        const soft = matrixElementSoft(deficit.element, locale);
                        return elSlug ? (
                          <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                        ) : (
                          soft
                        );
                      })()}
                    </span>
                    <span className="pct">
                      {tc("deficit")} · {deficit.pct}%
                    </span>
                  </div>
                  <div className="ebar pem-equilibrium-bar">
                    <i style={{ width: `${Math.max(deficit.pct, 5)}%` }} className={ELEMENT_BAR_CLASS[deficit.element] ?? ""} />
                  </div>
                  <div className="ro__tag down">
                    ▼ {tc("key_gap")} ·{" "}
                    {(() => {
                      const elSlug = elementToSlug(deficit.element);
                      const soft = matrixElementSoft(deficit.element, locale);
                      return elSlug ? (
                        <SoftTermHover slug={elSlug} locale={locale} fallback={soft} />
                      ) : (
                        soft
                      );
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="pem-row pem-row--lifecycle block block--fill">
          <div className="dialpanel dialpanel--timeline">
            <div className="rp__k">
              {tc("macro_lifecycle")} <em>· {tc("macro_lifecycle_em")}</em>
            </div>
            <PojuDaYunTimeline
              daYun={structured.da_yun}
              currentIndex={display.current_dayun_index}
              currentAge={display.current_age}
              locale={locale}
            />
          </div>
          <div className="side side--facts">
            {(() => {
              const fp = display.fact_panel;
              const emptyLinks = tc("fact_empty_links");
              return (
                <>
                  <div className="ro ro--fact">
                    <div className="ro__k">
                      {tc("fact_era")} <em>· {tc("fact_era_em")}</em>
                    </div>
                    <div className="ro__v ro__v--metric">
                      <span className="fact-theme">{fp.era.theme}</span>
                      <span className="pct">
                        {fp.era.age_range}
                        {fp.era.start_year
                          ? ` · ${fp.era.start_year}`
                          : ""}
                      </span>
                    </div>
                    <div className="fact-chips">
                      {fp.era.stem_element_soft ? (
                        <MatrixSoftChip
                          soft={fp.era.stem_element_soft}
                          slug={fp.era.stem_element_slug}
                          locale={locale}
                          tone="gold"
                        />
                      ) : null}
                      {fp.era.ten_god_soft ? (
                        <MatrixSoftChip
                          soft={fp.era.ten_god_soft}
                          slug={fp.era.ten_god_slug}
                          locale={locale}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="ro ro--fact">
                    <div className="ro__k">
                      {tc("fact_year_pulse")} · {fp.year_pulse.year}
                    </div>
                    <div className="ro__v ro__v--metric">
                      <span
                        className={elementCssClass(
                          display.annual_transit.stem_en.split(" ").pop() ||
                            display.annual_transit.stem_en,
                        )}
                      >
                        {fp.year_pulse.stem_element_slug ? (
                          <SoftTermHover
                            slug={fp.year_pulse.stem_element_slug}
                            locale={locale}
                            fallback={fp.year_pulse.stem_element_soft}
                          />
                        ) : (
                          fp.year_pulse.stem_element_soft
                        )}
                      </span>
                      <span className="pct">{tc("fact_year_pulse_em")}</span>
                    </div>
                    <div className="fact-chips">
                      {fp.year_pulse.links.length > 0 ? (
                        fp.year_pulse.links.map((c) => (
                          <MatrixSoftChip
                            key={c.soft}
                            soft={c.soft}
                            slug={c.slug}
                            locale={locale}
                            tone={c.polarity}
                          />
                        ))
                      ) : (
                        <span className="fact-chip fact-chip--muted">{emptyLinks}</span>
                      )}
                    </div>
                    <div className="tprog">
                      <div className="tprog__bar">
                        <i style={{ width: `${transitProgress}%` }} />
                      </div>
                      <div className="tprog__lab">
                        <span>
                          {fp.year_pulse.year} {tc("transit_progress")}
                        </span>
                        <span className="blink">{transitProgress}% ▮</span>
                      </div>
                    </div>
                  </div>

                  <div className="ro ro--fact">
                    <div className="ro__k">
                      {tc("fact_structure")} <em>· {tc("fact_structure_em")}</em>
                    </div>
                    <div className="fact-row">
                      <span className="fact-row__lab res">{tc("fact_bonds")}</span>
                      <div className="fact-chips">
                        {fp.structure.bonds.length > 0 ? (
                          fp.structure.bonds.map((c) => (
                            <MatrixSoftChip
                              key={`b-${c.soft}`}
                              soft={c.soft}
                              slug={c.slug}
                              locale={locale}
                              tone="green"
                            />
                          ))
                        ) : (
                          <span className="fact-chip fact-chip--muted">{emptyLinks}</span>
                        )}
                      </div>
                    </div>
                    <div className="fact-row">
                      <span className="fact-row__lab ten">{tc("fact_tensions")}</span>
                      <div className="fact-chips">
                        {fp.structure.tensions.length > 0 ? (
                          fp.structure.tensions.map((c) => (
                            <MatrixSoftChip
                              key={`t-${c.soft}`}
                              soft={c.soft}
                              slug={c.slug}
                              locale={locale}
                              tone="red"
                            />
                          ))
                        ) : (
                          <span className="fact-chip fact-chip--muted">{emptyLinks}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="ro ro--fact">
                    <div className="ro__k">
                      {tc("fact_balance")} <em>· {tc("fact_balance_em")}</em>
                    </div>
                    <div className="ro__v ro__v--metric">
                      <SoftTermHover
                        slug={fp.balance.strength_slug}
                        locale={locale}
                        fallback={fp.balance.strength_soft}
                      />
                      {fp.balance.yong_soft ? (
                        <span className="pct">
                          {tc("fact_anchor")} ·{" "}
                          {fp.balance.yong_slug ? (
                            <SoftTermHover
                              slug={fp.balance.yong_slug}
                              locale={locale}
                              fallback={fp.balance.yong_soft}
                            />
                          ) : (
                            fp.balance.yong_soft
                          )}
                        </span>
                      ) : null}
                    </div>
                    <div className="fact-chips">
                      {fp.balance.xi.map((c) => (
                        <MatrixSoftChip
                          key={`xi-${c.soft}`}
                          soft={c.soft}
                          slug={c.slug}
                          locale={locale}
                          tone="green"
                        />
                      ))}
                      {fp.balance.ji.map((c) => (
                        <MatrixSoftChip
                          key={`ji-${c.soft}`}
                          soft={c.soft}
                          slug={c.slug}
                          locale={locale}
                          tone="red"
                        />
                      ))}
                      {fp.balance.xi.length === 0 &&
                      fp.balance.ji.length === 0 &&
                      !fp.balance.yong_soft ? (
                        <span className="fact-chip fact-chip--muted">{emptyLinks}</span>
                      ) : null}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        <div className="pillars pillars--layers">
          <div className="pillars__head">
            {tc("layers_title")} <em>· {tc("layers_em")}</em>
          </div>
          {display.pillars.map((pl, idx) => {
            const keys = ["year", "month", "day", "hour"] as const;
            const key = keys[idx] ?? "year";
            const isDay = key === "day";
            const isLifeSegment = lifeSegmentPillar === key;
            const roleSoft = isZh ? pl.ten_god : pl.ten_god_en;
            const roleSlug =
              isDay &&
              (!pl.ten_god_han || pl.ten_god_han === "日主" || pl.ten_god === "日主")
                ? "day_master"
                : matrixTermSlug(pl.ten_god_han) ??
                  matrixTermSlug(pl.ten_god) ??
                  matrixTermSlug(pl.ten_god_en);
            const stemSlug = pl.stem_element ? elementToSlug(pl.stem_element) : null;
            const stageHan = pl.life_stage_han?.trim() || null;
            const stageSlug = stageHan ? matrixTermSlug(stageHan) : null;
            const branchInfo = getBranchInfo(pl.branch);
            const zdHan = zodiacAnimalHanFromBranch(pl.branch);
            const zdSlug = zodiacHanToSlug(zdHan);
            const branchElSlug = branchInfo
              ? elementToSlug(branchInfo.element)
              : null;
            return (
              <div
                key={key}
                className={`pl pl--layer${isDay ? " day" : ""}${isLifeSegment ? " pl--segment-active" : ""}`}
              >
                <div className="cap">
                  <SoftTermHover slug={pillarSlotSlug(key)} locale={locale} />
                </div>
                <div className="role" style={isDay ? { color: "var(--gold-soft)" } : undefined}>
                  {roleSlug ? (
                    <SoftTermHover slug={roleSlug} locale={locale} fallback={roleSoft} />
                  ) : (
                    roleSoft
                  )}
                </div>
                <div className="stem">
                  <div className={`en ${elementCssClass(pl.stem_element)}`}>
                    {pl.stem_element ? (
                      stemSlug ? (
                        <SoftTermHover
                          slug={stemSlug}
                          locale={locale}
                          fallback={matrixElementSoft(pl.stem_element, locale)}
                        />
                      ) : (
                        matrixElementSoft(pl.stem_element, locale)
                      )
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <div className="branch">
                  <div className="en">
                    {branchInfo ? (
                      <>
                        {zdSlug ? (
                          <SoftTermHover
                            slug={zdSlug}
                            locale={locale}
                            fallback={isZh ? zdHan : branchInfo.zodiac_en}
                          />
                        ) : isZh ? (
                          zdHan
                        ) : (
                          branchInfo.zodiac_en
                        )}
                        {" · "}
                        {branchElSlug ? (
                          <SoftTermHover
                            slug={branchElSlug}
                            locale={locale}
                            fallback={matrixElementSoft(branchInfo.element, locale)}
                          />
                        ) : (
                          matrixElementSoft(branchInfo.element, locale)
                        )}
                        {stageHan ? (
                          <>
                            {" · "}
                            {stageSlug ? (
                              <SoftTermHover
                                slug={stageSlug}
                                locale={locale}
                                fallback={
                                  pl.life_stage_label ||
                                  matrixSoftTerm(stageHan, locale)
                                }
                              />
                            ) : (
                              pl.life_stage_label || matrixSoftTerm(stageHan, locale)
                            )}
                          </>
                        ) : null}
                      </>
                    ) : (
                      formatLayerStageLine(pl, locale)
                    )}
                  </div>
                </div>
                <div className="meta">
                  {pl.hidden_display}
                  {pl.star_labels.length > 0 ? (
                    <>
                      <br />
                      {resolveShenshaList(pl.star_labels, shenshaLocale).map((star) => (
                        <span
                          key={star.id}
                          className={`star star--${star.polarity}${MAJOR_SHENSHA.has(star.id) || MAJOR_SHENSHA.has(star.zh_src) ? " star--major" : ""}`}
                        >
                          ✦{" "}
                          <SoftTermHover
                            slug={star.id}
                            locale={locale}
                            fallback={star.label}
                          />
                        </span>
                      ))}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
