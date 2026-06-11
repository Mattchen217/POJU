import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils/classnames";

/* ===== Layout ===== */

export function DsPageStack({
  children,
  className,
  variant = "product",
}: {
  children: ReactNode;
  className?: string;
  variant?: "home" | "product";
}) {
  return (
    <div className={cn("ds-page-stack", variant === "home" && "ds-page-stack--home", className)}>
      {children}
    </div>
  );
}

export function DsBand({
  children,
  className,
  id,
  center,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  center?: boolean;
}) {
  return (
    <section id={id} className={cn("ds-band", center && "ds-band--center", className)}>
      {children}
    </section>
  );
}

/* ===== Typography ===== */

export function DsSectionHeading({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <h2 className={cn("ds-section-heading", className)} style={style}>
      {children}
    </h2>
  );
}

export function DsKicker({
  children,
  className,
  color,
}: {
  children: ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <p className={cn("ds-kicker", className)} style={color ? { color } : undefined}>
      {children}
    </p>
  );
}

export function DsGradientTitle({
  children,
  from,
  to,
  spaced,
  className,
}: {
  children: ReactNode;
  from: string;
  to: string;
  spaced?: boolean;
  className?: string;
}) {
  return (
    <h1
      className={cn("ds-gradient-title", spaced && "ds-gradient-title--spaced", className)}
      style={{
        backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 50%, ${from} 100%)`,
      }}
    >
      {children}
    </h1>
  );
}

export function DsFadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("ds-fade-in", className)} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/* ===== Surfaces ===== */

export function DsGlassCard({
  children,
  className,
  roseGlow,
  included,
}: {
  children: ReactNode;
  className?: string;
  roseGlow?: boolean;
  included?: boolean;
}) {
  return (
    <div
      className={cn(
        "ds-glass-card",
        roseGlow && "ds-glass-card--rose-glow",
        included && "ds-glass-card--included",
        className,
      )}
    >
      {children}
    </div>
  );
}

type MutedAccent = "violet" | "magenta" | "blue" | "fuchsia" | "gold" | "rose" | "cyan";

export function DsMutedCard({
  children,
  accent,
  className,
  center,
}: {
  children: ReactNode;
  accent: MutedAccent;
  className?: string;
  center?: boolean;
}) {
  return (
    <div
      className={cn(
        "ds-muted-card",
        `ds-muted-card--${accent}`,
        center && "text-center flex flex-col items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DsIconChip({
  children,
  className,
  size = 40,
}: {
  children: ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl bg-white/14 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {children}
    </span>
  );
}

/* ===== Match ===== */

export function DsDualCharts() {
  return (
    <div className="ds-dual-charts" aria-hidden>
      <div
        className="ds-dual-charts__orb"
        style={{
          background: "radial-gradient(circle at 35% 30%, rgba(255,107,157,0.5), rgba(10,5,16,0.85) 70%)",
          boxShadow: "0 0 36px rgba(255,107,157,0.5), inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        <span className="font-serif text-[30px] font-semibold text-[#ff6b9d]">A</span>
      </div>
      <div
        className="ds-dual-charts__orb ds-dual-charts__orb--b"
        style={{
          background: "radial-gradient(circle at 35% 30%, rgba(192,132,252,0.5), rgba(10,5,16,0.85) 70%)",
          boxShadow: "0 0 36px rgba(192,132,252,0.5), inset 0 0 0 1px rgba(255,255,255,0.12)",
        }}
      >
        <span className="font-serif text-[30px] font-semibold text-[#c084fc]">B</span>
      </div>
      <div className="ds-dual-charts__heart">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      </div>
    </div>
  );
}

export function DsMatchStep({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <div className="ds-match-step">
      <span className="ds-match-step__num">0{index}</span>
      <p className="mt-2 text-[15px] font-semibold text-[var(--pj-text-primary)]">{title}</p>
      <p className="mt-2 text-[13.5px] leading-snug text-[var(--pj-text-secondary)]">{body}</p>
    </div>
  );
}

/* ===== Syncro currents row ===== */

export function DsCurrentRow({
  name,
  desc,
  dotColor,
}: {
  name: string;
  desc: string;
  dotColor: string;
}) {
  return (
    <div className="ds-current-row">
      <span
        className="ds-current-row__dot"
        style={{ background: dotColor, boxShadow: `0 0 12px ${dotColor}` }}
        aria-hidden
      />
      <span className="ds-current-row__name">{name}</span>
      <span className="ds-current-row__desc">{desc}</span>
    </div>
  );
}
