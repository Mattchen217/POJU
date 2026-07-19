"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";

import { SoftTermHover } from "@/components/cross-product/GlossaryText";
import { PojuDaYunTimeline } from "@/components/poju/PojuDaYunTimeline";
import {
  elementCssClass,
  isZhMatrixLocale,
  yongshenChipsForLocale,
} from "@/lib/poju/bazi-matrix-mappings";
import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import { activePillarByAge } from "@/lib/poju/matrix-life-segment";
import { matrixSynopsisNarrativeState } from "@/lib/poju/matrix-narrative-text";
import {
  elementToSlug,
  matrixElementSoft,
  matrixSoftTerm,
  matrixTermSlug,
  pillarSlotSlug,
  strengthToSlug,
  zodiacHanToSlug,
} from "@/lib/poju/matrix-term-labels";
import { computeYearTransitProgress } from "@/lib/poju/matrix-transit-progress";
import { tMatrix } from "@/lib/poju/poju-matrix-i18n";
import { resolveBaziLabel } from "@/lib/poju/resolve-bazi-i18n";
import { normalizeShenshaLocale, resolveShenshaList } from "@/lib/poju/shensha";
import { ZODIAC_ICON_BY_HAN } from "@/lib/poju/zodiac-icon-assets";
import { formatBirthClockTime } from "@/lib/profile/birth-info-utils";
import type { UserProfile } from "@/lib/profile/types";
import "@/styles/poju-celestial-matrix.css";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
  compact?: boolean;
  suppressNarrative?: boolean;
  subjectPrefix?: string;
};

const BAR_FILL: Record<string, string> = {
  Wood: "pcm-bar__fill--wood",
  Fire: "pcm-bar__fill--fire",
  Earth: "pcm-bar__fill--earth",
  Metal: "pcm-bar__fill--metal",
  Water: "pcm-bar__fill--water",
};

function strengthLabel(
  strength: "strong" | "weak" | "balanced",
  tc: (k: string) => string,
): string {
  if (strength === "strong") return tc("strength_strong");
  if (strength === "weak") return tc("strength_weak");
  return tc("strength_balanced");
}

function vitalityPin(strength: "strong" | "weak" | "balanced"): string {
  if (strength === "weak") return "22%";
  if (strength === "balanced") return "50%";
  return "78%";
}

function formatBornLine(profile: UserProfile): string {
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ??
    profile.birth.tst_meta?.original_time ??
    formatBirthClockTime(b);
  const date = `${b.year} - ${pad(b.month)} - ${pad(b.day)}`;
  return time ? `${date} - ${time}` : date;
}

function formatCoordinates(profile: UserProfile, locale: string): string {
  const loc = profile.birth.birth_location;
  const tstLon = profile.tst_meta?.longitude ?? profile.birth.tst_meta?.longitude;
  const lon = loc?.longitude ?? tstLon;
  if (loc?.name && lon != null && !loc.use_defaults) {
    const dir = lon >= 0 ? "E" : "W";
    return `${loc.name} ${Math.abs(lon).toFixed(2)}°${dir}`;
  }
  return profile.birth.timezone || tMatrix(locale, "card.default_timezone");
}

function SoftEl({
  element,
  locale,
}: {
  element: string;
  locale: string;
}) {
  const slug = elementToSlug(element);
  const soft = matrixElementSoft(element, locale);
  if (!soft) return null;
  return slug ? (
    <SoftTermHover slug={slug} locale={locale} fallback={soft} />
  ) : (
    <>{soft}</>
  );
}

function PcmChip({
  soft,
  slug,
  locale,
  tone = "neutral",
}: {
  soft: string;
  slug?: string | null;
  locale: string;
  tone?: "cyan" | "coral" | "gold" | "neutral";
}) {
  if (!soft) return null;
  return (
    <span className={`pcm-chip pcm-chip--${tone}`}>
      {slug ? (
        <SoftTermHover slug={slug} locale={locale} fallback={soft} />
      ) : (
        soft
      )}
    </span>
  );
}

type PillarSlot = "year" | "month" | "day" | "hour";

const LAYER_BANDS: Array<{
  key: PillarSlot;
  band: string;
  progress: (age: number) => number;
}> = [
  { key: "year", band: "0–16", progress: (a) => Math.min(100, (a / 16) * 100) },
  {
    key: "month",
    band: "17–32",
    progress: (a) => Math.min(100, Math.max(0, ((a - 16) / 16) * 100)),
  },
  {
    key: "day",
    band: "33–48",
    progress: (a) => Math.min(100, Math.max(0, ((a - 32) / 16) * 100)),
  },
  {
    key: "hour",
    band: "49+",
    progress: (a) => Math.min(100, Math.max(0, ((a - 48) / 16) * 100)),
  },
];

