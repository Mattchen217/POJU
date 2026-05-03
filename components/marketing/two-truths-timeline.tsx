type TruthAccent = "purple" | "cyan" | "pink" | "you";

const twoTruthsSteps: {
  title: string;
  body: string;
  align: "left" | "right";
  accent: TruthAccent;
}[] = [
  {
    title: "✦ ANCIENT",
    body: "Two thousand years of human observation on patterns, place, timing, and purpose.",
    align: "left",
    accent: "purple",
  },
  {
    title: "✦ MODERN",
    body: "Reinforced by science: magnetic fields · spatial cognition · circadian rhythms · environmental psych",
    align: "right",
    accent: "cyan",
  },
  {
    title: "✦ AI AGENT",
    body: "Translated by an intelligence trained on both — into what you can do, today.",
    align: "left",
    accent: "pink",
  },
  {
    title: "✦ YOU",
    body: "Your birth chart. Your direction. Your question. Your this exact moment.",
    align: "right",
    accent: "you",
  },
];

function nodeHoverExtras(accent: TruthAccent) {
  if (accent === "purple") {
    return "group-hover:shadow-[0_0_24px_rgba(167,139,250,0.6)]";
  }
  if (accent === "cyan") {
    return "group-hover:shadow-[0_0_24px_rgba(79,209,237,0.55)]";
  }
  if (accent === "pink") {
    return "group-hover:shadow-[0_0_24px_rgba(249,168,212,0.5)]";
  }
  return "group-hover:shadow-[0_0_40px_rgba(167,139,250,0.78),0_0_22px_rgba(244,114,182,0.4)] group-hover:border-violet-300/95";
}

function TimelineNode({ accent }: { accent: TruthAccent }) {
  const hoverBase =
    "transition-all duration-300 ease-out group-hover:scale-[1.14] motion-reduce:transition-none motion-reduce:group-hover:scale-100";

  if (accent === "you") {
    return (
      <div
        className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-violet-400/70 bg-gradient-to-br from-violet-600/35 to-fuchsia-600/25 shadow-[0_0_28px_rgba(167,139,250,0.55),0_0_12px_rgba(244,114,182,0.25)] ${hoverBase} ${nodeHoverExtras(accent)}`}
        aria-hidden
      >
        <span className="h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.85)] transition-transform duration-300 ease-out group-hover:scale-110" />
      </div>
    );
  }

  const ring =
    accent === "purple"
      ? "ring-[#a78bfa]/90"
      : accent === "cyan"
        ? "ring-[#4fd1ed]/90"
        : "ring-[#f9a8d4]/90";

  return (
    <div
      className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0b1022]/95 ring-2 ${ring} ${hoverBase} ${nodeHoverExtras(accent)}`}
      aria-hidden
    >
      <span className="h-1.5 w-1.5 rounded-full bg-white/90 transition-transform duration-300 ease-out group-hover:scale-125 group-hover:bg-white" />
    </div>
  );
}

const blockHoverMotion =
  "inline-block transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.08] sm:group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100";

function titleClass(accent: TruthAccent) {
  const base = `text-[15px] font-bold uppercase tracking-[0.14em] sm:text-base ${blockHoverMotion}`;
  if (accent === "purple") return `${base} text-[#c4b5fd] group-hover:text-[#ddd6fe]`;
  if (accent === "cyan") return `${base} text-[#7ee8f7] group-hover:text-[#a5f3fc]`;
  if (accent === "pink") return `${base} text-[#fbcfe8] group-hover:text-[#fce7f3]`;
  return `${base} text-white sm:text-[17px] sm:tracking-[0.16em] group-hover:text-white`;
}

function bodyClass(align: "left" | "right") {
  const origin = align === "left" ? "origin-right" : "origin-left";
  const alignCls = align === "left" ? "text-right md:ml-auto md:max-w-[min(100%,22rem)]" : "max-w-[min(100%,22rem)] text-left";
  return `mt-2 ${origin} ${alignCls} text-[13px] leading-6 text-[#e8eaf4] transition-colors duration-300 sm:text-sm sm:leading-7 ${blockHoverMotion} group-hover:text-[#f6f7fc]`;
}

export function TwoTruthsTimelineSection() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-12 md:px-8 md:py-16">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-text-dim">
        Where two truths meet.
      </p>

      <div className="relative mx-auto mt-12 max-w-4xl md:mt-16">
        <div
          className="pointer-events-none absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-white/[0.14] to-transparent md:top-3 md:bottom-3"
          aria-hidden
        />

        <div className="relative flex flex-col gap-12 md:gap-16">
          {twoTruthsSteps.map((step) => (
            <div
              key={step.title}
              className="group relative grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] sm:gap-x-3 md:grid-cols-[1fr_3.5rem_1fr] md:gap-x-5"
            >
              {step.align === "left" ? (
                <>
                  <div className="min-w-0 self-start pr-0.5 text-right sm:pr-2 md:pr-5">
                    <p className={`${titleClass(step.accent)} origin-right`}>{step.title}</p>
                    <p className={bodyClass("left")}>{step.body}</p>
                  </div>
                  <div className="-my-1 flex justify-center justify-self-center self-start px-1 py-2 pt-1 md:pt-0.5">
                    <TimelineNode accent={step.accent} />
                  </div>
                  <div className="min-w-0" aria-hidden />
                </>
              ) : (
                <>
                  <div className="min-w-0" aria-hidden />
                  <div className="-my-1 flex justify-center justify-self-center self-start px-1 py-2 pt-1 md:pt-0.5">
                    <TimelineNode accent={step.accent} />
                  </div>
                  <div className="min-w-0 self-start pl-0.5 text-left sm:pl-2 md:pl-5">
                    <p className={`${titleClass(step.accent)} origin-left`}>{step.title}</p>
                    <p className={bodyClass("right")}>{step.body}</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
