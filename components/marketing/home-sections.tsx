import { CtaButton } from "@/components/ui/cta-button";

export function HomeSections() {
  return (
    <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 md:px-6 md:py-8">
      <section className="poju-landing-shell">
        <div className="poju-browser-bar">
          <div className="poju-window-dots">
            <span className="!bg-pink-400/80" />
            <span className="!bg-yellow-300/80" />
            <span className="!bg-emerald-300/80" />
          </div>
          <p className="poju-browser-url">easternos.com</p>
          <div className="h-4 w-14 rounded-full border border-white/10 bg-white/5" />
        </div>
        <div className="poju-cosmic-panel p-6 md:p-8">
          <div className="poju-inner-nav">
            <p className="text-xs font-semibold tracking-[0.12em] text-text-primary">POJU</p>
            <div className="poju-inner-nav-links">
              <span>POJU</span>
              <span>SYNCRO</span>
              <span>GLYPH</span>
              <span>ARCHIVE</span>
            </div>
            <span className="rounded-full border border-purple-vivid/35 bg-purple-primary/25 px-3 py-1 text-[10px] text-text-primary">
              GET POJU
            </span>
          </div>
          <div className="grid gap-8 md:grid-cols-[1.02fr_0.98fr] md:items-center">
            <div className="relative z-10">
              <h1 className="mt-1 text-4xl font-semibold leading-tight text-text-primary md:text-[52px]">
                Ancient Wisdom,
                <br />
                AI-Powered.
                <br />
                Life Transformed.
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-6 text-text-secondary md:text-[15px]">
                The wisdom that costs $300 with a master. Delivered in one conversation. $9.99.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <CtaButton href="/chat?token=ui-preview" className="min-w-[220px]">
                  Ask your question
                </CtaButton>
                <CtaButton href="/syncro" variant="secondary" className="border-white/20">
                  Learn More
                </CtaButton>
              </div>
            </div>
            <div className="poju-hero-ring relative z-10 mx-auto h-64 w-64 md:h-[336px] md:w-[336px]">
              <div className="absolute inset-0 rounded-full border border-purple-vivid/35 bg-[radial-gradient(circle_at_50%_50%,rgba(192,132,252,0.12),rgba(168,85,247,0.25)_36%,rgba(11,8,21,0.78)_62%,transparent_80%)] shadow-glow" />
              <div className="absolute inset-[9%] rounded-full border border-purple-pink/35" />
              <div className="absolute inset-[22%] rounded-full border border-cyan-bright/35" />
              <div className="absolute inset-[34%] rounded-full border border-purple-vivid/30" />
              <div className="absolute inset-[44%] rounded-full bg-bg-deep/90" />
              <div className="absolute inset-[46%] rounded-full bg-black/80 blur-[2px]" />
            </div>
          </div>
          <p className="poju-path-headline">Three Paths, One Purpose</p>
          <p className="poju-path-subline">Finding clarity through ancient wisdom and modern science</p>
          <div className="poju-path-grid">
            <article className="poju-path-card poju">
              <div className="relative z-10 flex items-center gap-2">
                <span className="material-symbols-outlined jewel-icon text-[22px] leading-none text-violet-300">
                  self_improvement
                </span>
                <div>
                  <h3 className="poju-path-title">POJU</h3>
                  <p className="poju-path-caption">AI chat breakthrough</p>
                </div>
              </div>
              <p className="poju-path-body">Align your life with wisdom-driven structure.</p>
              <p className="poju-path-link">Learn More →</p>
              <span className="poju-path-core" />
            </article>
            <article className="poju-path-card syncro">
              <div className="relative z-10 flex items-center gap-2">
                <span className="poju-path-dot">◎</span>
                <div>
                  <h3 className="poju-path-title">SYNCRO</h3>
                  <p className="poju-path-caption">Energy field map</p>
                </div>
              </div>
              <p className="poju-path-body">Enter spatial timing and directional resonance.</p>
              <p className="poju-path-link !text-cyan-300">Start Here →</p>
              <span className="poju-path-core" />
            </article>
            <article className="poju-path-card oracle">
              <div className="relative z-10 flex items-center gap-2">
                <span className="poju-path-dot">◇</span>
                <div>
                  <h3 className="poju-path-title">GLYPH</h3>
                  <p className="poju-path-caption">A 60-second mirror</p>
                </div>
              </div>
              <p className="poju-path-body">Draw one pattern and read your reflection with calm precision.</p>
              <p className="poju-path-link !text-pink-300">Start Here →</p>
              <span className="poju-path-core" />
            </article>
          </div>
        </div>

        <div className="poju-designed-strip">
          <p className="text-center text-xs font-semibold text-[#1f2a44]">Designed for Real Life</p>
          <div className="poju-designed-grid">
            {[
              ["Align", "Discover your best direction"],
              ["Simplify", "Reduce inner friction"],
              ["Activate", "Turn insight into actions"],
              ["Expand", "Build breakthrough momentum"],
            ].map(([title, text]) => (
              <article key={title} className="poju-designed-item">
                <p className="text-xs font-semibold text-[#1d2740]">{title}</p>
                <p className="mt-1 text-[11px] text-[#5f6b86]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="poju-glass-card p-6 md:p-8">
        <p className="poju-kicker">Where two truths meet</p>
        <h2 className="poju-section-title mt-2">Ancient · Modern · AI Agent · You</h2>
        <div className="mt-6 grid gap-3">
          {[
            ["Ancient", "Two thousand years of human observation on patterns, place, timing, and purpose."],
            ["Modern", "Reinforced by science: magnetic fields · spatial cognition · circadian rhythms · environmental psychology."],
            ["AI Agent", "Translated by an intelligence trained on both into actions you can do today."],
            ["You", "Your birth chart. Your direction. Your question. Your this exact moment."],
          ].map(([title, text]) => (
            <article key={title} className="rounded-xl border border-glass-border/70 bg-black/10 px-5 py-4">
              <h3 className="text-base font-semibold tracking-[0.08em] text-text-primary">{title.toUpperCase()}</h3>
              <div className="poju-divider !my-3" />
              <p className="text-sm leading-6 text-text-secondary">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="poju-glass-card p-6 md:p-8">
        <p className="poju-kicker">Modern Science Anchor</p>
        <h2 className="poju-section-title mt-2">What Eastern traditions observed, science is beginning to measure.</h2>
        <ul className="mt-5 space-y-3 text-sm text-text-secondary">
          <li className="rounded-lg border border-white/10 bg-black/15 px-4 py-3">✦ Magnetic fields affect cognitive performance — Journal of Cognitive Neuroscience</li>
          <li className="rounded-lg border border-white/10 bg-black/15 px-4 py-3">✦ Spatial orientation shapes decision quality — Environmental Psychology Review</li>
          <li className="rounded-lg border border-white/10 bg-black/15 px-4 py-3">✦ Circadian cycles drive biological rhythms — Nature · Circadian Biology</li>
          <li className="rounded-lg border border-white/10 bg-black/15 px-4 py-3">✦ Visual direction influences focus and stress — Stanford Environmental Research</li>
        </ul>
        <div className="poju-divider" />
        <p className="text-sm text-text-secondary">Eastern traditions named these forces two thousand years ago.</p>
        <p className="mt-4 text-sm text-text-accent">QI · YI · DAO · YUAN</p>
      </section>

      <section className="poju-glass-card p-6 md:p-8">
        <p className="poju-kicker">Three promises we don&apos;t break</p>
        <h2 className="poju-section-title mt-2">The Three Nevers</h2>
        {[
          ["Never stored", "Your conversations live only on your device. We encrypt them locally. We cannot read them."],
          ["Never required", "No account. No login. No password. No email, unless you want your reading as a PDF."],
          ["Never manipulative", "No dark patterns. No fake urgency. No upsells. One price: $9.99."],
        ].map(([title, text]) => (
          <article key={title} className="poju-glass-card mt-4 p-5 md:p-6">
            <h3 className="font-semibold text-text-primary">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