/** Age → four-layer stack with active pin (激活层). */
function FactLayerStack({
  active,
  age,
  locale,
}: {
  active: PillarSlot;
  age: number;
  locale: string;
}) {
  return (
    <div className="pcm-fviz pcm-fviz-layers" aria-hidden>
      {LAYER_BANDS.map((row) => {
        const on = row.key === active;
        const pct = on ? Math.round(row.progress(age)) : 28;
        return (
          <div
            key={row.key}
            className={`pcm-fviz-layers__row${on ? " pcm-fviz-layers__row--on" : ""}`}
            style={{ "--pcm-layer-pct": `${pct}%` } as CSSProperties}
          >
            <span className="pcm-fviz-layers__name">
              <SoftTermHover slug={pillarSlotSlug(row.key)} locale={locale} />
            </span>
            <div className="pcm-fviz-layers__track">
              <div className="pcm-fviz-layers__fill" />
              {on ? <span className="pcm-fviz-layers__pin" /> : null}
            </div>
            <span className="pcm-fviz-layers__band">{row.band}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Circular year-progress ring + 12 month ticks (岁环). */
function FactYearRing({
  year,
  progress,
  progressLabel,
}: {
  year: number;
  progress: number;
  progressLabel: string;
}) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, progress));
  const dash = (pct / 100) * c;
  const month = Math.min(11, Math.floor((pct / 100) * 12));
  return (
    <div className="pcm-fviz pcm-fviz-ring" aria-hidden>
      <svg className="pcm-fviz-ring__svg" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="rgba(52,52,64,0.95)"
          strokeWidth="6"
        />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="var(--pcm-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform="rotate(-90 40 40)"
          style={{ filter: "drop-shadow(0 0 6px rgba(242,202,80,0.45))" }}
        />
        <text
          x="40"
          y="38"
          textAnchor="middle"
          fill="#fff"
          fontSize="14"
          fontWeight="700"
          fontFamily="var(--pcm-mono)"
        >
          {pct}%
        </text>
        <text
          x="40"
          y="52"
          textAnchor="middle"
          fill="var(--pcm-on-variant)"
          fontSize="8"
          fontFamily="var(--pcm-mono)"
        >
          {year}
        </text>
      </svg>
      <div className="pcm-fviz-ring__meta">
        <div className="pcm-fviz-ring__ticks">
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className={`pcm-fviz-ring__tick${
                i < month
                  ? " pcm-fviz-ring__tick--on"
                  : i === month
                    ? " pcm-fviz-ring__tick--now"
                    : ""
              }`}
            />
          ))}
        </div>
        <div className="pcm-fviz__caption">
          <span>{progressLabel}</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/** Natal bond/tension node graph + meters (结构联接). */
function FactStructureGraph({
  bondCount,
  tensionCount,
  bondLabel,
  tensionLabel,
}: {
  bondCount: number;
  tensionCount: number;
  bondLabel: string;
  tensionLabel: string;
}) {
  const nodes = [
    { x: 28, y: 28 },
    { x: 132, y: 22 },
    { x: 48, y: 78 },
    { x: 118, y: 72 },
  ];
  const bondEdges = [
    [0, 1],
    [0, 2],
    [1, 3],
  ].slice(0, Math.max(1, Math.min(3, bondCount || 1)));
  const tensionEdges = [
    [1, 2],
    [2, 3],
  ].slice(0, Math.max(0, Math.min(2, tensionCount)));
  const bondPct = Math.min(100, bondCount * 28 + (bondCount ? 16 : 0));
  const tensionPct = Math.min(100, tensionCount * 32 + (tensionCount ? 12 : 0));
  return (
    <div className="pcm-fviz" aria-hidden>
      <svg className="pcm-fviz-graph" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet">
        {bondEdges.map(([a, b], i) => (
          <line
            key={`b-${i}`}
            x1={nodes[a]!.x}
            y1={nodes[a]!.y}
            x2={nodes[b]!.x}
            y2={nodes[b]!.y}
            stroke="var(--pcm-secondary-container)"
            strokeWidth="1.5"
            strokeOpacity="0.55"
          />
        ))}
        {tensionEdges.map(([a, b], i) => (
          <line
            key={`t-${i}`}
            x1={nodes[a]!.x}
            y1={nodes[a]!.y}
            x2={nodes[b]!.x}
            y2={nodes[b]!.y}
            stroke="var(--pcm-tertiary-container)"
            strokeWidth="1.5"
            strokeOpacity="0.65"
            strokeDasharray="4 3"
          />
        ))}
        {nodes.map((n, i) => (
          <g key={i}>
            <circle
              cx={n.x}
              cy={n.y}
              r="7"
              fill="var(--pcm-surface-high)"
              stroke={
                i === 2
                  ? "var(--pcm-primary)"
                  : "rgba(208,197,175,0.45)"
              }
              strokeWidth="1.5"
            />
            <circle
              cx={n.x}
              cy={n.y}
              r="2.2"
              fill={i === 2 ? "var(--pcm-primary)" : "var(--pcm-on-variant)"}
            />
          </g>
        ))}
      </svg>
      <div className="pcm-fviz-meters">
        <div>
          <div className="pcm-fviz-meter__label">
            <span>{bondLabel}</span>
            <span>{bondCount}</span>
          </div>
          <div className="pcm-fviz-meter__track">
            <div
              className="pcm-fviz-meter__fill--bond"
              style={{ "--pcm-meter-pct": `${bondPct}%` } as CSSProperties}
            />
          </div>
        </div>
        <div>
          <div className="pcm-fviz-meter__label">
            <span>{tensionLabel}</span>
            <span>{tensionCount}</span>
          </div>
          <div className="pcm-fviz-meter__track">
            <div
              className="pcm-fviz-meter__fill--tension"
              style={{ "--pcm-meter-pct": `${tensionPct}%` } as CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Balance scale + strength continuum (调衡). */
function FactBalanceViz({
  strength,
  xiCount,
  jiCount,
  yongSoft,
  weakLabel,
  strongLabel,
  xiLabel,
  jiLabel,
  anchorLabel,
}: {
  strength: "strong" | "weak" | "balanced";
  xiCount: number;
  jiCount: number;
  yongSoft: string | null;
  weakLabel: string;
  strongLabel: string;
  xiLabel: string;
  jiLabel: string;
  anchorLabel: string;
}) {
  const balPct = strength === "weak" ? 22 : strength === "strong" ? 78 : 50;
  const tilt = strength === "weak" ? -12 : strength === "strong" ? 12 : 0;
  const xiPct = Math.min(100, xiCount * 30 + (xiCount ? 20 : 0));
  const jiPct = Math.min(100, jiCount * 36 + (jiCount ? 16 : 0));
  return (
    <div className="pcm-fviz pcm-fviz-balance" aria-hidden>
      <svg className="pcm-fviz-scale" viewBox="0 0 200 56" preserveAspectRatio="xMidYMid meet">
        <line
          x1="100"
          y1="8"
          x2="100"
          y2="28"
          stroke="rgba(208,197,175,0.45)"
          strokeWidth="1.5"
        />
        <g transform={`rotate(${tilt} 100 28)`}>
          <line
            x1="36"
            y1="28"
            x2="164"
            y2="28"
            stroke="var(--pcm-primary)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect
            x="28"
            y="32"
            width="28"
            height="14"
            rx="2"
            fill="rgba(0,238,252,0.15)"
            stroke="var(--pcm-secondary-container)"
            strokeWidth="1"
          />
          <rect
            x="144"
            y="32"
            width="28"
            height="14"
            rx="2"
            fill="rgba(255,149,148,0.15)"
            stroke="var(--pcm-tertiary-container)"
            strokeWidth="1"
          />
        </g>
        <circle
          cx="100"
          cy="28"
          r="4"
          fill="var(--pcm-primary)"
          style={{ filter: "drop-shadow(0 0 4px rgba(242,202,80,0.6))" }}
        />
        {yongSoft ? (
          <text
            x="100"
            y="52"
            textAnchor="middle"
            fill="var(--pcm-primary-fixed)"
            fontSize="8"
            fontFamily="var(--pcm-mono)"
          >
            {anchorLabel} · {yongSoft}
          </text>
        ) : null}
      </svg>
      <div>
        <div
          className="pcm-fviz-continuum"
          style={{ "--pcm-bal-pct": `${balPct}%` } as CSSProperties}
        >
          <span className="pcm-fviz-continuum__pin" />
        </div>
        <div className="pcm-fviz-continuum__labels">
          <span>{weakLabel}</span>
          <span>{strongLabel}</span>
        </div>
      </div>
      <div className="pcm-fviz-xi-ji">
        <div>
          <div className="pcm-fviz-xi-ji__k">
            {xiLabel} · {xiCount}
          </div>
          <div className="pcm-fviz-xi-ji__bar">
            <div
              className="pcm-fviz-xi-ji__fill--xi"
              style={{ "--pcm-meter-pct": `${xiPct}%` } as CSSProperties}
            />
          </div>
        </div>
        <div>
          <div className="pcm-fviz-xi-ji__k">
            {jiLabel} · {jiCount}
          </div>
          <div className="pcm-fviz-xi-ji__bar">
            <div
              className="pcm-fviz-xi-ji__fill--ji"
              style={{ "--pcm-meter-pct": `${jiPct}%` } as CSSProperties}
            />
          </div>
        </div>
      </div>
    </div>
  );
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
    let chart: {
      resize: () => void;
      dispose: () => void;
      setOption: (o: unknown) => void;
    } | null = null;
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
          radius: "62%",
          startAngle: 90,
          splitNumber: 4,
          axisNameGap: 12,
          axisName: {
            color: "rgba(227,224,241,0.92)",
            fontSize: 14,
            fontWeight: 600,
            fontFamily:
              '"Plus Jakarta Sans", "Noto Sans SC", "PingFang SC", Inter, sans-serif',
            padding: [2, 6],
          },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.2)" } },
          splitArea: {
            areaStyle: {
              color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"],
            },
          },
          axisLine: { lineStyle: { color: "rgba(255,255,255,0.18)" } },
          indicator: scores.map((s) => ({
            name: matrixElementSoft(s.element, locale),
            max: max * 1.1,
          })),
        },
        series: [
          {
            type: "radar",
            symbol: "circle",
            symbolSize: 5,
            data: [
              {
                value: scores.map((s) => s.count),
                lineStyle: { color: "#00eefc", width: 2 },
                itemStyle: { color: "#f2ca50" },
                areaStyle: { color: "rgba(0,238,252,0.12)" },
              },
            ],
          },
        ],
      });
    })();

    const onResize = () => chart?.resize();
    window.addEventListener("resize", onResize);
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(el);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      chart?.dispose();
    };
  }, [scores, locale]);

  return <div className="pcm-radar__canvas" ref={ref} aria-hidden />;
}

