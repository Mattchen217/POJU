"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";

import { PojuDaYunDial } from "@/components/poju/PojuDaYunDial";
import pojuAvatar from "@/assets/icons/P.png";
import { elementCssClass } from "@/lib/poju/bazi-matrix-mappings";
import { buildMatrixDisplayData } from "@/lib/poju/build-matrix-display";
import type { PojuMatrixPayload } from "@/lib/poju/build-matrix-payload";
import type { UserProfile } from "@/lib/profile/types";
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

const ELEMENT_BAR_CLASS: Record<string, string> = {
  Wood: "ebar-fill--wood",
  Fire: "ebar-fill--fire",
  Earth: "ebar-fill--earth",
  Metal: "ebar-fill--metal",
  Water: "ebar-fill--water",
};

function renderRichText(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <b key={i}>{part}</b> : <span key={i}>{part}</span>,
  );
}

function formatBornLine(profile: UserProfile): string {
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const time =
    profile.tst_meta?.original_time ??
    profile.birth.tst_meta?.original_time ??
    "";
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
  return profile.birth.timezone || (locale.startsWith("zh") ? "默认时区" : "Default timezone");
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
          axisName: { color: "#c9c4dc", fontSize: 10.5, fontFamily: "Inter" },
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
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      chart?.dispose();
    };
  }, [scores]);

  return <div className="radar" ref={ref} aria-hidden />;
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

  const synopsisPrompt =
    display.synopsis.prompt ??
    (zh
      ? "把你反复掂量、又迟迟定不下来的那个问题告诉我——发在下面，我会结合你的命盘，和你一步步拆开。"
      : "Tell me the question or dilemma you keep weighing and cannot settle — share it below, and I'll walk through it with you, grounded in your chart.");

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
      <header className="rhead">
        <div className="eyebrow">{zh ? "时空对齐" : "Spatio-Temporal Alignment"}</div>
        <h2>{zh ? "时空能量矩阵" : "The Space-Time Matrix"}</h2>
        <p className="tag">
          {zh
            ? "基于出生坐标的能量结构快照，用于更清晰的决策。"
            : "A psycho-spatial alignment of your birth coordinates — for clearer decision-making."}
        </p>
        <div className="subject">
          <span>
            {zh ? "生于" : "BORN"} <b>{formatBornLine(user_profile)}</b>
          </span>
          <span>
            {zh ? "坐标" : "COORDINATES"} <b>{formatCoordinates(user_profile, locale)}</b>
          </span>
          <span>
            {zh ? "矩阵 ID" : "MATRIX ID"} <b>{matrix_id}</b>
          </span>
        </div>
      </header>

      <section className="device">
        <span className="reg tl" />
        <span className="reg tr" />
        <span className="reg bl" />
        <span className="reg br" />

        <div className="dev-head">
          <div className="t">{zh ? "宇宙能量矩阵 · 实时读数" : "Cosmic Energy Matrix · Live Reading"}</div>
          <div className="id">{zh ? "引擎 v4 · 本地计算" : "ENGINE v4 · Local Compute"}</div>
        </div>

        <div className="topband">
          <div className="tcard zsign">
            <div className="zsign__art">
              <span>{display.zodiac.han || display.zodiac.branch}</span>
            </div>
            <div className="zsign__en">{display.zodiac.en}</div>
            <div className="zsign__cn">
              {display.zodiac.branch} · {display.zodiac.pinyin}
            </div>
            <div className="zsign__tag">{zh ? "你的生肖 · Your Sign" : "Your Sign · 生肖"}</div>
            <div className="zsign__note">{display.zodiac.note}</div>
          </div>

          <div className="tcard a">
            <div className="k">
              <span className="bull" />
              {zh ? "历法对齐" : "Calendar Alignment"} <em>· {zh ? "历法对齐" : "calendar"}</em>
            </div>
            <div className="v">
              {display.calendar.gregorian} <small>{zh ? "公历" : "Gregorian"}</small>
            </div>
            <div className="mid">{display.calendar.headline}</div>
            <div className="s">{display.calendar.lunar || display.calendar.mid}</div>
          </div>

          <div className="tcard a">
            <div className="k">
              <span className="bull" />
              {zh ? "真太阳时校准" : "True Solar Time"} <em>· {zh ? "真太阳时校准" : "TST"}</em>
            </div>
            {tst ? (
              <>
                <div className="tst">
                  <div className="t">
                    <div className="vv">{tst.original_time}</div>
                    <div className="kk">{zh ? "标准时" : "Standard"}</div>
                  </div>
                  <div className="arr">→</div>
                  <div className="t">
                    <div className="vv gold">{tst.true_solar_time}</div>
                    <div className="kk">{zh ? "真太阳时" : "True Solar"}</div>
                  </div>
                  {tst.diff_minutes !== 0 ? (
                    <div className="chip">
                      {tst.diff_minutes > 0 ? "+" : "−"}
                      {Math.abs(tst.diff_minutes)}m
                    </div>
                  ) : null}
                </div>
                <div className="s">
                  {zh ? "经度修正" : "Longitude correction"} · {tst.diff_minutes}m
                </div>
              </>
            ) : (
              <div className="v">—</div>
            )}
          </div>

          <div className="tcard a">
            <div className="k">
              <span className="bull" />
              {zh ? "节气交接" : "Solar Term"} <em>· {zh ? "节气" : "jieqi"}</em>
            </div>
            <div className="v">
              {display.solar_term.name_en} <small>{display.solar_term.name}</small>
            </div>
            <div className="mid">{display.solar_term.season}</div>
            <div className="s">
              {zh ? "下一节气" : "Next"}: {display.solar_term.next_name}
            </div>
            <div className="term">
              <i style={{ width: `${display.solar_term.progress_pct}%` }} />
            </div>
          </div>
        </div>

        <div className="block block--spread">
          <div className="radarpanel">
            <div className="rp__k">
              {zh ? "五行能量谱" : "Elemental Signature"} <em>· {zh ? "五行" : "wuxing"}</em>
            </div>
            <RadarChart scores={wuxing_scores} />
          </div>
          <div className="side">
            <div className="ro">
              <div className="ro__k">{zh ? "五行分布" : "Elemental Breakdown · 五行分布"}</div>
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
              <div className="enote">
                {zh ? "日主" : "Day Master"} <b>{display.day_master.en}</b>
                {zh ? "，五行以" : ", with "}
                <b>{dominant?.element}</b>
                {zh ? "偏盛、" : " surplus and "}
                <b>{deficit?.element}</b>
                {zh ? "偏薄——这是当前能量场的主线。" : " deficit — the main line in your field right now."}
              </div>
            </div>
            <div className="ro">
              <div className="ro__k">{zh ? "核心活力" : "Core Vitality · Daymaster"}</div>
              <div className="ro__v">{strengthLabel(strength, locale)}</div>
              <div className="vtrack">
                <div className="mid" />
                <div className="pin" style={{ left: vitalityPin(strength) }} />
              </div>
              <div className="vscale">
                <span>{zh ? "偏弱" : "Receptive"}</span>
                <span>{zh ? "平衡" : "Dynamic Balance"}</span>
                <span>{zh ? "偏强" : "Dominant"}</span>
              </div>
            </div>
            <div className="ro">
              <div className="ro__k">{zh ? "五行均衡" : "Elemental Equilibrium"}</div>
              {dominant ? (
                <>
                  <div className="ro__v">
                    <span className={ELEMENT_CLASS[dominant.element] ?? ""}>{dominant.element}</span>
                    <span className="pct">
                      {zh ? "盈余" : "Surplus"} · {dominant.pct}%
                    </span>
                  </div>
                  <div className="ro__tag up">
                    ▲ {zh ? "主导向量" : "Dominant vector"} · {dominant.element.toLowerCase()}
                  </div>
                </>
              ) : null}
              {deficit ? (
                <>
                  <div className="ro__v" style={{ marginTop: 12 }}>
                    <span className={ELEMENT_CLASS[deficit.element] ?? ""}>{deficit.element}</span>
                    <span className="pct">
                      {zh ? "不足" : "Deficit"} · {deficit.pct}%
                    </span>
                  </div>
                  <div className="ro__tag down">
                    ▼ {zh ? "关键缺口" : "Key gap"} · {deficit.element.toLowerCase()}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="block block--fill">
          <div className="dialpanel">
            <div className="rp__k">
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
          <div className="side">
            <div className="ro ro__friction">
              <div className="ro__k">{zh ? "结构动力学" : "Structural Dynamics"}</div>
              <div className="fr">
                <span className="fk res">RESONANCE</span>
                <span>{display.structural_dynamics.resonance}</span>
              </div>
              <div className="fr">
                <span className="fk ten">TENSION</span>
                <span>{display.structural_dynamics.tension}</span>
              </div>
              <div className="fr">
                <span className="fk neu">READING</span>
                <span>{display.structural_dynamics.reading}</span>
              </div>
            </div>
            <div className="ro">
              <div className="ro__k">
                {zh ? "流年" : "Annual Transit"} · {display.annual_transit.year}
              </div>
              <div className="ro__v">
                <span className={elementCssClass(display.annual_transit.stem_en.split(" ")[1] ?? "")}>
                  {display.annual_transit.stem_en}
                </span>
                <span className="pct" style={{ flexBasis: "100%" }}>
                  {display.annual_transit.ganzhi} · {display.annual_transit.pinyin}
                </span>
              </div>
              <p className="transit-note">{display.annual_transit.narrative}</p>
              <div className="tprog">
                <div className="tprog__bar">
                  <i style={{ width: `${display.annual_transit.progress_pct}%` }} />
                </div>
                <div className="tprog__lab">
                  <span>
                    {display.annual_transit.year} {zh ? "流年进度" : "Transit Progress"}
                  </span>
                  <span className="blink">{display.annual_transit.progress_pct}% ▮</span>
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
            return (
              <div key={key} className={`pl${isDay ? " day" : ""}`}>
                <div className="cap">{pillarLabels[key]}</div>
                <div className="role" style={isDay ? { color: "var(--gold-soft)" } : undefined}>
                  {pl.ten_god_en}
                  <span className="cn">{pl.ten_god}</span>
                </div>
                <div className="stem">
                  <div className={`en ${elementCssClass(pl.stem_element)}`}>{pl.stem_en}</div>
                  <div className="sub">
                    <span className="seal">{pl.stem}</span>
                    <span className="pin">{pl.stem_pinyin}</span>
                  </div>
                </div>
                <div className="branch">
                  <div className="en">{pl.branch_en}</div>
                  <div className="sub">
                    {pl.branch} {pl.branch_pinyin}
                  </div>
                </div>
                <div className="meta">
                  {pl.hidden_display}
                  {pl.star_label ? (
                    <>
                      <br />
                      <span className="star">{pl.star_label}</span>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="below">
        <div className="pojumsg">
          <div className="pojumsg__avatar">
            <Image src={pojuAvatar} alt="POJU" width={40} height={40} />
          </div>
          <div className="pojumsg__body">
            <div className="pojumsg__who">POJU</div>
            <div className="pojumsg__bubble">
              <p>{renderRichText(display.synopsis.archetype)}</p>
              <p>{renderRichText(display.synopsis.friction)}</p>
              <p className="ask">{synopsisPrompt}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
