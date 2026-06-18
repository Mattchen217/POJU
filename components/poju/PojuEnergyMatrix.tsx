"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { PojuDaYunDial } from "@/components/poju/PojuDaYunDial";
import {
  elementCssClass,
  formatBranchDisplay,
  formatStemDisplay,
  isZhMatrixLocale,
  yongshenChipsForLocale,
} from "@/lib/poju/bazi-matrix-mappings";
import { buildElementPillarMap, type ElementPillarRow } from "@/lib/poju/build-element-pillar-map";
import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { activePillarByAge } from "@/lib/poju/matrix-life-segment";
import { computeYearTransitProgress } from "@/lib/poju/matrix-transit-progress";
import { resolveBaziLabel } from "@/lib/poju/resolve-bazi-i18n";
import { normalizeShenshaLocale, resolveShenshaList } from "@/lib/poju/shensha";
import { tMatrix } from "@/lib/poju/poju-matrix-i18n";
import { formatBirthClockTime } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";
import "@/styles/poju-energy-matrix.css";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
  compact?: boolean;
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

function formatLifeStageBranch(
  pl: { branch: string; branch_en: string; life_stage_label: string | null },
  lifeStageKey: string | undefined,
  tb: (key: string) => string,
  locale: string,
): string {
  const stageLabel = resolveBaziLabel(lifeStageKey, tb, pl.life_stage_label ?? undefined);
  if (isZhMatrixLocale(locale)) {
    return formatBranchDisplay(pl.branch, locale, stageLabel || pl.life_stage_label);
  }
  if (!stageLabel) return pl.branch_en;
  const han = pl.life_stage_label ?? "";
  return han && !stageLabel.includes(han) ? `${pl.branch_en} · ${stageLabel} (${han})` : `${pl.branch_en} · ${stageLabel}`;
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

function RadarChart({ scores }: { scores: PojuMatrixPayload["wuxing_scores"] }) {
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
          center: ["50%", "54%"],
          radius: "80%",
          startAngle: 90,
          splitNumber: 3,
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
          indicator: scores.map((s) => ({ name: s.element, max: max * 1.1 })),
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
  }, [scores]);

  return <div className="radar radar--compact" ref={ref} aria-hidden />;
}

