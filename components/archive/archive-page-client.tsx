"use client";

export function ArchivePageClient() {
  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.15),transparent_60%)]" />

      <main className="relative z-10 mx-auto w-full max-w-4xl px-6 py-8 pb-32 md:py-12 md:pb-12">
        <div className="mb-10 text-center md:text-left">
          <h1 className="mb-2 text-[40px] font-bold tracking-tight text-primary">✦ THE ARCHIVE.</h1>
          <p className="text-[18px] text-on-surface-variant/70">Everything here lives only on this device.</p>
        </div>

        <div className="mb-12 space-y-6">
          <div className="relative mx-auto max-w-xl md:mx-0">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high/50 py-3 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant/40 backdrop-blur-md transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
              placeholder="Search your history..."
              type="text"
            />
          </div>
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 md:mx-0 md:px-0">
            <button className="whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[12px] text-primary">All</button>
            <button className="whitespace-nowrap rounded-full border border-outline-variant/20 bg-surface-container-high/50 px-4 py-2 text-[12px] text-on-surface-variant transition-colors hover:text-on-surface">POJU</button>
            <button className="whitespace-nowrap rounded-full border border-outline-variant/20 bg-surface-container-high/50 px-4 py-2 text-[12px] text-on-surface-variant transition-colors hover:text-on-surface">Syncro</button>
            <button className="whitespace-nowrap rounded-full border border-outline-variant/20 bg-surface-container-high/50 px-4 py-2 text-[12px] text-on-surface-variant transition-colors hover:text-on-surface">Glyph</button>
          </div>
        </div>

        <div className="space-y-12">
          <section>
            <h2 className="mb-4 border-l-2 border-primary/30 pl-2 text-[12px] uppercase tracking-wider text-outline">Today</h2>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 border-t-white/20 bg-[rgba(30,30,34,0.6)] p-5 backdrop-blur-xl transition-all duration-300 hover:bg-surface-container-highest/60">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <span className="material-symbols-outlined text-sm">forum</span>
                  </div>
                  <span className="text-[12px] uppercase tracking-widest text-primary">POJU Session</span>
                </div>
                <div className="mb-5">
                  <h3 className="mb-1 text-[24px] text-on-surface">&quot;Dad and I keep...&quot;</h3>
                  <p className="flex items-center gap-2 text-on-surface-variant/60">
                    <span className="h-2 w-2 rounded-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    Still active · 12 messages
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="rounded-lg border border-primary/30 bg-primary/20 px-5 py-2 text-[12px] text-primary transition-colors hover:bg-primary/30">Resume</button>
                  <button className="rounded-lg border border-outline-variant bg-transparent px-5 py-2 text-[12px] text-on-surface-variant transition-colors hover:bg-surface-container-highest">Archive</button>
                  <button className="ml-auto rounded-lg border border-outline-variant bg-transparent px-5 py-2 text-[12px] text-on-surface-variant transition-colors hover:border-error/30 hover:bg-error-container/20 hover:text-error">Wipe</button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 border-t-white/20 bg-[rgba(30,30,34,0.6)] p-5 backdrop-blur-xl transition-all duration-300 hover:bg-surface-container-highest/60">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  </div>
                  <span className="text-[12px] uppercase tracking-widest text-amber-400">Glyph</span>
                </div>
                <div className="mb-5">
                  <h3 className="mb-2 text-[24px] text-on-surface">&quot;About my decision to move...&quot;</h3>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container/50 px-3 py-1.5">
                    <span className="material-symbols-outlined text-xs text-amber-400">water_drop</span>
                    <span className="text-sm text-on-surface-variant">✦ Calm Current · Pattern of Flow</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="flex items-center gap-2 rounded-lg border border-outline-variant bg-transparent px-5 py-2 text-[12px] text-on-surface transition-colors hover:bg-surface-container-highest">
                    <span className="material-symbols-outlined text-sm">visibility</span> View
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-l-2 border-outline-variant/50 pl-2 text-[12px] uppercase tracking-wider text-outline">Yesterday</h2>
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 border-t-white/20 bg-[rgba(30,30,34,0.6)] p-5 backdrop-blur-xl transition-all duration-300 hover:bg-surface-container-highest/60">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                    <span className="material-symbols-outlined text-sm">sync</span>
                  </div>
                  <span className="text-[12px] uppercase tracking-widest text-cyan-400">Syncro</span>
                </div>
                <div className="mb-5">
                  <h3 className="mb-2 text-[24px] text-on-surface">&quot;My desk · Facing Northwest&quot;</h3>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container/50 px-3 py-1.5">
                    <span className="material-symbols-outlined text-xs text-cyan-400">schedule</span>
                    <span className="text-sm text-on-surface-variant">Shen hour · 3:47 PM</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="rounded-lg border border-outline-variant bg-transparent px-5 py-2 text-[12px] text-on-surface transition-colors hover:bg-surface-container-highest">View</button>
                  <button className="rounded-lg border border-outline-variant bg-transparent px-5 py-2 text-[12px] text-on-surface transition-colors hover:bg-surface-container-highest">Re-read now</button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-20 text-center md:text-left">
          <button className="mx-auto flex items-center justify-center gap-2 py-2 text-[12px] text-on-surface-variant/50 transition-colors hover:text-error md:mx-0 md:justify-start">
            <span className="material-symbols-outlined text-sm">delete_forever</span>
            Wipe everything
          </button>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 z-50 flex w-full items-center justify-around rounded-t-2xl border-t border-white/10 bg-[#1E1E22]/60 px-4 pb-6 pt-3 shadow-[0_-10px_40px_rgba(139,92,246,0.15)] backdrop-blur-2xl md:hidden">
        <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
          <span className="material-symbols-outlined mb-1">inventory_2</span>
          <span className="text-[10px] uppercase tracking-tight">Vault</span>
        </a>
        <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
          <span className="material-symbols-outlined mb-1">auto_awesome</span>
          <span className="text-[10px] uppercase tracking-tight">Glyph</span>
        </a>
        <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
          <span className="material-symbols-outlined mb-1">sync</span>
          <span className="text-[10px] uppercase tracking-tight">Sync</span>
        </a>
        <a className="flex scale-105 flex-col items-center justify-center rounded-xl bg-violet-500/10 px-3 py-1 text-violet-400 duration-200" href="#">
          <span className="material-symbols-outlined mb-1">archive</span>
          <span className="text-[10px] uppercase tracking-tight">Archive</span>
        </a>
      </nav>
    </>
  );
}