export function PojuEnergyMatrix({
  payload,
  locale,
  compact = false,
  suppressNarrative = false,
  subjectPrefix,
}: Props) {
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
  const fp = display.fact_panel;
  const lifeSegmentPillar = activePillarByAge(display.current_age);

  const genderLabel = structured.bazi_enrichment?.gender_label
    ? resolveBaziLabel(structured.bazi_enrichment.gender_label, tb)
    : user_profile.birth.gender === "M"
      ? tb("gender.qian")
      : tb("gender.kun");

  const yongshenChips = useMemo(
    () =>
      yongshenChipsForLocale(
        structured.bazi_enrichment?.yongshen_analysis,
        locale,
      ),
    [structured.bazi_enrichment?.yongshen_analysis, locale],
  );

  const { isLlmNarrative, showTemplateFallback, narrativeLoading } =
    matrixSynopsisNarrativeState(display);

  const [transitProgress, setTransitProgress] = useState(() =>
    computeYearTransitProgress(),
  );
  useEffect(() => {
    setTransitProgress(computeYearTransitProgress());
    const id = window.setInterval(
      () => setTransitProgress(computeYearTransitProgress()),
      60_000,
    );
    return () => window.clearInterval(id);
  }, []);

  const zdSlug = zodiacHanToSlug(display.zodiac.han);
  const emptyLinks = tc("fact_empty_links");

  return (
    <div className={`pcm${compact ? " pcm--compact pcm--embedded" : ""}`}>
      <div className="pcm__stars" aria-hidden />
      <div className="pcm__wrap">
        <header className="pcm__header">
          <h1 className="pcm__title pcm__title--gradient">{tm("main_title")}</h1>
          <p className="pcm__header-desc">{tm("main_description")}</p>
          <div className="pcm__header-meta">
            {subjectPrefix ? (
              <span>
                <b>{subjectPrefix}</b>
              </span>
            ) : null}
            <span>
              {tm("born")} {formatBornLine(user_profile)}
            </span>
            <span>
              {tm("coordinates")} {formatCoordinates(user_profile, locale)}
            </span>
            <span>
              {tm("matrix_id")} {matrix_id}
            </span>
          </div>
        </header>

        {/* ── 1. Zodiac + Calibration ── */}
        <section className="pcm__section">
          <div className="pcm__grid-12">
            <div className="pcm-card pcm-card--center pcm-zodiac pcm__span-3">
              <div className="pcm-zodiac__art">
                {zodiacIcon ? (
                  <Image
                    src={zodiacIcon}
                    alt=""
                    width={96}
                    height={96}
                    className="pcm-zodiac__art-img"
                  />
                ) : (
                  <span className="pcm-zodiac__name">{display.zodiac.han}</span>
                )}
              </div>
              <div className="pcm-zodiac__name">
                {zdSlug ? (
                  <SoftTermHover
                    slug={zdSlug}
                    locale={locale}
                    fallback={isZh ? display.zodiac.han : display.zodiac.en}
                  />
                ) : isZh ? (
                  display.zodiac.han
                ) : (
                  display.zodiac.en
                )}
              </div>
              <div className="pcm-zodiac__pinyin">{display.zodiac.pinyin}</div>
              <div className="pcm-zodiac__year">
                {user_profile.birth.year}
                {isZh ? "年" : ""}
              </div>
              <p className="pcm-zodiac__caption">{tc("your_sign_tag")}</p>
            </div>

            <div className="pcm-card pcm-cal pcm__span-9">
              <div className="pcm-label pcm-label--gold">{tm("section_label")}</div>
              <div className="pcm-cal__grid">
                <div className="pcm-cal__cell">
                  <div className="pcm-cal__kicker">
                    {tc("calendar_alignment")} · {tc("calendar_alignment_em")}
                  </div>
                  <div className="pcm-cal__value">
                    {display.calendar.gregorian}{" "}
                    <span className="pcm-cal__unit">{tc("gregorian")}</span>
                  </div>
                  {display.calendar.lunar ? (
                    <div className="pcm-cal__sub">{display.calendar.lunar}</div>
                  ) : null}
                  <div className="pcm-cal__accent">
                    {display.calendar.headline}
                    {genderLabel ? ` ${genderLabel}` : ""}
                  </div>
                </div>

                <div className="pcm-cal__cell">
                  <div className="pcm-cal__kicker">
                    <SoftTermHover slug="tm_true_solar_time" locale={locale} />
                    {" · "}
                    {tc("true_solar_time_em")}
                  </div>
                  {tst ? (
                    <>
                      <div className="pcm-cal__times">
                        <div>
                          <div className="pcm-cal__time-val">
                            {tst.original_time}
                          </div>
                          <div className="pcm-cal__time-label">
                            {tc("standard_time")}
                          </div>
                        </div>
                        <div className="pcm-cal__arrow">→</div>
                        <div>
                          <div className="pcm-cal__time-val pcm-cal__time-val--dim">
                            {tst.true_solar_time}
                          </div>
                          <div className="pcm-cal__time-label">
                            <SoftTermHover
                              slug="tm_true_solar_time"
                              locale={locale}
                            />
                          </div>
                        </div>
                      </div>
                      {tst.diff_minutes !== 0 ? (
                        <div className="pcm-cal__delta">
                          {tst.diff_minutes > 0 ? "+" : "−"}
                          {Math.abs(Number(tst.diff_minutes.toFixed(2)))}m
                        </div>
                      ) : null}
                      <div className="pcm-cal__note">
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
                    <div className="pcm-cal__value">—</div>
                  )}
                </div>

                <div className="pcm-cal__cell">
                  <div className="pcm-cal__kicker">
                    {tc("solar_term")} · {tc("solar_term_em")}
                  </div>
                  <div className="pcm-cal__value">
                    {isZh
                      ? display.solar_term.name
                      : display.solar_term.name_en}{" "}
                    <span className="pcm-cal__unit">
                      {isZh
                        ? display.solar_term.name_en
                        : display.solar_term.name}
                    </span>
                  </div>
                  <div className="pcm-cal__sub">{display.solar_term.season}</div>
                  <div className="pcm-term">
                    <div className="pcm-term__head">
                      <span>{tc("solar_term")}</span>
                      <span>
                        {tc("next_term")}: {display.solar_term.next_name}
                      </span>
                    </div>
                    <div className="pcm-term__track">
                      <div
                        className="pcm-term__fill"
                        style={
                          {
                            "--pcm-term-pct": `${display.solar_term.progress_pct}%`,
                          } as CSSProperties
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Radar + Bars ── */}
        <section className="pcm__section">
          <div className="pcm__grid-12">
            <div className="pcm-card pcm-radar pcm__span-5">
              <div className="pcm-label pcm-label--cyan">
                {tc("radar_matrix")} · {tc("radar_matrix_em")}
              </div>
              <div className="pcm-radar__chart">
                <RadarChart scores={wuxing_scores} locale={locale} />
              </div>
            </div>

            <div className="pcm-card pcm-bars pcm__span-7">
              <div className="pcm-label pcm-label--cyan-soft">
                {tc("elemental_signature")} · {tc("elemental_signature_em")}
              </div>
              <div className="pcm-bars__list">
                {wuxing_scores.map((row) => {
                  const pct = Math.round((row.count / maxCount) * 100);
                  return (
                    <div className="pcm-bar" key={row.element}>
                      <div className="pcm-bar__meta">
                        <span className="pcm-bar__name">
                          <SoftEl element={row.element} locale={locale} />
                        </span>
                        <span className="pcm-bar__value">{row.count}</span>
                      </div>
                      <div className="pcm-bar__track">
                        <div
                          className={`pcm-bar__fill ${BAR_FILL[row.element] ?? ""}`}
                          style={{ "--pcm-bar-pct": `${pct}%` } as CSSProperties}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pcm-bars__footer">
                <span className="pcm-bars__id">
                  {tm("matrix_id")} · {matrix_id}
                </span>
                {yongshenChips.length > 0 ? (
                  <div className="pcm-chips">
                    <span className="pcm-chip pcm-chip--caps pcm-chip--neutral">
                      {tc("fact_anchor")} ·{" "}
                      {yongshenChips.map((c) => c.label).join(" · ")}
                    </span>
                  </div>
                ) : null}
              </div>
              {!suppressNarrative && narrativeLoading ? (
                <p className="pcm-cal__note">{tc("narrative_loading")}</p>
              ) : null}
              {!suppressNarrative && isLlmNarrative && display.enote_caption ? (
                <p className="pcm-cal__note">{display.enote_caption}</p>
              ) : null}
              {!suppressNarrative && showTemplateFallback ? (
                <p className="pcm-cal__note">
                  <SoftTermHover
                    slug="day_master"
                    locale={locale}
                    fallback={tc("day_master")}
                  />{" "}
                  <SoftEl element={display.day_master.element} locale={locale} />
                  {dominant ? (
                    <>
                      {" · "}
                      <SoftEl element={dominant.element} locale={locale} />
                    </>
                  ) : null}
                  {deficit ? (
                    <>
                      {" / "}
                      <SoftEl element={deficit.element} locale={locale} />
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>

          {/* ── 3. Vitality + Equilibrium ── */}
          <div className="pcm__grid-12">
            <div className="pcm-card pcm-vitality pcm__span-5">
              <div className="pcm-label pcm-label--coral">
                {tc("core_vitality")}
              </div>
              <h3 className="pcm-vitality__title">
                {tc("core_vitality")}:{" "}
                <SoftTermHover
                  slug={strengthToSlug(strength)}
                  locale={locale}
                  fallback={strengthLabel(strength, tc)}
                />
              </h3>
              <div className="pcm-vtrack">
                <div
                  className="pcm-vtrack__pin"
                  style={{ left: vitalityPin(strength) }}
                />
              </div>
              <div className="pcm-vtrack__labels">
                <span>{tc("vitality_receptive")}</span>
                <span>{tc("vitality_balance")}</span>
                <span>{tc("vitality_dominant")}</span>
              </div>
            </div>

            <div className="pcm-card pcm-eq pcm__span-7">
              <div className="pcm-label pcm-label--sand">
                {tc("elemental_equilibrium")}
              </div>
              <div className="pcm-eq__grid">
                {dominant ? (
                  <div className="pcm-eq__card">
                    <div className="pcm-eq__title">
                      <SoftEl element={dominant.element} locale={locale} />{" "}
                      {tc("surplus")}{" "}
                      <span className="pcm-eq__pct">{dominant.pct}%</span>
                    </div>
                    <div className="pcm-eq__segments">
                      <i className="pcm-eq__seg pcm-eq__seg--coral" />
                      <i className="pcm-eq__seg pcm-eq__seg--coral" style={{ opacity: 0.5 }} />
                      <i className="pcm-eq__seg pcm-eq__seg--dim" />
                    </div>
                    <div className="pcm-eq__hint pcm-eq__hint--up">
                      ▲ {tc("dominant_vector")}
                    </div>
                  </div>
                ) : null}
                {deficit ? (
                  <div className="pcm-eq__card">
                    <div className="pcm-eq__title">
                      <SoftEl element={deficit.element} locale={locale} />{" "}
                      {tc("deficit")}{" "}
                      <span className="pcm-eq__pct">{deficit.pct}%</span>
                    </div>
                    <div className="pcm-eq__segments">
                      <i className="pcm-eq__seg pcm-eq__seg--cyan" />
                      <i className="pcm-eq__seg pcm-eq__seg--dim" />
                    </div>
                    <div className="pcm-eq__hint pcm-eq__hint--down">
                      ▼ {tc("key_gap")}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ── 4. Timeline + 2×2 facts ── */}
        <section className="pcm__section">
          <div className="pcm__grid-12">
            <div className="pcm-card pcm-timeline pcm__span-4">
              <div className="pcm-label pcm-label--gold">
                {tc("macro_lifecycle")} · {tc("macro_lifecycle_em")}
              </div>
              <h3 className="pcm-type-lg" style={{ margin: "0 0 1.25rem", color: "#fff" }}>
                {tc("timeline_matrix")}
              </h3>
              <PojuDaYunTimeline
                daYun={structured.da_yun}
                currentIndex={display.current_dayun_index}
                currentAge={display.current_age}
                locale={locale}
              />
            </div>

            <div className="pcm-facts pcm__span-8">
              {(() => {
                const layerKeys = ["year", "month", "day", "hour"] as const;
                const layerIdx = layerKeys.indexOf(lifeSegmentPillar);
                const activePl = display.pillars[layerIdx >= 0 ? layerIdx : 0];
                const layerRoleSoft = activePl
                  ? isZh
                    ? activePl.ten_god
                    : activePl.ten_god_en
                  : "";
                const layerRoleSlug = activePl
                  ? lifeSegmentPillar === "day"
                    ? "day_master"
                    : matrixTermSlug(activePl.ten_god_han) ??
                      matrixTermSlug(activePl.ten_god) ??
                      matrixTermSlug(activePl.ten_god_en)
                  : null;
                const layerStemSlug = activePl?.stem_element
                  ? elementToSlug(activePl.stem_element)
                  : null;
                return (
                  <div className="pcm-card">
                    <div className="pcm-label pcm-label--flush pcm-label--gold">
                      {tc("fact_era")} · {tc("fact_era_em")}
                    </div>
                    <div
                      className="pcm-type-xl"
                      style={{
                        fontFamily: "var(--pcm-headline)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <SoftTermHover
                        slug={pillarSlotSlug(lifeSegmentPillar)}
                        locale={locale}
                      />
                    </div>
                    <div
                      className="pcm-type-body"
                      style={{
                        color: "var(--pcm-on-variant)",
                        marginTop: "0.35rem",
                      }}
                    >
                      {tc("fact_layer_age", { age: String(display.current_age) })}
                    </div>
                    <div className="pcm-chips" style={{ marginTop: "1rem" }}>
                      {activePl?.stem_element ? (
                        <PcmChip
                          soft={matrixElementSoft(activePl.stem_element, locale)}
                          slug={layerStemSlug}
                          locale={locale}
                          tone="gold"
                        />
                      ) : null}
                      {layerRoleSoft ? (
                        <PcmChip
                          soft={layerRoleSoft}
                          slug={layerRoleSlug}
                          locale={locale}
                          tone="cyan"
                        />
                      ) : null}
                    </div>
                    <FactLayerStack
                      active={lifeSegmentPillar}
                      age={display.current_age}
                      locale={locale}
                    />
                  </div>
                );
              })()}

              <div className="pcm-card">
                <div className="pcm-label pcm-label--flush pcm-label--cyan">
                  {tc("fact_year_pulse")} · {fp.year_pulse.year}
                </div>
                <div className="pcm-type-lg" style={{ color: "#fff", marginBottom: "0.5rem" }}>
                  {fp.year_pulse.stem_element_slug ? (
                    <SoftTermHover
                      slug={fp.year_pulse.stem_element_slug}
                      locale={locale}
                      fallback={fp.year_pulse.stem_element_soft}
                    />
                  ) : (
                    fp.year_pulse.stem_element_soft
                  )}{" "}
                  <span className="pcm-type-body" style={{ color: "var(--pcm-on-variant)" }}>
                    {tc("fact_year_pulse_em")}
                  </span>
                </div>
                <div className="pcm-chips" style={{ marginBottom: "0.25rem" }}>
                  {fp.year_pulse.links.length > 0 ? (
                    fp.year_pulse.links.map((c) => (
                      <PcmChip
                        key={c.soft}
                        soft={c.soft}
                        slug={c.slug}
                        locale={locale}
                        tone={
                          c.polarity === "green"
                            ? "cyan"
                            : c.polarity === "red"
                              ? "coral"
                              : "gold"
                        }
                      />
                    ))
                  ) : (
                    <span className="pcm-chip pcm-chip--neutral">{emptyLinks}</span>
                  )}
                </div>
                <FactYearRing
                  year={fp.year_pulse.year}
                  progress={transitProgress}
                  progressLabel={`${fp.year_pulse.year} ${tc("transit_progress")}`}
                />
              </div>

              <div className="pcm-card">
                <div className="pcm-label pcm-label--flush pcm-label--sand">
                  {tc("fact_structure")} · {tc("fact_structure_em")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <div className="pcm-type-body" style={{ marginBottom: "0.4rem" }}>
                      {tc("fact_bonds")}
                    </div>
                    <div className="pcm-chips">
                      {fp.structure.bonds.length > 0 ? (
                        fp.structure.bonds.map((c) => (
                          <PcmChip
                            key={`b-${c.soft}`}
                            soft={c.soft}
                            slug={c.slug}
                            locale={locale}
                            tone="cyan"
                          />
                        ))
                      ) : (
                        <span className="pcm-chip pcm-chip--neutral">{emptyLinks}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="pcm-type-body" style={{ marginBottom: "0.4rem" }}>
                      {tc("fact_tensions")}
                    </div>
                    <div className="pcm-chips">
                      {fp.structure.tensions.length > 0 ? (
                        fp.structure.tensions.map((c) => (
                          <PcmChip
                            key={`t-${c.soft}`}
                            soft={c.soft}
                            slug={c.slug}
                            locale={locale}
                            tone="coral"
                          />
                        ))
                      ) : (
                        <span className="pcm-chip pcm-chip--neutral">{emptyLinks}</span>
                      )}
                    </div>
                  </div>
                </div>
                <FactStructureGraph
                  bondCount={fp.structure.bonds.length}
                  tensionCount={fp.structure.tensions.length}
                  bondLabel={tc("fact_bonds")}
                  tensionLabel={tc("fact_tensions")}
                />
              </div>

              <div className="pcm-card">
                <div className="pcm-label pcm-label--flush pcm-label--coral">
                  {tc("fact_balance")} · {tc("fact_balance_em")}
                </div>
                <div className="pcm-type-lg" style={{ color: "#fff", marginBottom: "0.75rem" }}>
                  <SoftTermHover
                    slug={fp.balance.strength_slug}
                    locale={locale}
                    fallback={fp.balance.strength_soft}
                  />
                  {fp.balance.yong_soft ? (
                    <span className="pcm-type-body" style={{ color: "var(--pcm-on-variant)", marginLeft: "0.5rem" }}>
                      {tc("fact_anchor")}{" "}
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
                <div className="pcm-chips">
                  {fp.balance.xi.map((c) => (
                    <PcmChip
                      key={`xi-${c.soft}`}
                      soft={c.soft}
                      slug={c.slug}
                      locale={locale}
                      tone="cyan"
                    />
                  ))}
                  {fp.balance.ji.map((c) => (
                    <PcmChip
                      key={`ji-${c.soft}`}
                      soft={c.soft}
                      slug={c.slug}
                      locale={locale}
                      tone="coral"
                    />
                  ))}
                  {fp.balance.xi.length === 0 &&
                  fp.balance.ji.length === 0 &&
                  !fp.balance.yong_soft ? (
                    <span className="pcm-chip pcm-chip--neutral">{emptyLinks}</span>
                  ) : null}
                </div>
                <FactBalanceViz
                  strength={strength}
                  xiCount={fp.balance.xi.length}
                  jiCount={fp.balance.ji.length}
                  yongSoft={fp.balance.yong_soft}
                  weakLabel={tc("strength_weak")}
                  strongLabel={tc("strength_strong")}
                  xiLabel={tc("fact_viz_xi")}
                  jiLabel={tc("fact_viz_ji")}
                  anchorLabel={tc("fact_anchor")}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 5. Four pillars ── */}
        <section className="pcm__section">
          <div className="pcm-label pcm-label--white">
            {tc("layers_title")} · {tc("layers_em")}
          </div>
          <div className="pcm-pillars">
              {display.pillars.map((pl, idx) => {
                const keys = ["year", "month", "day", "hour"] as const;
                const key = keys[idx] ?? "year";
                const isDay = key === "day";
                const isLifeSegment = lifeSegmentPillar === key;
                // Day pillar role is always 本元/day_master (engine may send 日主/日元/本元).
                const roleSlug = isDay
                  ? "day_master"
                  : matrixTermSlug(pl.ten_god_han) ??
                    matrixTermSlug(pl.ten_god) ??
                    matrixTermSlug(pl.ten_god_en);
                const roleSoft = isDay
                  ? undefined
                  : isZh
                    ? pl.ten_god
                    : pl.ten_god_en;
                const stemSlug = pl.stem_element
                  ? elementToSlug(pl.stem_element)
                  : null;
                const stageHan = pl.life_stage_han?.trim() || null;
                const stageSlug = stageHan ? matrixTermSlug(stageHan) : null;
                const stageSoft =
                  pl.life_stage_label ||
                  (stageHan ? matrixSoftTerm(stageHan, locale) : "");
                const stars = resolveShenshaList(pl.star_labels, shenshaLocale);

                return (
                  <div
                    key={key}
                    className={`pcm-card pcm-pl pcm-pl--${key}${isLifeSegment ? " pcm-card--glow" : ""}`}
                  >
                    <div className="pcm-pl__slot">
                      <SoftTermHover slug={pillarSlotSlug(key)} locale={locale} />
                    </div>
                    <div className="pcm-pl__role">
                      {roleSlug ? (
                        <SoftTermHover
                          slug={roleSlug}
                          locale={locale}
                          fallback={roleSoft}
                        />
                      ) : (
                        roleSoft || "—"
                      )}
                    </div>
                    <div className={`pcm-pl__stem ${elementCssClass(pl.stem_element)}`}>
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
                    {stageSoft ? (
                      <div className="pcm-pl__branch">
                        {stageSlug ? (
                          <SoftTermHover
                            slug={stageSlug}
                            locale={locale}
                            fallback={stageSoft}
                          />
                        ) : (
                          stageSoft
                        )}
                      </div>
                    ) : null}
                    <div className="pcm-pl__hidden">{pl.hidden_display}</div>
                    {stars.length > 0 ? (
                      <ul className="pcm-pl__list">
                        {stars.map((star) => (
                          <li key={star.id}>{star.label}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </section>
      </div>
    </div>
  );
}
