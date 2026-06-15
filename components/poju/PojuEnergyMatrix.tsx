"use client";

import { useEffect, useMemo, useRef } from "react";

import { PojuDaYunDial } from "@/components/poju/PojuDaYunDial";
import { elementCssClass } from "@/lib/poju/bazi-matrix-mappings";
import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import "@/styles/poju-energy-matrix.css";

type Props = {
  payload: PojuMatrixPayload;
  locale: string;
  compact?: boolean;
};

const ELEMENT_CLASS: Record<string, string> = {
  Wood: "el-w",
  Fire: "el-f",
  Earth: "el-e",
  Metal: "el-m",
  Water: "el-water",
};

function renderRichText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i}>{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function formatBirthSubject(profile: PojuMatrixPayload["user_profile"], locale: string): string {
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ??
    profile.birth.tst_meta?.original_time ??
    "";
  const date = `${b.year} · ${pad(b.month)} · ${pad(b.day)}`;
  const loc = b.birth_location?.name ?? b.timezone;
  if (locale.startsWith("zh")) {
    return `生于 ${date}${time ? ` — ${time}` : ""} · ${loc}`;
  }
  return `BORN ${date}${time ? ` — ${time}` : ""} · ${loc}`;
}

function strengthLabel(strength: PojuMatrixPayload["strength"], locale: string): string {
  if (locale.startsWith("zh")) {
    if (strength === "strong") return "偏强";
    if (strength === "weak") return "偏弱";
    return "平衡";
  }
  if (strength === "strong") return "Dominant";
  if (strength === "weak") return "Receptive Core";
  return "Dynamic Balance";
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
          center: ["50%", "50%"],
          radius: "72%",
          startAngle: 90,
          splitNumber: 3,
          axisName: { color: "#c9c4dc", fontSize: 10.5 },
          splitLine: { lineStyle: { color: "rgba(255,255,255,0.13)" } },
          splitArea: { areaStyle: { color: ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.05)"] } },
          axisLine: { lineStyle: { color: "rgba(255, 255, 255, 0.15)" } },
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
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
    };
  }, [scores]);

  return <div className="pem-radar" ref={ref} aria-hidden />;
}

