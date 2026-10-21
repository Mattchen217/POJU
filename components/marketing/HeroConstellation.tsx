"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils/classnames";

type Star = {
  x: number;
  y: number;
  z: number;
  tw: number;
  gold: boolean;
};

type BigStar = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tw: number;
  twSpeed: number;
  gold: boolean;
  pulse: number;
};

type Meteor = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  duration: number;
  len: number;
  gold: boolean;
};

const STAR_COUNT = 72;
const BIG_STAR_COUNT = 4;
const LINK_DIST = 90;
const METEOR_GAP_MIN = 8;
const METEOR_GAP_MAX = 14;

type Props = {
  className?: string;
};

/**
 * Landing-style 2D starfield + sparse meteors.
 * Far cheaper than Spline WebGL — use on workspace idle heroes.
 */
export function HeroConstellation({ className }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let stars: Star[] = [];
    let bigStars: BigStar[] = [];
    let meteor: Meteor | null = null;
    let meteorCooldown = 2.5 + Math.random() * 3;

    function spawn(far: boolean): Star {
      return {
        x: (Math.random() - 0.5) * 2.2,
        y: (Math.random() - 0.5) * 2.2,
        z: far ? 0.35 + Math.random() * 0.65 : Math.random(),
        tw: Math.random() * Math.PI * 2,
        gold: Math.random() > 0.82,
      };
    }

    function spawnBig(): BigStar {
      const angle = Math.random() * Math.PI * 2;
      const speed = 8 + Math.random() * 16;
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1.8 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 0.6 + Math.random() * 0.9,
        gold: Math.random() > 0.45,
        pulse: 0.7 + Math.random() * 0.3,
      };
    }

    function spawnMeteor(): Meteor {
      const origin = Math.floor(Math.random() * 8);
      const jitter = ((Math.random() - 0.5) * 22 * Math.PI) / 180;
      const pad = 40 + Math.random() * 70;
      let x = 0;
      let y = 0;
      let angle = 0;

      switch (origin) {
        case 0:
          x = -pad + Math.random() * (w * 0.2);
          y = -pad + Math.random() * (h * 0.15);
          angle = ((45 + (Math.random() - 0.5) * 24) * Math.PI) / 180;
          break;
        case 1:
          x = w * 0.8 + Math.random() * (w * 0.2 + pad);
          y = -pad + Math.random() * (h * 0.15);
          angle = ((135 + (Math.random() - 0.5) * 24) * Math.PI) / 180;
          break;
        case 2:
          x = -pad + Math.random() * (w * 0.2);
          y = h * 0.85 + Math.random() * (h * 0.15 + pad);
          angle = ((-45 + (Math.random() - 0.5) * 24) * Math.PI) / 180;
          break;
        case 3:
          x = w * 0.8 + Math.random() * (w * 0.2 + pad);
          y = h * 0.85 + Math.random() * (h * 0.15 + pad);
          angle = ((-135 + (Math.random() - 0.5) * 24) * Math.PI) / 180;
          break;
        case 4:
          x = -pad;
          y = h * (0.2 + Math.random() * 0.6);
          angle = (((Math.random() > 0.5 ? 35 : -35) + (Math.random() - 0.5) * 18) * Math.PI) / 180;
          break;
        case 5:
          x = w + pad;
          y = h * (0.2 + Math.random() * 0.6);
          angle =
            (((Math.random() > 0.5 ? 145 : -145) + (Math.random() - 0.5) * 18) * Math.PI) / 180;
          break;
        case 6:
          x = w * (0.2 + Math.random() * 0.6);
          y = -pad;
          angle = (((Math.random() > 0.5 ? 55 : 125) + (Math.random() - 0.5) * 18) * Math.PI) / 180;
          break;
        default:
          x = w * (0.2 + Math.random() * 0.6);
          y = h + pad;
          angle =
            (((Math.random() > 0.5 ? -55 : -125) + (Math.random() - 0.5) * 18) * Math.PI) / 180;
          break;
      }

      angle += jitter;
      const speed = 420 + Math.random() * 280;
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        duration: 0.55 + Math.random() * 0.45,
        len: 70 + Math.random() * 90,
        gold: Math.random() > 0.55,
      };
    }

    function resize() {
      const rect = wrap!.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initStars() {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) stars.push(spawn(false));
      bigStars = [];
      for (let i = 0; i < BIG_STAR_COUNT; i++) bigStars.push(spawnBig());
      meteor = null;
      meteorCooldown = 2.5 + Math.random() * 3;
    }

    function project(s: Star) {
      const depth = Math.max(0.08, s.z);
      const scale = 0.55 / depth;
      return {
        px: w * 0.5 + s.x * scale * w * 0.42,
        py: h * 0.42 + s.y * scale * h * 0.38,
        r: Math.max(0.4, (1.15 - s.z) * 2.1),
        a: Math.max(0.05, (1 - s.z) * 0.75),
      };
    }

    function drawFrame(dt: number) {
      ctx!.clearRect(0, 0, w, h);

      const projected: Array<{ s: Star; p: ReturnType<typeof project> }> = [];
      for (const s of stars) {
        if (!reduced) {
          s.z += dt * 0.028;
          s.tw += dt * 1.2;
          if (s.z >= 1) {
            Object.assign(s, spawn(true));
            s.z = 0.12 + Math.random() * 0.2;
          }
        }
        projected.push({ s, p: project(s) });
      }

      ctx!.lineWidth = 0.6;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i]!;
        if (a.s.z > 0.72) continue;
        for (let j = i + 1; j < projected.length; j++) {
          const b = projected[j]!;
          if (b.s.z > 0.72) continue;
          const dx = a.p.px - b.p.px;
          const dy = a.p.py - b.p.py;
          const d = Math.hypot(dx, dy);
          if (d > LINK_DIST) continue;
          const alpha = (1 - d / LINK_DIST) * 0.14 * (1 - (a.s.z + b.s.z) * 0.35);
          ctx!.strokeStyle =
            a.s.gold || b.s.gold
              ? `rgba(212,175,55,${alpha * 1.2})`
              : `rgba(180,190,220,${alpha})`;
          ctx!.beginPath();
          ctx!.moveTo(a.p.px, a.p.py);
          ctx!.lineTo(b.p.px, b.p.py);
          ctx!.stroke();
        }
      }

      for (const { s, p } of projected) {
        const twinkle = reduced ? 0.85 : 0.65 + 0.35 * Math.sin(s.tw);
        const alpha = p.a * twinkle;
        if (s.gold) {
          ctx!.fillStyle = `rgba(232,201,110,${alpha})`;
          ctx!.shadowColor = "rgba(212,175,55,0.55)";
          ctx!.shadowBlur = 6;
        } else {
          ctx!.fillStyle = `rgba(220,228,245,${alpha})`;
          ctx!.shadowColor = "rgba(180,195,230,0.4)";
          ctx!.shadowBlur = 4;
        }
        ctx!.beginPath();
        ctx!.arc(p.px, p.py, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.shadowBlur = 0;

      if (!reduced) {
        for (const s of bigStars) {
          s.x += s.vx * dt;
          s.y += s.vy * dt;
          s.tw += dt * s.twSpeed;
          if (s.x < -20) s.x = w + 20;
          else if (s.x > w + 20) s.x = -20;
          if (s.y < -20) s.y = h + 20;
          else if (s.y > h + 20) s.y = -20;

          const twinkle = 0.55 + 0.45 * Math.sin(s.tw);
          const alpha = (0.55 + 0.35 * s.pulse) * twinkle;
          const glow = s.r * (2.2 + twinkle);
          if (s.gold) {
            ctx!.fillStyle = `rgba(232,201,110,${alpha})`;
            ctx!.shadowColor = "rgba(212,175,55,0.75)";
            ctx!.shadowBlur = 12 + twinkle * 8;
          } else {
            ctx!.fillStyle = `rgba(235,240,255,${alpha})`;
            ctx!.shadowColor = "rgba(200,215,255,0.55)";
            ctx!.shadowBlur = 10 + twinkle * 6;
          }
          ctx!.beginPath();
          ctx!.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.shadowBlur = 0;
          ctx!.strokeStyle = s.gold
            ? `rgba(232,201,110,${alpha * 0.45})`
            : `rgba(220,230,255,${alpha * 0.4})`;
          ctx!.lineWidth = 0.8;
          ctx!.beginPath();
          ctx!.moveTo(s.x - glow, s.y);
          ctx!.lineTo(s.x + glow, s.y);
          ctx!.moveTo(s.x, s.y - glow);
          ctx!.lineTo(s.x, s.y + glow);
          ctx!.stroke();
        }
        ctx!.shadowBlur = 0;

        if (!meteor) {
          meteorCooldown -= dt;
          if (meteorCooldown <= 0) {
            meteor = spawnMeteor();
            meteorCooldown = METEOR_GAP_MIN + Math.random() * (METEOR_GAP_MAX - METEOR_GAP_MIN);
          }
        } else {
          meteor.life += dt;
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const t = meteor.life / meteor.duration;
          const offscreen =
            meteor.x < -140 || meteor.x > w + 140 || meteor.y < -140 || meteor.y > h + 140;
          if (t >= 1 || offscreen) {
            meteor = null;
          } else {
            const fade = t < 0.12 ? t / 0.12 : t > 0.65 ? (1 - t) / 0.35 : 1;
            const alpha = Math.max(0, Math.min(1, fade));
            const speed = Math.hypot(meteor.vx, meteor.vy) || 1;
            const ux = meteor.vx / speed;
            const uy = meteor.vy / speed;
            const tailX = meteor.x - ux * meteor.len;
            const tailY = meteor.y - uy * meteor.len;
            const grad = ctx!.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
            if (meteor.gold) {
              grad.addColorStop(0, "rgba(212,175,55,0)");
              grad.addColorStop(0.45, `rgba(232,201,110,${alpha * 0.35})`);
              grad.addColorStop(1, `rgba(255,240,200,${alpha * 0.95})`);
            } else {
              grad.addColorStop(0, "rgba(200,215,255,0)");
              grad.addColorStop(0.45, `rgba(210,220,245,${alpha * 0.3})`);
              grad.addColorStop(1, `rgba(255,255,255,${alpha * 0.9})`);
            }
            ctx!.strokeStyle = grad;
            ctx!.lineWidth = 1.6;
            ctx!.lineCap = "round";
            ctx!.shadowColor = meteor.gold
              ? "rgba(212,175,55,0.65)"
              : "rgba(200,215,255,0.5)";
            ctx!.shadowBlur = 8;
            ctx!.beginPath();
            ctx!.moveTo(tailX, tailY);
            ctx!.lineTo(meteor.x, meteor.y);
            ctx!.stroke();
            ctx!.shadowBlur = 10;
            ctx!.fillStyle = meteor.gold
              ? `rgba(255,245,210,${alpha})`
              : `rgba(255,255,255,${alpha})`;
            ctx!.beginPath();
            ctx!.arc(meteor.x, meteor.y, 1.8, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.shadowBlur = 0;
            ctx!.lineCap = "butt";
          }
        }
      }
    }

    function tick(t: number) {
      if (document.hidden || !visible) {
        raf = 0;
        return;
      }
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      drawFrame(reduced ? 0 : dt);
      if (!reduced) raf = window.requestAnimationFrame(tick);
    }

    function start() {
      if (raf || document.hidden || !visible) return;
      last = performance.now();
      if (reduced) {
        drawFrame(0);
        return;
      }
      raf = window.requestAnimationFrame(tick);
    }

    function stop() {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    }

    resize();
    initStars();
    drawFrame(0);

    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) drawFrame(0);
    });
    ro.observe(wrap);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0.05 },
    );
    io.observe(wrap);

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <div ref={wrapRef} className={cn("hero-constellation", className)} aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
