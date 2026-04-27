"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

export function ModalPwaInstallPageClient() {
  const router = useRouter();

  const handleLater = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  return (
    <main className="relative flex min-h-[max(884px,100dvh)] items-center justify-center overflow-hidden bg-[#0f0d15] font-['Inter'] text-[#e7e0ed] antialiased">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="flex h-full w-full scale-[1.02] flex-col gap-4 bg-[#211e27]/50 p-6 opacity-40 blur-[8px]">
          <div className="flex items-center justify-between border-b border-[#494454]/30 pb-4">
            <div className="h-8 w-8 rounded-full bg-[#37333d]" />
            <div className="h-6 w-24 rounded-full bg-[#37333d]" />
            <div className="h-8 w-8 rounded-full bg-[#37333d]" />
          </div>
          <div className="mt-4 flex flex-1 flex-col gap-6">
            <div className="h-24 w-3/4 self-start rounded-2xl rounded-tl-sm bg-[#2c2832]" />
            <div className="h-16 w-2/3 self-end rounded-2xl rounded-tr-sm border border-[#d0bcff]/10 bg-[#a078ff]/20" />
            <div className="h-20 w-1/2 self-start rounded-2xl rounded-tl-sm bg-[#2c2832]" />
          </div>
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--tw-gradient-stops))] from-[#a078ff]/10 via-transparent to-[#0f0d15]/90" />
      </div>

      <div className="fixed inset-0 z-40 bg-[#0f0d15]/80 backdrop-blur-md" />

      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col pb-safe md:relative md:bottom-auto">
        <div className="relative flex flex-col gap-8 overflow-hidden rounded-t-[32px] border border-[#e9ddff]/20 border-b-0 bg-[#1e1e22]/60 p-6 pt-4 shadow-[0_-10px_40px_rgba(160,120,255,0.15)] backdrop-blur-[24px] md:rounded-[32px] md:border-b">
          <div className="absolute left-0 right-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#e9ddff]/40 to-transparent" />
          <div className="mx-auto h-1.5 w-12 shrink-0 rounded-full bg-[#494454]" />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#e9ddff]/30 bg-gradient-to-br from-[#6d3bd7] to-[#a078ff] shadow-[0_0_24px_rgba(160,120,255,0.3)]">
                <span className="font-['Manrope'] text-[24px] font-black uppercase tracking-widest text-[#3c0091]">P</span>
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="font-['Manrope'] text-[24px] font-semibold leading-[1.4] text-[#e7e0ed]">
                  Add POJU to your home screen
                </h2>
                <p className="mx-auto max-w-[280px] text-[16px] leading-[1.6] text-[#cbc3d7]">
                  Experience the Oracle as a native app.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-[#494454]/30 bg-[#1d1a23]/50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">fullscreen</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">Full-screen experience.</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">web_asset_off</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">No browser bars.</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">wifi_off</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">Works offline.</span>
              </div>
            </div>

            <div className="flex flex-col gap-5 px-1">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e9ddff]/30 bg-[#a078ff]/20">
                  <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#e9ddff]">1</span>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] leading-relaxed text-[#e7e0ed]">
                    Tap the <strong className="font-semibold text-[#e9ddff]">Share</strong> icon
                    <span className="mx-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#494454]/50 bg-[#211e27] align-middle shadow-sm">
                      <span className="material-symbols-outlined text-[18px] text-[#e9ddff]">ios_share</span>
                    </span>
                    in your browser&apos;s toolbar.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#e9ddff]/30 bg-[#a078ff]/20">
                  <span className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#e9ddff]">2</span>
                </div>
                <div className="flex-1">
                  <p className="text-[15px] leading-relaxed text-[#e7e0ed]">
                    Scroll down and tap
                    <span className="mx-1 inline-flex items-center gap-1.5 rounded-md border border-[#494454]/50 bg-[#211e27] px-2.5 py-1 align-middle shadow-sm">
                      <span className="text-[13px] font-semibold text-[#e9ddff]">Add to Home Screen</span>
                      <span className="material-symbols-outlined text-[16px] text-[#e9ddff]">add_box</span>
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <button className="w-full rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[#340080] shadow-[0_0_20px_rgba(160,120,255,0.25)] hover:bg-[#6d3bd7] hover:text-white">
                Got it
              </button>
              <button
                type="button"
                onClick={handleLater}
                className="w-full rounded-full py-4 text-[12px] font-medium uppercase tracking-[0.05em] text-[#cbc3d7] hover:bg-[#1d1a23]/50 hover:text-[#e7e0ed]"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