export function PojuEnergyMatrix({ payload, locale, compact = false }: Props) {
  const { structured, user_profile, wuxing_scores, strength, matrix_id } = payload;
  const zh = locale.startsWith("zh");

  const display = useMemo(
    () =>
      payload.display ??
      buildMatrixDisplayData({
        profile: user_profile,
        structured,
        strength,
        wuxing_scores,
        locale,
      }),
    [payload.display, user_profile, structured, strength, wuxing_scores, locale],
  );

  const maxCount = Math.max(...wuxing_scores.map((s) => s.count), 1);
  const sorted = [...wuxing_scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0];
  const deficit = sorted[sorted.length - 1];
  const tst = user_profile.tst_meta ?? user_profile.birth.tst_meta;

  const pillarLabels: Record<string, string> = {
    year: zh ? "年柱" : "Year",
    month: zh ? "月柱" : "Month",
    day: zh ? "日柱 · 日元" : "Day · Self",
    hour: zh ? "时柱" : "Hour",
  };

  return (
    <div className={`pem${compact ? " pem--compact" : ""}`}>
      <header className="pem__head">
        <div className="pem__eyebrow">{zh ? "时空对齐" : "Spatio-Temporal Alignment"}</div>
        <h2 className="pem__title">{zh ? "时空能量矩阵" : "The Space-Time Matrix"}</h2>
        <p className="pem__tag">
          {zh
            ? "基于出生坐标的能量结构快照，用于更清晰的决策。"
            : "A psycho-spatial alignment of your birth coordinates — for clearer decision-making."}
        </p>
        <div className="pem__subject">
          <span>{formatBirthSubject(user_profile, locale)}</span>
          <span>
            {zh ? "坐标" : "COORDINATES"} <b>{user_profile.birth.birth_location?.name ?? user_profile.birth.timezone}</b>
          </span>
          <span>
            {zh ? "矩阵 ID" : "MATRIX ID"} <b>{matrix_id}</b>
          </span>
        </div>
      </header>

      <section className="pem__device">
        <span className="pem__reg pem__reg--tl" />
        <span className="pem__reg pem__reg--tr" />
        <span className="pem__reg pem__reg--bl" />
        <span className="pem__reg pem__reg--br" />

        <div className="pem__dev-head">
          <div className="pem__dev-title">
            {zh ? "宇宙能量矩阵 · 实时读数" : "Cosmic Energy Matrix · Live Reading"}
          </div>
          <div className="pem__dev-id">{zh ? "引擎 v4 · 本地计算" : "ENGINE v4 · Local Compute"}</div>
        </div>

        {/* Top band: zodiac + calendar + TST + solar term */}
        <div className="pem__topband">
          <div className="pem__tcard pem__zsign">
            <div className="pem__zsign-art">
              <span>{display.zodiac.han || display.zodiac.branch}</span>
            </div>
            <div className="pem__zsign-en">{display.zodiac.en}</div>
            <div className="pem__zsign-cn">
              {display.zodiac.branch} · {display.zodiac.pinyin}
            </div>
            <div className="pem__zsign-tag">{zh ? "你的生肖 · Your Sign" : "Your Sign · 生肖"}</div>
            <div className="pem__zsign-note">{display.zodiac.note}</div>
          </div>

          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">
              {zh ? "历法对齐" : "Calendar Alignment"} <em>· {zh ? "历法" : "calendar"}</em>
            </div>
            <div className="pem__astro-v">
              {display.calendar.gregorian} <small>{zh ? "公历" : "Gregorian"}</small>
            </div>
            <div className="pem__astro-mid">{display.calendar.headline}</div>
            <div className="pem__astro-s">{display.calendar.lunar || display.calendar.mid}</div>
          </div>

          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">
              {zh ? "真太阳时校准" : "True Solar Time"} <em>· TST</em>
            </div>
            {tst ? (
              <>
                <div className="pem__tst">
                  <div className="pem__tst-col">
                    <div className="pem__tst-vv">{tst.original_time}</div>
                    <div className="pem__tst-kk">{zh ? "标准时" : "Standard"}</div>
                  </div>
                  <div className="pem__tst-arr">→</div>
                  <div className="pem__tst-col">
                    <div className="pem__tst-vv pem__tst-gold">{tst.true_solar_time}</div>
                    <div className="pem__tst-kk">{zh ? "真太阳时" : "True Solar"}</div>
                  </div>
                  {tst.diff_minutes !== 0 ? (
                    <div className="pem__tst-chip">
                      {tst.diff_minutes > 0 ? "+" : ""}
                      {tst.diff_minutes}m
                    </div>
                  ) : null}
                </div>
                <div className="pem__astro-s">
                  {zh ? "经度修正" : "Longitude correction"} · {tst.diff_minutes}m
                </div>
              </>
            ) : (
              <div className="pem__astro-v">—</div>
            )}
          </div>

          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">
              {zh ? "节气交接" : "Solar Term"} <em>· {zh ? "节气" : "jieqi"}</em>
            </div>
            <div className="pem__astro-v">
              {display.solar_term.name_en} <small>{display.solar_term.name}</small>
            </div>
            <div className="pem__astro-mid">{display.solar_term.season}</div>
            <div className="pem__astro-s">
              {zh ? "下一节气" : "Next"}: {display.solar_term.next_name}
            </div>
            <div className="pem__term">
              <i style={{ width: `${display.solar_term.progress_pct}%` }} />
            </div>
          </div>
        </div>

        {/* Block A: radar + elemental readouts */}
        <div className="pem__block pem__block--spread">
          <div className="pem__radarpanel">
            <div className="pem__panel-k">
              {zh ? "五行能量谱" : "Elemental Signature"} <em>· {zh ? "五行" : "wuxing"}</em>
            </div>
            <RadarChart scores={wuxing_scores} />
          </div>
          <div className="pem__side">
            <div className="pem__ro">
              <div className="pem__ro-k">{zh ? "五行分布" : "Elemental Breakdown"}</div>
              <div className="pem__elist">
                {wuxing_scores.map((row) => (
                  <div className="pem__erow" key={row.element}>
                    <span className={`pem__ename ${ELEMENT_CLASS[row.element] ?? ""}`}>{row.element}</span>
                    <span className="pem__ecn">{row.element_zh}</span>
                    <span className="pem__ebar">
                      <i
                        style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
                        className={`pem__ebar-fill pem__ebar-fill--${row.element.toLowerCase()}`}
                      />
                    </span>
                    <span className="pem__ecount">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="pem__enote">
                {zh ? "日主" : "Day Master"} <b>{display.day_master.en}</b>
                {zh ? "，生于" : ", born in"} {structured.pattern !== display.pattern_line ? display.pattern_line : display.day_master.element}
                {zh ? "月" : " month"} — {display.day_master.element}
                {zh ? "气" : " energy"}.
              </div>
            </div>
            <div className="pem__ro">
              <div className="pem__ro-k">{zh ? "核心活力" : "Core Vitality · Daymaster"}</div>
              <div className="pem__ro-v">{strengthLabel(strength, locale)}</div>
              <div className="pem__vtrack">
                <div className="pem__vtrack-mid" />
                <div className="pem__vtrack-pin" style={{ left: vitalityPin(strength) }} />
              </div>
              <div className="pem__vscale">
                <span>{zh ? "偏弱" : "Receptive"}</span>
                <span>{zh ? "平衡" : "Dynamic Balance"}</span>
                <span>{zh ? "偏强" : "Dominant"}</span>
              </div>
            </div>
            <div className="pem__ro">
              <div className="pem__ro-k">{zh ? "五行均衡" : "Elemental Equilibrium"}</div>
              <div className="pem__ro-v">
                <span className={ELEMENT_CLASS[dominant.element] ?? ""}>{dominant.element}</span>
                <span className="pem__pct">
                  {zh ? "盈余" : "Surplus"} · {dominant.pct}%
                </span>
              </div>
              <div className="pem__ro-tag pem__ro-tag--up">
                ▲ {zh ? "主导向量" : "Dominant vector"} · {dominant.element.toLowerCase()}
              </div>
              <div className="pem__ro-v pem__ro-v--gap">
                <span className={ELEMENT_CLASS[deficit.element] ?? ""}>{deficit.element}</span>
                <span className="pem__pct">
                  {zh ? "不足" : "Deficit"} · {deficit.pct}%
                </span>
              </div>
              <div className="pem__ro-tag pem__ro-tag--down">
                ▼ {zh ? "关键缺口" : "Key gap"} · {deficit.element.toLowerCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Block B: dayun dial + dynamics */}
        <div className="pem__block pem__block--fill">
          <div className="pem__dialpanel">
            <div className="pem__panel-k">
              {zh ? "大运能量场" : "Macro-Lifecycle Field"} <em>· {zh ? "大运" : "dayun"}</em>
            </div>
            <PojuDaYunDial
              daYun={structured.da_yun}
              currentIndex={display.current_dayun_index}
              hub={display.dayun_hub}
              currentAge={display.current_age}
              locale={locale}
            />
          </div>
          <div className="pem__side">
            <div className="pem__ro pem__ro--friction">
              <div className="pem__ro-k">{zh ? "结构动力学" : "Structural Dynamics"}</div>
              <div className="pem__fr">
                <span className="pem__fk pem__fk--res">RESONANCE</span>
                <span>{display.structural_dynamics.resonance}</span>
              </div>
              <div className="pem__fr">
                <span className="pem__fk pem__fk--ten">TENSION</span>
                <span>{display.structural_dynamics.tension}</span>
              </div>
              <div className="pem__fr">
                <span className="pem__fk pem__fk--neu">READING</span>
                <span>{display.structural_dynamics.reading}</span>
              </div>
            </div>
            <div className="pem__ro">
              <div className="pem__ro-k">
                {zh ? "流年" : "Annual Transit"} · {display.annual_transit.year}
              </div>
              <div className="pem__ro-v">
                <span className={elementCssClass(display.annual_transit.stem_en.split(" ")[1] ?? "")}>
                  {display.annual_transit.stem_en}
                </span>
                <span className="pem__pct pem__pct--block">
                  {display.annual_transit.ganzhi} · {display.annual_transit.pinyin}
                </span>
              </div>
              <p className="pem__transit-note">{display.annual_transit.narrative}</p>
              <div className="pem__tprog">
                <div className="pem__tprog-bar">
                  <i style={{ width: `${display.annual_transit.progress_pct}%` }} />
                </div>
                <div className="pem__tprog-lab">
                  <span>
                    {display.annual_transit.year} {zh ? "流年进度" : "Transit Progress"}
                  </span>
                  <span className="pem__tprog-blink">{display.annual_transit.progress_pct}% ▮</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Four pillars */}
        <div className="pem__pillars">
          {display.pillars.map((pl, idx) => {
            const keys = ["year", "month", "day", "hour"] as const;
            const key = keys[idx] ?? "year";
            const isDay = key === "day";
            return (
              <div key={key} className={`pem__pl${isDay ? " pem__pl--day" : ""}`}>
                <div className="pem__pl-cap">{pillarLabels[key]}</div>
                <div className="pem__pl-role">
                  {pl.ten_god_en}
                  <span className="pem__pl-role-cn">{pl.ten_god}</span>
                </div>
                <div className="pem__pl-stem">
                  <div className={`pem__pl-stem-en ${elementCssClass(pl.stem_element)}`}>{pl.stem_en}</div>
                  <div className="pem__pl-stem-sub">
                    <span className="pem__pl-seal">{pl.stem}</span>
                    <span className="pem__pl-pin">{pl.stem_pinyin}</span>
                  </div>
                </div>
                <div className="pem__pl-branch">
                  <div className="pem__pl-branch-en">{pl.branch_en}</div>
                  <div className="pem__pl-branch-sub">
                    {pl.branch} {pl.branch_pinyin}
                  </div>
                </div>
                <div className="pem__pl-meta">
                  {pl.hidden_display}
                  {pl.star_label ? (
                    <>
                      <br />
                      <span className="pem__pl-star">{pl.star_label}</span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Synopsis */}
        <div className="pem__below">
          <div className="pem__sectitle">
            <span className="pem__sectitle-no">›</span>
            <span className="pem__sectitle-en">{zh ? "能量读数摘要" : "The Synopsis"}</span>
            <span className="pem__sectitle-s">{zh ? "免费预览" : "Energetic read-out · free preview"}</span>
          </div>
          <div className="pem__synopsis">
            <div className="pem__syn">
              <div className="pem__syn-no">A · {zh ? "原型" : "The Archetype"}</div>
              <div className="pem__syn-t">{zh ? "结构上的你是谁" : "Who you are, structurally"}</div>
              <div className="pem__syn-body">{renderRichText(display.synopsis.archetype)}</div>
            </div>
            <div className="pem__syn">
              <div className="pem__syn-no">B · {zh ? "核心张力" : "The Core Friction"}</div>
              <div className="pem__syn-t">{zh ? "正在作用的张力" : "The tension in play"}</div>
              <div className="pem__syn-body">{renderRichText(display.synopsis.friction)}</div>
            </div>
            <div className="pem__syn pem__syn--locked">
              <div className="pem__syn-no">C · {zh ? "催化剂" : "The Catalyst"}</div>
              <div className="pem__syn-t">{zh ? "POJU 开场解读" : "POJU's opening read"}</div>
              <div className="pem__syn-body">
                {zh
                  ? "这一对齐揭示了为何选择像压力锅一样——解锁后，我会顺着你的问题把它拆到底。"
                  : "This alignment reveals why the choice feels like a pressure cooker. Your preparation is complete, but the gateway needs a specific key to open without burnout…"}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
