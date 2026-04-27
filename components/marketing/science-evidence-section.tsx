type ScienceDeco = "brain" | "compass" | "clock" | "eye";

const scienceEvidenceCards: {
  title: string;
  body: string;
  citation: string;
  deco: ScienceDeco;
}[] = [
  {
    title: "Magnetic fields affect cognition",
    body:
      "Geomagnetic cues subtly shape spatial judgement and neural processing—effects Eastern traditions long linked to polarity, direction, and auspicious alignment.",
    citation: "[COGNITIVE NEUROSCIENCE / 2024]",
    deco: "brain",
  },
  {
    title: "Spatial orientation shapes decisions",
    body:
      "Layout, openness, and sightlines change what we notice and how we weigh risk—echoing classical ideas of form, flow, and supportive environments.",
    citation: "[ENVIRONMENTAL PSYCHOLOGY / 2019]",
    deco: "compass",
  },
  {
    title: "Circadian cycles drive biology",
    body:
      "Light–dark timing steadies hormones, mood, and focus—mirroring traditional emphasis on seasons, cycles, and choosing the right moment to act.",
    citation: "[CHRONOBIOLOGY REVIEW / 2022]",
    deco: "clock",
  },
  {
    title: "Visual direction influences focus",
    body:
      "Where the gaze rests and what frames the view can steady or fragment attention—parallel to ideas of clear sightlines and unobstructed qi.",
    citation: "[VISUAL COGNITION / 2021]",
    deco: "eye",
  },
];

/** 与首页三张产品卡相同的 135° 光泽底 + 纵向压暗叠层；第 4 张为同体系的粉紫→深靛。 */
const scienceCardSurfaces: { card: string; overlay: string }[] = [
  {
    card: "linear-gradient(135deg, rgba(106,69,239,0.62) 0%, rgba(53,42,131,0.74) 48%, rgba(20,26,66,0.98) 100%)",
    overlay: "linear-gradient(180deg, rgba(5,8,23,0.10) 0%, rgba(5,8,23,0.35) 100%)",
  },
  {
    card: "linear-gradient(135deg, rgba(15,143,208,0.70) 0%, rgba(13,79,132,0.76) 48%, rgba(7,39,70,0.98) 100%)",
    overlay: "linear-gradient(180deg, rgba(3,19,26,0.08) 0%, rgba(3,19,26,0.28) 100%)",
  },
  {
    card: "linear-gradient(135deg, rgba(243,193,58,0.62) 0%, rgba(138,90,223,0.74) 48%, rgba(47,35,101,0.98) 100%)",
    overlay: "linear-gradient(180deg, rgba(21,15,36,0.08) 0%, rgba(21,15,36,0.30) 100%)",
  },
  {
    card: "linear-gradient(135deg, rgba(217,70,239,0.52) 0%, rgba(91,33,182,0.72) 48%, rgba(18,17,42,0.98) 100%)",
    overlay: "linear-gradient(180deg, rgba(10,8,22,0.10) 0%, rgba(10,8,22,0.32) 100%)",
  },
];

