"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";

import { DsFlowStepRow, type FlowStep } from "@/components/ds/marketing/DsFlowStepRow";
import { SyncroDirectionLabels } from "@/components/syncro/SyncroDirectionLabels";
import { SyncroMarketingOrientationProvider } from "@/components/syncro/SyncroMarketingOrientationProvider";
import { SyncroParticleCore } from "@/components/syncro/SyncroParticleCore";
import { useOrientation } from "@/components/syncro/SyncroOrientationProvider";
import { SYNCRO_LABEL_RADIUS, SYNCRO_RING_SIZE } from "@/lib/syncro/syncro-ring-layout";

import "@/styles/syncro-compass.css";

/** One full 8-direction scan — slower for readability */
const PERIOD_MS = 14_400;
const RING_SIZE = 268;
const LABEL_RADIUS = Math.round(SYNCRO_LABEL_RADIUS * (RING_SIZE / SYNCRO_RING_SIZE));
const DIRECTION_IDS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

const CURRENT_KEYS = ["open", "following", "still", "cross", "under"] as const;
const CURRENT_COLORS: Record<(typeof CURRENT_KEYS)[number], string> = {
  open: "#00D9B8",
  following: "#4ECDC4",
  still: "#8A8AA0",
  cross: "#E89F4D",
  under: "#C85A5A",
};

/** Map 8 scan sectors → 5 center labels (spread across full rotation) */
const CURRENT_BY_DIR = [0, 0, 1, 1, 2, 3, 3, 4] as const;

function parseCurrentLabel(rawName: string, locale: string): string {
  const parts = rawName.split("·").map((p) => p.trim());
  if (locale.startsWith("zh")) return parts[1] || parts[0] || rawName;
  return parts[0] || rawName;
}

/** Radar overlay scale — particle spline stays at RING_SIZE */
const RADAR_SCALE = 1.22;

/** Pointer geometry — tip stays inset from labels; inner end near center hub */
const HUB_RADIUS_PX = 30;
const POINTER_INNER_PX = 14;
const POINTER_TIP_INSET_PX = 28;
const SWEEP_DEG = 46;

const TEAL = "34,211,238";
const TEAL_BRIGHT = "165,243,252";

const CURRENT_RGB: Record<(typeof CURRENT_KEYS)[number], string> = {
  open: "0,217,184",
  following: "78,205,196",
  still: "138,138,160",
  cross: "232,159,77",
  under: "200,90,90",
};

function sectorAngles(dirIdx: number) {
  const centerDeg = dirIdx * 45;
  const halfRad = (22.5 * Math.PI) / 180;
  const centerRad = ((centerDeg - 90) * Math.PI) / 180;
  return { start: centerRad - halfRad, end: centerRad + halfRad, centerRad };
}

