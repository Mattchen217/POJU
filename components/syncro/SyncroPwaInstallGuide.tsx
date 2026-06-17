"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconCheck,
  IconShare2,
  IconSquareRoundedPlus,
} from "@tabler/icons-react";
import { useTranslations } from "next-intl";

import { PwaBrandMark } from "@/components/pwa/PwaBrandMark";
import "@/styles/pchat-scrollbar.css";
import "@/styles/pwa-gate.css";

type SyncroPwaInstallContextValue = {
  open: () => void;
  close: () => void;
};

const SyncroPwaInstallContext = createContext<SyncroPwaInstallContextValue | null>(null);

export function SyncroPwaInstallProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
    }),
    [],
  );

  return (
    <SyncroPwaInstallContext.Provider value={value}>
      {children}
      {open ? <SyncroPwaInstallModal onClose={value.close} /> : null}
    </SyncroPwaInstallContext.Provider>
  );
}

export function useSyncroPwaInstallGuide() {
  const ctx = useContext(SyncroPwaInstallContext);
  if (!ctx) {
    throw new Error("useSyncroPwaInstallGuide must be used within SyncroPwaInstallProvider");
  }
  return ctx;
}

export function SyncroPwaInstallTrigger({
  children,
  className,
  variant = "badge",
}: {
  children: ReactNode;
  className?: string;
  variant?: "badge" | "button";
}) {
  const { open } = useSyncroPwaInstallGuide();

  if (variant === "button") {
    return (
      <button type="button" onClick={open} className={className}>
        {children}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className={className ?? "product-hero__badge cursor-pointer transition hover:bg-amber-200/15 hover:shadow-[inset_0_0_0_0.5px_rgb(253_230_138_/_0.45)]"}
    >
      {children}
    </button>
  );
}

function InstallStep({
  icon,
  text,
}: {
  icon: ReactNode;
  text: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/8 text-[#d0bcff]">
        {icon}
      </div>
      <div className="min-w-0 pt-1 text-sm leading-relaxed text-[#e7e0ed]">{text}</div>
    </div>
  );
}

function PlatformGuide({
  label,
  browserNote,
  steps,
}: {
  label: string;
  browserNote: string;
  steps: { icon: ReactNode; text: ReactNode }[];
}) {
  return (
    <article className="rounded-2xl border border-white/12 bg-black/25 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200/90">{label}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#cbc3d7]">{browserNote}</p>
      <div className="mt-4 space-y-3">
        {steps.map((step, idx) => (
          <InstallStep key={idx} icon={step.icon} text={step.text} />
        ))}
      </div>
    </article>
  );
}

function SyncroPwaInstallModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("marketingSite.syncro.pwa_guide");
  const tIos = useTranslations("pwa.install.ios");
  const tAndroid = useTranslations("pwa.install.android");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100040] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 bg-[#0b0a10]/60 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="syncro-pwa-guide-title"
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-[#e9ddff]/18 border-b-0 bg-[#1a1820]/95 shadow-[0_-16px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[28px] sm:border-b"
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />

        <div className="pchat-scrollbar overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pb-8 sm:pt-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <PwaBrandMark size="lg" />
            <h2 id="syncro-pwa-guide-title" className="text-lg font-semibold text-[#f4f0fa] sm:text-xl">
              {t("title")}
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-[#cbc3d7]">{t("intro_lead")}</p>
            <p className="max-w-lg text-sm leading-relaxed text-[#cbc3d7]">{t("subtitle")}</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <PlatformGuide
              label={tIos("label")}
              browserNote={t("ios_browser_note")}
              steps={[
                {
                  icon: <IconShare2 size={18} aria-hidden />,
                  text: <span dangerouslySetInnerHTML={{ __html: tIos.raw("step_1") as string }} />,
                },
                {
                  icon: <IconSquareRoundedPlus size={18} aria-hidden />,
                  text: <span dangerouslySetInnerHTML={{ __html: tIos.raw("step_2") as string }} />,
                },
                {
                  icon: <IconCheck size={18} aria-hidden />,
                  text: <span dangerouslySetInnerHTML={{ __html: tIos.raw("step_3") as string }} />,
                },
                {
                  icon: (
                    <span className="material-symbols-outlined text-lg" aria-hidden>
                      home_app_logo
                    </span>
                  ),
                  text: t("ios_step_4"),
                },
              ]}
            />

            <PlatformGuide
              label={tAndroid("label_manual")}
              browserNote={t("android_browser_note")}
              steps={[
                {
                  icon: <IconShare2 size={18} aria-hidden />,
                  text: t("android_step_1"),
                },
                {
                  icon: <IconSquareRoundedPlus size={18} aria-hidden />,
                  text: t("android_step_2"),
                },
                {
                  icon: <IconCheck size={18} aria-hidden />,
                  text: t("android_step_3"),
                },
                {
                  icon: (
                    <span className="material-symbols-outlined text-lg" aria-hidden>
                      home_app_logo
                    </span>
                  ),
                  text: t("android_step_4"),
                },
              ]}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-full border border-white/15 py-3 text-sm font-medium text-[#cbc3d7] transition hover:bg-white/6 hover:text-[#f4f0fa]"
          >
            {t("close")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
