"use client";

type Props = {
  onLater: () => void;
};

/** Shared English steps for “Add to Home Screen” on iPhone Safari (used in sheet + full-page modal). */
export function IosSafariInstallContent({ onLater }: Props) {
  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#312e81] shadow-[0_0_24px_rgba(139,92,246,0.45)]">
          <span className="text-2xl font-black text-white">P</span>
        </div>
        <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">Install Eastern OS on your Home Screen</h2>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/12 bg-black/25 p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            1
          </span>
          <p className="text-sm leading-relaxed text-[#e7e0ed]">
            Tap the <strong>Share</strong> button at the bottom of Safari.
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 align-middle">
              <span className="material-symbols-outlined text-base text-[#d0bcff]">ios_share</span>
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            2
          </span>
          <p className="text-sm leading-relaxed text-[#e7e0ed]">
            Scroll down to find <strong>Add to Home Screen</strong>.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            3
          </span>
          <p className="text-sm leading-relaxed text-[#e7e0ed]">
            Tap <strong>Add to Home Screen</strong> and confirm.
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 align-middle">
              <span className="material-symbols-outlined text-base text-[#d0bcff]">add_box</span>
            </span>
          </p>
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            4
          </span>
          <p className="text-sm leading-relaxed text-[#e7e0ed]">
            Exit Safari, then open the <strong>Eastern OS</strong> icon from your Home Screen.
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/20 align-middle">
              <span className="material-symbols-outlined text-base text-[#d0bcff]">home_app_logo</span>
            </span>
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onLater}
        className="mt-5 w-full rounded-full border border-white/15 py-3 text-sm font-medium text-[#cbc3d7] transition hover:bg-white/6 hover:text-[#f4f0fa]"
      >
        Later
      </button>
    </>
  );
}
