"use client";

import { useEffect, useRef } from "react";
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

function formatBirthLine(profile: PojuMatrixPayload["user_profile"], locale: string): string {
  const b = profile.birth;
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${b.year} · ${pad(b.month)} · ${pad(b.day)}`;
  const loc = b.birth_location?.name ?? b.timezone;
  if (locale.startsWith("zh")) {
    return `生于 ${date} · ${loc}`;
  }
  return `Born ${date} · ${loc}`;
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

  return <div className="pem-radar" ref={ref} aria-hidden />;
}

export function PojuEnergyMatrix({ payload, locale, compact = false }: Props) {
  const { structured, user_profile, wuxing_scores, strength, day_master_en, matrix_id } = payload;
  const maxCount = Math.max(...wuxing_scores.map((s) => s.count), 1);
  const sorted = [...wuxing_scores].sort((a, b) => b.pct - a.pct);
  const dominant = sorted[0];
  const deficit = sorted[sorted.length - 1];
  const pillars = [
    { key: "year", label: locale.startsWith("zh") ? "年柱" : "Year", value: structured.four_pillars.year },
    { key: "month", label: locale.startsWith("zh") ? "月柱" : "Month", value: structured.four_pillars.month },
    { key: "day", label: locale.startsWith("zh") ? "日柱" : "Day", value: structured.four_pillars.day, highlight: true },
    { key: "hour", label: locale.startsWith("zh") ? "时柱" : "Hour", value: structured.four_pillars.hour },
  ];
  const currentDaYun = (() => {
    const birthYear = user_profile.birth.year;
    const age = new Date().getFullYear() - birthYear;
    const list = structured.da_yun;
    if (!list.length) return null;
    const idx = list.findIndex((d, i) => {
      const next = list[i + 1];
      return age >= d.start_age && (!next || age < next.start_age);
    });
    return idx >= 0 ? list[idx] : list[list.length - 1];
  })();

  return (
    <div className={`pem${compact ? " pem--compact" : ""}`}>
      <header className="pem__head">
        <div className="pem__eyebrow">{locale.startsWith("zh") ? "时空对齐" : "Spatio-Temporal Alignment"}</div>
        <h2 className="pem__title">{locale.startsWith("zh") ? "时空能量矩阵" : "The Space-Time Matrix"}</h2>
        <p className="pem__tag">
          {locale.startsWith("zh")
            ? "基于出生坐标的能量结构快照，用于更清晰的决策。"
            : "A psycho-spatial alignment of your birth coordinates — for clearer decision-making."}
        </p>
        <div className="pem__subject">
          <span>{formatBirthLine(user_profile, locale)}</span>
          <span>
            {locale.startsWith("zh") ? "矩阵 ID" : "MATRIX ID"} <b>{matrix_id}</b>
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
            {locale.startsWith("zh") ? "宇宙能量矩阵 · 实时读数" : "Cosmic Energy Matrix · Live Reading"}
          </div>
          <div className="pem__dev-id">{locale.startsWith("zh") ? "引擎 v4 · 本地计算" : "ENGINE v4 · Local Compute"}</div>
        </div>

        <div className="pem__topband">
          <div className="pem__tcard pem__zsign">
            <div className="pem__zsign-art">
              <span>{user_profile.bazi.yearPillar.slice(0, 1)}</span>
            </div>
            <div className="pem__zsign-en">{day_master_en}</div>
            <div className="pem__zsign-cn">{structured.day_master}</div>
            <div className="pem__zsign-tag">{locale.startsWith("zh") ? "日主 · Day Master" : "Day Master · 日主"}</div>
          </div>
          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">{locale.startsWith("zh") ? "格局" : "Pattern"}</div>
            <div className="pem__astro-v">{structured.pattern}</div>
            <div className="pem__astro-mid">{user_profile.diagnosis.patternSummary}</div>
          </div>
          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">{locale.startsWith("zh") ? "真太阳时" : "True Solar Time"}</div>
            {user_profile.tst_meta || user_profile.birth.tst_meta ? (
              <div className="pem__tst">
                <span>{user_profile.birth.tst_meta?.original_time ?? "—"}</span>
                <span className="pem__tst-arr">→</span>
                <span className="pem__tst-gold">
                  {user_profile.tst_meta?.true_solar_time ?? user_profile.birth.tst_meta?.true_solar_time ?? "—"}
                </span>
              </div>
            ) : (
              <div className="pem__astro-v">—</div>
            )}
          </div>
          <div className="pem__tcard pem__astro">
            <div className="pem__astro-k">{locale.startsWith("zh") ? "用神" : "Favorable"}</div>
            <div className="pem__astro-v">{structured.yong_shen || structured.xi_shen.join(" · ") || "—"}</div>
          </div>
        </div>

        <div className="pem__block">
          <div className="pem__radarpanel">
            <div className="pem__panel-k">
              {locale.startsWith("zh") ? "五行能量谱" : "Elemental Signature"}
            </div>
            <RadarChart scores={wuxing_scores} />
          </div>
          <div className="pem__side">
            <div className="pem__ro">
              <div className="pem__ro-k">{locale.startsWith("zh") ? "五行分布" : "Elemental Breakdown"}</div>
              <div className="pem__elist">
                {wuxing_scores.map((row) => (
                  <div className="pem__erow" key={row.element}>
                    <span className={`pem__ename ${ELEMENT_CLASS[row.element] ?? ""}`}>{row.element}</span>
                    <span className="pem__ecn">{row.element_zh}</span>
                    <span className="pem__ebar">
                      <i
                        style={{
                          width: `${Math.round((row.count / maxCount) * 100)}%`,
                        }}
                        className={`pem__ebar-fill pem__ebar-fill--${row.element.toLowerCase()}`}
                      />
                    </span>
                    <span className="pem__ecount">{row.count}</span>
                  </div>
                ))}
              </div>
              <div className="pem__enote">
                {locale.startsWith("zh") ? "日主" : "Day Master"} <b>{day_master_en}</b> · {structured.pattern}
              </div>
            </div>
            <div className="pem__ro">
              <div className="pem__ro-k">{locale.startsWith("zh") ? "核心 vitality" : "Core Vitality"}</div>
              <div className="pem__ro-v">{strengthLabel(strength, locale)}</div>
              <div className="pem__vtrack">
                <div className="pem__vtrack-mid" />
                <div className="pem__vtrack-pin" style={{ left: vitalityPin(strength) }} />
              </div>
            </div>
            <div className="pem__ro">
              <div className="pem__ro-k">{locale.startsWith("zh") ? "五行均衡" : "Elemental Equilibrium"}</div>
              <div className="pem__ro-v">
                <span className={ELEMENT_CLASS[dominant.element] ?? ""}>{dominant.element}</span>
                <span className="pem__pct">
                  {locale.startsWith("zh") ? "盈余" : "Surplus"} · {dominant.pct}%
                </span>
              </div>
              <div className="pem__ro-v pem__ro-v--gap">
                <span className={ELEMENT_CLASS[deficit.element] ?? ""}>{deficit.element}</span>
                <span className="pem__pct">
                  {locale.startsWith("zh") ? "不足" : "Deficit"} · {deficit.pct}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {currentDaYun ? (
          <div className="pem__dayun">
            <div className="pem__ro-k">{locale.startsWith("zh") ? "当前大运" : "Current Macro-Lifecycle"}</div>
            <div className="pem__ro-v">
              {currentDaYun.ganzhi} · {locale.startsWith("zh") ? "起运" : "from age"} {currentDaYun.start_age}
            </div>
          </div>
        ) : null}

        <div className="pem__pillars">
          {pillars.map((pl) => (
            <div key={pl.key} className={`pem__pl${pl.highlight ? " pem__pl--day" : ""}`}>
              <div className="pem__pl-cap">{pl.label}</div>
              <div className="pem__pl-stem">{pl.value}</div>
            </div>
          ))}
        </div>

        <div className="pem__synopsis">
          <div className="pem__syn">
            <div className="pem__syn-no">A · {locale.startsWith("zh") ? "原型" : "The Archetype"}</div>
            <div className="pem__syn-t">{locale.startsWith("zh") ? "结构上的你是谁" : "Who you are, structurally"}</div>
            <div className="pem__syn-body">{user_profile.diagnosis.patternSummary}</div>
          </div>
          <div className="pem__syn">
            <div className="pem__syn-no">B · {locale.startsWith("zh") ? "核心张力" : "The Core Friction"}</div>
            <div className="pem__syn-t">{locale.startsWith("zh") ? "正在作用的张力" : "The tension in play"}</div>
            <div className="pem__syn-body">
              {user_profile.diagnosis.challengingElements.length > 0
                ? `${locale.startsWith("zh") ? "挑战元素" : "Challenging elements"}: ${user_profile.diagnosis.challengingElements.join(", ")}`
                : structured.ji_shen.join(" · ") || "—"}
            </div>
          </div>
          <div className="pem__syn pem__syn--locked">
            <div className="pem__syn-no">C · {locale.startsWith("zh") ? "催化剂" : "The Catalyst"}</div>
            <div className="pem__syn-t">{locale.startsWith("zh") ? "POJU 开场解读" : "POJU's opening read"}</div>
            <div className="pem__syn-body">
              {locale.startsWith("zh")
                ? "这一对齐揭示了为何选择像压力锅一样——解锁后，我会顺着你的问题把它拆到底。"
                : "This alignment reveals why the choice feels like a pressure cooker — unlock to work through it with POJU."}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