function ScienceSparkle({ className }: { className?: string }) {
  return (
    <svg
      className={`h-7 w-7 shrink-0 text-sky-300 sm:h-8 sm:w-8 ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.9 6.4L20 10l-6.1 1.6L12 18l-1.9-6.4L4 10l6.1-1.6L12 2z" />
    </svg>
  );
}

function ScienceWatermark({ kind }: { kind: ScienceDeco }) {
  const cls = "h-[132px] w-[132px] sm:h-[152px] sm:w-[152px]";
  if (kind === "brain") {
    return (
      <svg className={cls} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.15" aria-hidden>
        <path d="M50 16c-12.5 0-22 9.2-22 20.5 0 5.2 2.2 10 5.8 13-2.2 3.4-3.5 7.5-3.5 11.8 0 11 6 19.7 13.2 19.7 2.8 0 5.4-1.4 7.5-4 2 2.6 4.6 4 7.5 4 7.2 0 13.2-8.7 13.2-19.7 0-4.3-1.3-8.4-3.5-11.8 3.6-3 5.8-7.8 5.8-13C72 25.2 62.5 16 50 16Z" />
        <path d="M40 44h7M53 44h7" strokeLinecap="round" />
        <path d="M44 58c3.2 3.5 8.8 3.5 12 0" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "compass") {
    return (
      <svg className={cls} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.15" aria-hidden>
        <circle cx="50" cy="52" r="28" />
        <path d="M50 24v10M50 70v6M22 52h10M68 52h10" strokeLinecap="round" />
        <path d="M50 38 58 52 50 66 42 52Z" />
      </svg>
    );
  }
  if (kind === "clock") {
    return (
      <svg className={cls} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.15" aria-hidden>
        <circle cx="50" cy="50" r="30" />
        <path d="M50 50V30M50 50l14 8" strokeLinecap="round" />
        <circle cx="50" cy="50" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.15" aria-hidden>
      <path d="M50 28c-14 0-24 10-24 22 0 12 10 22 24 22s24-10 24-22c0-12-10-22-24-22Z" />
      <circle cx="50" cy="50" r="9" />
      <circle cx="50" cy="50" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ScienceEvidenceSection() {
  return (
    <section className="mx-auto mt-8 w-full max-w-6xl px-4 py-10 md:mt-12 md:px-6 md:py-14">
      <h2 className="mx-auto max-w-[920px] text-center text-[26px] font-bold leading-[1.18] tracking-tight text-text-primary sm:text-[30px] md:text-[36px] md:leading-[1.12]">
        <span className="block">What Eastern traditions observed,</span>
        <span className="mt-1 block bg-gradient-to-r from-[#d8b4fe] via-[#e879f9] to-[#fb7185] bg-clip-text text-transparent sm:mt-1.5">
          science is beginning to measure.
        </span>
      </h2>

      <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 sm:mt-12 sm:gap-5 md:grid-cols-2 md:gap-6">
        {scienceEvidenceCards.map((card, index) => {
          const surface = scienceCardSurfaces[index] ?? scienceCardSurfaces[0];
          return (
          <article
            key={card.title}
            className="group relative min-h-[200px] overflow-hidden rounded-[14px] border border-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(6,10,28,0.45)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:min-h-[220px] sm:p-6"
          >
            <div
              className="pointer-events-none absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              style={{ backgroundImage: surface.card }}
            />
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-500 group-hover:opacity-80 motion-reduce:transition-none motion-reduce:group-hover:opacity-100"
              style={{ backgroundImage: surface.overlay }}
            />
            <div className="pointer-events-none absolute inset-0 z-[2] opacity-0 transition-opacity duration-500 group-hover:opacity-100 motion-reduce:transition-none motion-reduce:group-hover:opacity-0">
              <div className="absolute -inset-10 bg-[radial-gradient(circle_at_70%_70%,rgba(255,255,255,0.18),transparent_55%)]" />
            </div>
            <div className="pointer-events-none absolute inset-y-2 right-0 z-[1] flex w-[46%] items-center justify-end pr-1 text-white/[0.08] sm:text-white/[0.10]">
              <ScienceWatermark kind={card.deco} />
            </div>

            <div className="relative z-10 flex min-w-0 flex-col drop-shadow-[0_1px_12px_rgba(0,0,0,0.25)]">
              <div className="flex items-start gap-3 sm:gap-3.5">
                <ScienceSparkle className="mt-0.5" />
                <h3 className="min-w-0 flex-1 text-[17px] font-bold leading-snug text-white sm:text-lg">{card.title}</h3>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-black p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                <p className="text-[13px] leading-6 text-neutral-300 sm:text-sm sm:leading-7">{card.body}</p>
              </div>

              <p className="mt-4 font-mono text-[10px] font-medium uppercase leading-none tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em]">
                <span className="bg-gradient-to-r from-[#e9d5ff] to-[#fda4af] bg-clip-text text-transparent">
                  {card.citation}
                </span>
              </p>
            </div>
          </article>
          );
        })}
      </div>

      <div className="mx-auto mt-12 max-w-3xl text-center md:mt-14">
        <p className="text-sm text-text-secondary">Eastern traditions named these forces two thousand years ago.</p>
        <p className="mt-2 text-sm tracking-[0.16em] text-text-accent">QI · XUAN · BAZI · YUAN</p>
        <p className="mt-3 text-sm text-text-secondary">
          POJU uses AI to translate both languages into something
          <br />
          you can act on — today.
        </p>
      </div>
    </section>
  );
}