function fillSector(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  dirIdx: number,
  rgb: string,
  alpha: number,
) {
  const { start, end } = sectorAngles(dirIdx);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, outerR, start, end);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.fill();

  ctx.globalCompositeOperation = "lighter";
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(start) * innerR, cy + Math.sin(start) * innerR);
  ctx.arc(cx, cy, outerR, start, end);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb},${alpha * 0.35})`;
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

function drawRadarFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scanDegNow: number,
  dirIdx: number,
) {
  const scale = Math.min(w, h) / RING_SIZE;
  const cx = w / 2;
  const cy = h / 2;
  const labelR = LABEL_RADIUS * scale;
  const hubR = HUB_RADIUS_PX * scale;
  const innerR = Math.max(hubR + 4 * scale, POINTER_INNER_PX * scale);
  const tipR = Math.max(innerR + 10 * scale, labelR - POINTER_TIP_INSET_PX * scale);
  const scanRad = ((scanDegNow - 90) * Math.PI) / 180;
  const sweepRad = (SWEEP_DEG * Math.PI) / 180;

  ctx.clearRect(0, 0, w, h);

  /* —— Grid: concentric rings —— */
  ctx.globalCompositeOperation = "source-over";
  const ringFracs = [0.38, 0.62, 0.88];
  for (const frac of ringFracs) {
    ctx.beginPath();
    ctx.arc(cx, cy, labelR * frac, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${TEAL},0.16)`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${TEAL},0.28)`;
  ctx.lineWidth = 1.25;
  ctx.stroke();

  /* —— Tick marks on outer ring —— */
  for (let i = 0; i < 32; i++) {
    const a = ((i * 11.25 - 90) * Math.PI) / 180;
    const major = i % 4 === 0;
    const inner = labelR - (major ? 10 : 5) * scale;
    const outer = labelR + (major ? 4 : 2) * scale;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.strokeStyle = major ? `rgba(${TEAL},0.35)` : `rgba(${TEAL},0.14)`;
    ctx.lineWidth = major ? 1.25 : 0.75;
    ctx.stroke();
  }

  /* —— Sector highlights (scanned regions) —— */
  for (let i = 0; i < dirIdx; i++) {
    const key = CURRENT_KEYS[CURRENT_BY_DIR[i] ?? 0];
    fillSector(ctx, cx, cy, hubR, tipR, i, CURRENT_RGB[key], 0.14);
  }
  {
    const activeKey = CURRENT_KEYS[CURRENT_BY_DIR[dirIdx] ?? 0];
    fillSector(ctx, cx, cy, hubR, tipR, dirIdx, CURRENT_RGB[activeKey], 0.32);
  }

  /* —— Subtle sector dividers (no hub spokes — avoids duplicate pointer) —— */
  for (let i = 0; i < 8; i++) {
    const { start } = sectorAngles(i);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(start) * hubR, cy + Math.sin(start) * hubR);
    ctx.lineTo(cx + Math.cos(start) * labelR, cy + Math.sin(start) * labelR);
    ctx.strokeStyle = `rgba(${TEAL},0.1)`;
    ctx.lineWidth = 0.75;
    ctx.stroke();
  }

  /* —— Center hub ring (transparent — text sits over particle field) —— */
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${TEAL},0.28)`;
  ctx.lineWidth = 1;
  ctx.stroke();

  /* —— Phosphor sweep trail (~45°) —— */
  const sweepSteps = 28;
  for (let s = 0; s < sweepSteps; s++) {
    const t1 = scanRad - (sweepRad * s) / sweepSteps;
    const t0 = scanRad - (sweepRad * (s + 1)) / sweepSteps;
    const fade = 1 - s / sweepSteps;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, tipR, t0, t1);
    ctx.closePath();
    ctx.fillStyle = `rgba(${TEAL},${0.2 * fade * fade})`;
    ctx.fill();
  }

  ctx.globalCompositeOperation = "lighter";
  for (let s = 0; s < 8; s++) {
    const t1 = scanRad - (sweepRad * s) / 8;
    const t0 = scanRad - (sweepRad * (s + 1)) / 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, tipR, t0, t1);
    ctx.closePath();
    ctx.fillStyle = `rgba(${TEAL_BRIGHT},${0.08 * (1 - s / 8)})`;
    ctx.fill();
  }

  /* —— Scan beam (bright leading edge) —— */
  const ix = cx + Math.cos(scanRad) * innerR;
  const iy = cy + Math.sin(scanRad) * innerR;
  const hx = cx + Math.cos(scanRad) * tipR;
  const hy = cy + Math.sin(scanRad) * tipR;

  ctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.shadowColor = `rgba(${TEAL_BRIGHT},0.95)`;
  ctx.shadowBlur = 14 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.85)";
  ctx.shadowBlur = 10 * scale;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2 * scale;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ix, iy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.restore();

  ctx.globalCompositeOperation = "lighter";
  const headGlow = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18 * scale);
  headGlow.addColorStop(0, "rgba(255,255,255,0.95)");
  headGlow.addColorStop(0.35, `rgba(${TEAL_BRIGHT},0.55)`);
  headGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = headGlow;
  ctx.beginPath();
  ctx.arc(hx, hy, 18 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(hx, hy, 4.5 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(${TEAL_BRIGHT},0.6)`;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function directionIndexFromPhase(phase: number): number {
  return Math.floor(phase * 8) % 8;
}

/** Continuous scan angle — lands on each direction center when highlight switches */
function scanDegFromPhase(phase: number): number {
  return phase * 360;
}

function stepIndexFromDirection(dirIdx: number): number {
  return Math.min(3, Math.floor(dirIdx / 2));
}

type ScanFrame = {
  scanDeg: number;
  dirIdx: number;
  activeStepIndex: number;
  activeCurrentIdx: number;
  scanDirectionId: string;
};

function useSyncroHowItWorksScan(onFrame: (frame: ScanFrame) => void) {
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    let raf = 0;

    const tick = (now: number) => {
      const phase = (now % PERIOD_MS) / PERIOD_MS;
      const dirIdx = directionIndexFromPhase(phase);
      const scanDeg = scanDegFromPhase(phase);
      const frame: ScanFrame = {
        scanDeg,
        dirIdx,
        activeStepIndex: stepIndexFromDirection(dirIdx),
        activeCurrentIdx: CURRENT_BY_DIR[dirIdx] ?? 0,
        scanDirectionId: DIRECTION_IDS[dirIdx] ?? "N",
      };

      onFrameRef.current(frame);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

function SyncroHowItWorksRing({
  scanDegRef,
  dirIdxRef,
  scanDirectionId,
  activeCurrentIdx,
}: {
  scanDegRef: RefObject<number>;
  dirIdxRef: RefObject<number>;
  scanDirectionId: string;
  activeCurrentIdx: number;
}) {
  const locale = useLocale();
  const tItems = useTranslations("marketingSite.syncro.five_currents");
  const { compassDegree: alpha } = useOrientation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [labelVisible, setLabelVisible] = useState(true);
  const prevCurrentRef = useRef(activeCurrentIdx);

  const currentLabels = useMemo(() => {
    const items = tItems.raw("items") as { name: string }[];
    return CURRENT_KEYS.map((_, i) => parseCurrentLabel(items[i]?.name ?? "", locale));
  }, [locale, tItems]);

  useEffect(() => {
    if (prevCurrentRef.current === activeCurrentIdx) return;
    prevCurrentRef.current = activeCurrentIdx;
    setLabelVisible(false);
    const id = window.setTimeout(() => setLabelVisible(true), 80);
    return () => window.clearTimeout(id);
  }, [activeCurrentIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = host.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const paint = () => {
      const dirIdx = dirIdxRef.current ?? 0;
      const scanDegNow = scanDegRef.current ?? 0;
      drawRadarFrame(ctx, w, h, scanDegNow, dirIdx);
      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [scanDegRef, dirIdxRef]);

  const activeKey = CURRENT_KEYS[activeCurrentIdx] ?? "open";
  const activeColor = CURRENT_COLORS[activeKey];

  return (
    <div ref={hostRef} className="syncro-how-works-flow__ring" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <div className="syncro-how-works-flow__rotate" style={{ transform: `rotate(${-alpha}deg)` }}>
        <SyncroParticleCore bare ringSize={RING_SIZE} />
        <div
          className="syncro-how-works-flow__radar"
          style={{ ["--syncro-radar-scale" as string]: String(RADAR_SCALE) }}
        >
          <canvas ref={canvasRef} className="syncro-how-works-flow__scan" aria-hidden />
          <div className="syncro-how-works-flow__labels">
            <SyncroDirectionLabels
              highlightId={scanDirectionId}
              counterRotateDeg={alpha}
              labelRadius={LABEL_RADIUS}
              labelScale={RING_SIZE / SYNCRO_RING_SIZE}
            />
          </div>
        </div>
      </div>

      <div className="syncro-how-works-flow__center" aria-live="polite">
        <p
          className="syncro-how-works-flow__center-label"
          style={{ color: activeColor, opacity: labelVisible ? 1 : 0 }}
        >
          {currentLabels[activeCurrentIdx]}
        </p>
      </div>
    </div>
  );
}

function SyncroHowItWorksCurrentCaption({
  activeCurrentIdx,
}: {
  activeCurrentIdx: number;
}) {
  const tItems = useTranslations("marketingSite.syncro.five_currents");
  const [visible, setVisible] = useState(true);
  const prevRef = useRef(activeCurrentIdx);

  const currentDescs = useMemo(() => {
    const items = tItems.raw("items") as { desc: string }[];
    return CURRENT_KEYS.map((_, i) => items[i]?.desc ?? "");
  }, [tItems]);

  useEffect(() => {
    if (prevRef.current === activeCurrentIdx) return;
    prevRef.current = activeCurrentIdx;
    setVisible(false);
    const id = window.setTimeout(() => setVisible(true), 80);
    return () => window.clearTimeout(id);
  }, [activeCurrentIdx]);

  const activeKey = CURRENT_KEYS[activeCurrentIdx] ?? "open";
  const activeColor = CURRENT_COLORS[activeKey];

  return (
    <p
      className="syncro-how-works-flow__current-desc"
      style={{ color: activeColor, opacity: visible ? 1 : 0 }}
      aria-live="polite"
    >
      {currentDescs[activeCurrentIdx]}
    </p>
  );
}

function SyncroHowItWorksFlowInner({ steps }: { steps: FlowStep[] }) {
  const scanDegRef = useRef(0);
  const dirIdxRef = useRef(0);
  const [scanDirectionId, setScanDirectionId] = useState("N");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeCurrentIdx, setActiveCurrentIdx] = useState(0);
  const lastDirRef = useRef(-1);

  useSyncroHowItWorksScan((frame) => {
    scanDegRef.current = frame.scanDeg;
    dirIdxRef.current = frame.dirIdx;

    if (frame.dirIdx === lastDirRef.current) return;
    lastDirRef.current = frame.dirIdx;
    setScanDirectionId(frame.scanDirectionId);
    setActiveStepIndex(frame.activeStepIndex);
    setActiveCurrentIdx(frame.activeCurrentIdx);
  });

  return (
    <>
      <div className="syncro-how-works-flow__stage">
        <SyncroHowItWorksRing
          scanDegRef={scanDegRef}
          dirIdxRef={dirIdxRef}
          scanDirectionId={scanDirectionId}
          activeCurrentIdx={activeCurrentIdx}
        />
      </div>
      <div className="syncro-how-works-flow__current-caption">
        <SyncroHowItWorksCurrentCaption activeCurrentIdx={activeCurrentIdx} />
      </div>
      <DsFlowStepRow steps={steps} accentRgb="34,211,238" activeIndex={activeStepIndex} />
    </>
  );
}

/** How Syncro works — mobile fangwei spline + directional scan + five currents */
export function SyncroHowItWorksFlow({ steps }: { steps: FlowStep[] }) {
  return (
    <div className="syncro-how-works-flow">
      <SyncroMarketingOrientationProvider>
        <SyncroHowItWorksFlowInner steps={steps} />
      </SyncroMarketingOrientationProvider>
    </div>
  );
}