function ElementPillarMap({
  rows,
  colon,
  tb,
  tm,
  showTitle = true,
}: {
  rows: ElementPillarRow[];
  colon: string;
  tb: (key: string) => string;
  tm: (key: string) => string;
  showTitle?: boolean;
}) {
  if (!rows.length) return null;

  return (
    <div className="pem__element-map" aria-label={tm("element_map_title")}>
      {showTitle ? <div className="pem__element-map-title">{tm("element_map_title")}</div> : null}
      <div className="pem__element-map-body-wrap">
        {rows.map((row) => (
          <div className="pem__element-map-row" key={row.element}>
            <span className={`pem__element-map-el ${ELEMENT_CLASS[row.element] ?? ""}`}>
              {tb(`element.${row.element.toLowerCase()}`)}
            </span>
            <span className="pem__element-map-slots">
              {row.assignments.map((assignment, index) => (
                <span className="pem__element-map-entry" key={assignment.slot}>
                  {index > 0 ? tm("element_map_sep") : null}
                  {tb(`pillar_slot.${assignment.slot}`)}
                  {colon}
                  <span className="pem__element-map-glyph">{assignment.display_glyph}</span>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PojuEnergyMatrix({ payload, locale, compact = false, subjectPrefix }: Props) {
  const { structured, user_profile, wuxing_scores, strength, matrix_id } = payload;
  const shenshaLocale = normalizeShenshaLocale(locale);
  const isZh = isZhMatrixLocale(locale);
  const tb = useTranslations("bazi");
  const tm = useTranslations("poju_matrix");
  const tc = useTranslations("poju_matrix.card");

  const elementPillarRows = useMemo(
    () => buildElementPillarMap(structured.pillars_detail, locale),
    [structured.pillars_detail, locale],
  );

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
    if (cached.narrative_source === "llm") {
      return {
        ...base,
        synopsis: cached.synopsis,
        structural_dynamics: cached.structural_dynamics,
        annual_transit: { ...base.annual_transit, narrative: cached.annual_transit.narrative },
        enote_caption: cached.enote_caption,
        narrative_source: cached.narrative_source,
        narrative_locale: cached.narrative_locale,
        narrative_failed: cached.narrative_failed,
      };
    }
    if (cached.narrative_failed) {
      return {
        ...base,
        synopsis: cached.synopsis,
        structural_dynamics: cached.structural_dynamics,
        annual_transit: { ...base.annual_transit, narrative: cached.annual_transit.narrative },
        enote_caption: cached.enote_caption,
        narrative_source: cached.narrative_source ?? "template",
        narrative_locale: cached.narrative_locale,
        narrative_failed: true,
      };
    }
    return base;
  }, [payload.display, user_profile, structured, strength, wuxing_scores, locale]);

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

  const isLlmNarrative = display.narrative_source === "llm";
  const showTemplateFallback = display.narrative_failed === true;
  const narrativeLoading = !isLlmNarrative && !showTemplateFallback;

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

  const pillarLabels: Record<string, string> = {
    year: tc("pillar_year"),
    month: tc("pillar_month"),
    day: tc("pillar_day"),
    hour: tc("pillar_hour"),
  };

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

      <section className="device">
        <span className="reg tl" />
        <span className="reg tr" />
        <span className="reg bl" />
        <span className="reg br" />

        <div className="dev-head">
          <div className="t">{tm("section_label")}</div>
        </div>

        <div className="topband">
          <div className="tcard zsign">
            <div className="zsign__art">
              <span>{display.zodiac.han}</span>
            </div>
            <div className="zsign__en">{display.zodiac.en}</div>
            <div className="zsign__cn">
              {display.zodiac.han} · {display.zodiac.pinyin}
            </div>
            <div className="zsign__tag">{tc("your_sign_tag")}</div>
            <div className="zsign__note">{display.zodiac.note}</div>
          </div>

          <div className="tcard a">
            <div className="k">
              <span className="bull" />
              {tc("calendar_alignment")} <em>· {tc("calendar_alignment_em")}</em>
            </div>
            <div className="v">
              {display.calendar.gregorian} <small>{tc("gregorian")}</small>
            </div>
            <div className="mid">
              {display.calendar.headline}
              {genderLabel ? <span className="pem__gender-tag">{genderLabel}</span> : null}
            </div>
            <div className="s">{display.calendar.lunar || display.calendar.mid}</div>
          </div>

          <div className="tcard a">
            <div className="k">
              <span className="bull" />
              {tc("true_solar_time")} <em>· {tc("true_solar_time_em")}</em>
            </div>
            {tst ? (
              <>
                <div className="tst">
                  <div className="t">
                    <div className="vv">{tst.original_time}</div>
                    <div className="kk">{tc("standard_time")}</div>
                  </div>
                  <div className="arr">→</div>
                  <div className="t">
                    <div className="vv gold">{tst.true_solar_time}</div>
                    <div className="kk">{tc("true_solar")}</div>
                  </div>
                  {tst.diff_minutes !== 0 ? (
                    <div className="chip">
                      {tst.diff_minutes > 0 ? "+" : "−"}
                      {Math.abs(tst.diff_minutes)}m
                    </div>
                  ) : null}
                </div>
                <div className="s">
                  {tc("longitude_correction")} ·{" "}
                  {tst.longitude_diff_minutes ?? tst.diff_minutes}m
                  {tst.eq_of_time_minutes != null
                    ? ` · ${tc("eq_of_time")} ${tst.eq_of_time_minutes > 0 ? "+" : ""}${tst.eq_of_time_minutes}m`
                    : null}
                </div>
              </>
            ) : (
              <div className="v">—</div>
            )}
          </div>

          <div className="tcard a">
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

        <div className="block block--spread pem-wuxing-grid">
          <div className="pem-wuxing__left">
            <div className="pem-wuxing-card pem-wuxing-card--radar">
              <div className="pem-wuxing-card__label">
                {tc("elemental_signature")} <em>· {tc("elemental_signature_em")}</em>
              </div>
              <div className="pem-wuxing-card__body pem-wuxing-card__body--radar">
                <RadarChart scores={wuxing_scores} />
              </div>
            </div>
            <div className="pem-wuxing-card pem-wuxing-card--map">
              <div className="pem-wuxing-card__label">
                {tm("element_map_title")} <em>· {tc("pillars_em")}</em>
              </div>
              <div className="pem-wuxing-card__body pem-wuxing-card__body--map">
                <ElementPillarMap
                  rows={elementPillarRows}
                  colon={tc("colon")}
                  tb={tb}
                  tm={tm}
                  showTitle={false}
                />
              </div>
            </div>
          </div>
          <div className="pem-wuxing__right">
            <div className="ro ro--wuxing">
              <div className="ro__k">{tc("elemental_breakdown")}</div>
              <div className="elist">
                {wuxing_scores.map((row) => (
                  <div className="erow" key={row.element}>
                    <span className={`ename ${ELEMENT_CLASS[row.element] ?? ""}`}>{row.element}</span>
                    <span className="ecn">{row.element_zh}</span>
                    <span className="ebar">
                      <i
                        style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                        className={ELEMENT_BAR_CLASS[row.element] ?? ""}
                      />
                    </span>
                    <span className="ecount">{row.count}</span>
                  </div>
                ))}
              </div>
              {yongshenChips.length > 0 ? (
                <div className="pem__yongshen-row">
                  <span className="pem__yongshen-label">{tb("optimizing_vector")}</span>
                  <span className="pem__yongshen-chips">
                    {yongshenChips.map((chip) => (
                      <span
                        key={chip.label}
                        className={`pem__yongshen-chip ${elementCssClass(chip.elementKey)}`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </span>
                </div>
              ) : null}
              <div className="enote">
                {narrativeLoading ? (
                  <NarrativePlaceholder label={tc("narrative_loading")} />
                ) : isLlmNarrative && display.enote_caption ? (
                  display.enote_caption
                ) : showTemplateFallback ? (
                  <>
                    {tc("day_master")} <b>{display.day_master.en}</b>
                    {tc("with_surplus")}
                    <b>{dominant?.element}</b>
                    {tc("surplus_and")}
                    <b>{deficit?.element}</b>
                    {tc("deficit_period")}
                  </>
                ) : null}
              </div>
            </div>
            <div className="ro ro--wuxing">
              <div className="ro__k">{tc("core_vitality")}</div>
              <div className="ro__v ro__v--metric">{strengthLabel(strength, tc)}</div>
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
            <div className="ro ro--wuxing">
              <div className="ro__k">{tc("elemental_equilibrium")}</div>
              {dominant ? (
                <>
                  <div className="ro__v ro__v--metric">
                    <span className={`ro__v-accent ${ELEMENT_CLASS[dominant.element] ?? ""}`}>
                      {dominant.element}
                    </span>
                    <span className="pct">
                      {tc("surplus")} · {dominant.pct}%
                    </span>
                  </div>
                  <div className="ro__tag up">
                    ▲ {tc("dominant_vector")} · {dominant.element.toLowerCase()}
                  </div>
                </>
              ) : null}
              {deficit ? (
                <>
                  <div className="ro__v ro__v--metric" style={{ marginTop: 12 }}>
                    <span className={`ro__v-accent ${ELEMENT_CLASS[deficit.element] ?? ""}`}>
                      {deficit.element}
                    </span>
                    <span className="pct">
                      {tc("deficit")} · {deficit.pct}%
                    </span>
                  </div>
                  <div className="ro__tag down">
                    ▼ {tc("key_gap")} · {deficit.element.toLowerCase()}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="block block--fill">
          <div className="dialpanel">
            <div className="rp__k">
              {tc("macro_lifecycle")} <em>· {tc("macro_lifecycle_em")}</em>
            </div>
            <PojuDaYunDial
              daYun={structured.da_yun}
              currentIndex={display.current_dayun_index}
              hub={display.dayun_hub}
              currentAge={display.current_age}
              locale={locale}
            />
          </div>
          <div className="side">
            <div className="ro ro__friction">
              <div className="ro__k">{tc("structural_dynamics")}</div>
              {narrativeLoading ? (
                <NarrativePlaceholder label={tc("narrative_loading")} />
              ) : (
                <>
                  <div className="fr">
                    <span className="fk res">{tc("resonance_label")}</span>
                    <span>{display.structural_dynamics.resonance}</span>
                  </div>
                  <div className="fr">
                    <span className="fk ten">{tc("tension_label")}</span>
                    <span>{display.structural_dynamics.tension}</span>
                  </div>
                  <div className="fr">
                    <span className="fk neu">{tc("reading_label")}</span>
                    <span>{display.structural_dynamics.reading}</span>
                  </div>
                </>
              )}
            </div>
            <div className="ro">
              <div className="ro__k">
                {tc("annual_transit")} · {display.annual_transit.year}
              </div>
              <div className="ro__v">
                <span className={elementCssClass(display.annual_transit.stem_en.split(" ")[1] ?? "")}>
                  {formatStemDisplay(display.annual_transit.ganzhi.charAt(0), locale)}
                </span>
                <span className="pct" style={{ flexBasis: "100%" }}>
                  {display.annual_transit.ganzhi} · {display.annual_transit.pinyin}
                </span>
              </div>
              <p className="transit-note">
                {narrativeLoading ? <NarrativePlaceholder label={tc("narrative_loading")} /> : display.annual_transit.narrative}
              </p>
              <div className="tprog">
                <div className="tprog__bar">
                  <i style={{ width: `${transitProgress}%` }} />
                </div>
                <div className="tprog__lab">
                  <span>
                    {display.annual_transit.year} {tc("transit_progress")}
                  </span>
                  <span className="blink">{transitProgress}% ▮</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pillars">
          {display.pillars.map((pl, idx) => {
            const keys = ["year", "month", "day", "hour"] as const;
            const key = keys[idx] ?? "year";
            const isDay = key === "day";
            const isLifeSegment = lifeSegmentPillar === key;
            return (
              <div
                key={key}
                className={`pl${isDay ? " day" : ""}${isLifeSegment ? " pl--segment-active" : ""}`}
              >
                <div className="cap">{pillarLabels[key]}</div>
                <div className="role" style={isDay ? { color: "var(--gold-soft)" } : undefined}>
                  {isZh ? pl.ten_god : pl.ten_god_en}
                  {!isZh ? <span className="cn">{pl.ten_god}</span> : null}
                </div>
                <div className="stem">
                  <div className={`en ${elementCssClass(pl.stem_element)}`}>
                    {formatStemDisplay(pl.stem, locale)}
                  </div>
                  <div className="sub">
                    <span className="seal">{pl.stem}</span>
                    <span className="pin">{pl.stem_pinyin}</span>
                  </div>
                </div>
                <div className="branch">
                  <div className="en">
                    {formatLifeStageBranch(
                      pl,
                      payload.structured.pillars_detail?.[key]?.life_stage,
                      tb,
                      locale,
                    )}
                  </div>
                  <div className="sub">
                    {pl.branch} {pl.branch_pinyin}
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
                          title={star.gloss}
                        >
                          ✦ {star.label}
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
