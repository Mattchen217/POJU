"use client";

import { useMemo } from "react";

import { DA_YUN_THEMES } from "@/lib/poju/bazi-matrix-mappings";
import type { DaYunEntry } from "@/lib/calculations/lunar-dayun";

type Props = {
  daYun: DaYunEntry[];
  currentIndex: number;
  hub: { theme: string; age_range: string; start_year: number };
  currentAge: number;
  locale: string;
};

const CX = 210;
const CY = 210;
const R_IN = 82;
const R_OUT = 196;
const R_LABEL = 140;
const DEG = Math.PI / 180;

function polar(r: number, angleDeg: number): [number, number] {
  const a = angleDeg * DEG;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function sectorPath(startDeg: number, endDeg: number, rOut: number): string {
  const gap = 1.2;
  const a0 = startDeg + gap;
  const a1 = endDeg - gap;
  const p1 = polar(R_IN, a0);
  const p2 = polar(rOut, a0);
  const p3 = polar(rOut, a1);
  const p4 = polar(R_IN, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${p1[0]} ${p1[1]}`,
    `L ${p2[0]} ${p2[1]}`,
    `A ${rOut} ${rOut} 0 ${large} 1 ${p3[0]} ${p3[1]}`,
    `L ${p4[0]} ${p4[1]}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${p1[0]} ${p1[1]}`,
    "Z",
  ].join(" ");
}

function ageLabel(entry: DaYunEntry, next: DaYunEntry | undefined): string {
  const end = next ? next.start_age - 1 : entry.start_age + 9;
  return `${entry.start_age}–${end}`;
}

export function PojuDaYunDial({ daYun, currentIndex, hub, currentAge, locale }: Props) {
  const phases = useMemo(() => {
    const list = daYun.slice(0, 8);
    return list.map((entry, i) => ({
      entry,
      next: list[i + 1],
      theme: DA_YUN_THEMES[i] ?? DA_YUN_THEMES[0],
      isNow: i === currentIndex,
    }));
  }, [daYun, currentIndex]);

  const zh = locale.startsWith("zh");

  return (
    <div className="dial">
      <svg viewBox="0 0 420 420" aria-hidden>
        <circle cx={CX} cy={CY} r={R_IN - 1} fill="rgba(10,8,18,0.55)" />
        <circle cx={CX} cy={CY} r={R_IN} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={R_OUT} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
        <circle
          cx={CX}
          cy={CY}
          r={(R_IN + R_OUT) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        {phases.map((phase, i) => {
          const center = -90 + i * 45;
          const start = center - 22.5;
          const end = center + 22.5;
          const rOut = phase.isNow ? R_OUT + 8 : R_OUT;
          return (
            <path
              key={`${phase.entry.ganzhi}-${i}`}
              d={sectorPath(start, end, rOut)}
              fill={phase.isNow ? "rgba(227,192,105,0.18)" : "rgba(255,255,255,0.025)"}
              stroke={phase.isNow ? "rgba(244,212,147,0.7)" : "rgba(255,255,255,0.08)"}
              strokeWidth={phase.isNow ? 1.6 : 1}
              className={phase.isNow ? "dial-seg--now" : undefined}
            />
          );
        })}
      </svg>

      {phases.map((phase, i) => {
        const center = -90 + i * 45;
        const lp = polar(phase.isNow ? R_LABEL + 4 : R_LABEL, center);
        const leftPct = (lp[0] / 420) * 100;
        const topPct = (lp[1] / 420) * 100;
        return (
          <div
            key={`label-${i}`}
            className={`phase${phase.isNow ? " now" : ""}`}
            style={{ left: `${leftPct}%`, top: `${topPct}%` }}
          >
            <div className="age">{ageLabel(phase.entry, phase.next)}</div>
            <div className="theme">{phase.theme}</div>
            <div className="gz">{phase.entry.ganzhi}</div>
            {phase.isNow ? (
              <div className="nowtag">{zh ? "当前大运" : "Current decade"}</div>
            ) : null}
          </div>
        );
      })}

      <div className="dialhub dm">
        <div className="hubtag">{zh ? "◆ 你在此" : "◆ You Are Here"}</div>
        <div className="hubage">{zh ? `年龄 ${currentAge}` : `Age ${currentAge}`}</div>
        <div className="hubphase">{hub.theme}</div>
        <div className="hubsub">
          {zh ? "大运" : "Decade"} {hub.age_range} · {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
