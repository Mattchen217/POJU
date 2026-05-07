import type { Metadata } from "next";

import { ArchiveRuntimePreview } from "@/components/archive/archive-runtime-preview";
import { WipeEverythingButton } from "@/components/archive/wipe-everything-button";

export const metadata: Metadata = {
  title: "The Archive — pojulife",
  description:
    "Everything here lives only on this device. Your POJU sessions, Glyph reflections, and Syncro readings in one local vault.",
};

export default function ArchivePage() {
  return (
    <main className="bg-bg-deep text-text-body">
      <div className="w-full px-3 pb-10 pt-4 sm:px-4 sm:pt-6 md:px-6 md:pb-12">
        <section className="relative mx-auto mt-2 w-full max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-[#15121b] text-[#e7e0ed]">
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(139,92,246,0.15),transparent_60%)]" />

          <div className="relative z-10 w-full max-w-4xl px-6 pb-32 pt-8 md:pb-12 md:pt-12">
            <div className="mb-10 text-center md:text-left">
              <h1 className="mb-2 font-['Manrope'] text-[40px] font-bold leading-[1.2] tracking-[-0.02em] text-[#d0bcff]">
                ✦ THE ARCHIVE.
              </h1>
              <p className="font-['Inter'] text-[18px] leading-[1.6] text-[#cbc3d7]/70">
                Everything here lives only on this device.
              </p>
            </div>

            <div className="space-y-12">
              <ArchiveRuntimePreview />
            </div>

            <div className="mt-20 text-center md:text-left">
              <WipeEverythingButton />
            </div>
          </div>

          <nav className="fixed bottom-0 left-0 z-40 flex w-full items-center justify-around rounded-t-2xl border-t border-white/10 bg-[#1E1E22]/60 px-4 pb-6 pt-3 backdrop-blur-2xl md:hidden">
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">inventory_2</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Vault</span>
            </a>
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">auto_awesome</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Glyph</span>
            </a>
            <a className="flex flex-col items-center justify-center px-3 py-1 text-white/30 transition-all hover:bg-white/5" href="#">
              <span className="material-symbols-outlined mb-1">sync</span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Sync</span>
            </a>
            <a className="flex scale-105 flex-col items-center justify-center rounded-xl bg-violet-500/10 px-3 py-1 text-violet-400 duration-200" href="#">
              <span className="material-symbols-outlined mb-1" style={{ fontVariationSettings: "'FILL' 1" }}>
                archive
              </span>
              <span className="font-['Manrope'] text-[10px] font-medium uppercase tracking-tight">Archive</span>
            </a>
          </nav>
        </section>
      </div>
    </main>
  );
}
