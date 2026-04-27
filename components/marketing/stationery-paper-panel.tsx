function buildPaperParticles(): { cx: number; cy: number; r: number; o: number }[] {
  const pts: { cx: number; cy: number; r: number; o: number }[] = [];
  const pushEdge = (count: number, edge: "t" | "b" | "l" | "r") => {
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0.5;
      const jitter = ((i * 7) % 5) * 0.06 - 0.12;
      const r = 0.18 + ((i * 3) % 4) * 0.05;
      const o = 0.16 + ((i * 5) % 6) * 0.04;
      if (edge === "t") pts.push({ cx: 1.5 + t * 97, cy: 0.55 + jitter, r, o });
      if (edge === "b") pts.push({ cx: 1.5 + t * 97, cy: 99.45 - jitter, r, o });
      if (edge === "l") pts.push({ cx: 0.55 + jitter, cy: 2 + t * 96, r, o });
      if (edge === "r") pts.push({ cx: 99.45 - jitter, cy: 2 + t * 96, r, o });
    }
  };
  pushEdge(32, "t");
  pushEdge(32, "b");
  pushEdge(22, "l");
  pushEdge(22, "r");
  return pts;
}

const paperParticleDots = buildPaperParticles();

function PaperParticleFrame() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-[#ede6d8]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {paperParticleDots.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="currentColor" opacity={p.o} />
      ))}
    </svg>
  );
}

export function StationeryPaperPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative my-1 overflow-hidden rounded-[3px] px-5 pb-10 pt-8 sm:px-7 sm:pb-11 sm:pt-9 md:px-9 md:pb-12 md:pt-10">
      <div
        className="pointer-events-none absolute inset-0 rounded-[3px] border border-[#e2d8c4]/[0.4] bg-gradient-to-br from-[#fdfbf7]/[0.075] via-[#f6f1e6]/[0.045] to-[#0a0c14]/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_16px_56px_rgba(0,0,0,0.38)] backdrop-blur-[1px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[1px] rounded-[2px] opacity-[0.13] sm:opacity-[0.15]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 1.625rem, rgba(175, 165, 145, 0.28) 1.625rem, rgba(175, 165, 145, 0.28) calc(1.625rem + 1px))",
          backgroundPosition: "0 0.4rem",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-5 left-[1.35rem] top-11 w-[2px] rounded-full bg-rose-400/[0.28] sm:left-[1.6rem] sm:top-12 md:left-[1.85rem]"
        aria-hidden
      />
      <PaperParticleFrame />
      <div className="relative z-10 pl-6 sm:pl-8 md:pl-10">{children}</div>
    </div>
  );
}
