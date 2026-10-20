"use client";

import { useTranslations } from "next-intl";

type Props = {
  onLater: () => void;
};

/**
 * macOS Safari “Add to Dock” (Sonoma 14+).
 * Must not reuse iOS Share-sheet steps — Mac menu bar / toolbar Share differ.
 */
export function MacSafariInstallContent({ onLater }: Props) {
  const t = useTranslations("pwa.install.mac");

  return (
    <>
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-[#8b5cf6] via-[#7c3aed] to-[#312e81] shadow-[0_0_24px_rgba(139,92,246,0.45)]">
          <span className="material-symbols-outlined text-3xl text-white" aria-hidden>
            desktop_mac
          </span>
        </div>
        <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">{t("title")}</h2>
        <p className="text-center text-sm leading-relaxed text-[#cbc3d7]">{t("subtitle")}</p>
      </div>

      <div className="mt-4 space-y-3 rounded-2xl border border-white/12 bg-black/25 p-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            1
          </span>
          <p
            className="text-sm leading-relaxed text-[#e7e0ed]"
            dangerouslySetInnerHTML={{ __html: t.raw("step1") as string }}
          />
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            2
          </span>
          <p
            className="text-sm leading-relaxed text-[#e7e0ed]"
            dangerouslySetInnerHTML={{ __html: t.raw("step2") as string }}
          />
        </div>
        <div className="flex items-start gap-3">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/8 text-xs font-bold text-white">
            3
          </span>
          <p
            className="text-sm leading-relaxed text-[#e7e0ed]"
            dangerouslySetInnerHTML={{ __html: t.raw("step3") as string }}
          />
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-white/45">{t("hint")}</p>

      <button
        type="button"
        onClick={onLater}
        className="mt-5 w-full rounded-full border border-white/15 py-3 text-sm font-medium text-[#cbc3d7] transition hover:bg-white/6 hover:text-[#f4f0fa]"
      >
        {t("later")}
      </button>
    </>
  );
}
