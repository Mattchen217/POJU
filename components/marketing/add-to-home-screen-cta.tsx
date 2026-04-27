"use client";

import { useEffect, useMemo, useState } from "react";

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function AddToHomeScreenCta({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const tip = useMemo(() => {
    if (isStandalone()) return "App already installed on this device.";
    if (deferredPrompt) return "Tap Got it to trigger system install.";
    if (isIosSafari()) return "iPhone: tap Share, then Add to Home Screen.";
    return "If no system prompt appears, use browser menu -> Add to Home Screen.";
  }, [deferredPrompt]);

  const handleGotIt = async () => {
    if (isStandalone()) {
      setStatus("Already installed.");
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setStatus(choice.outcome === "accepted" ? "Installation started." : "Install dismissed.");
      if (choice.outcome === "accepted") setOpen(false);
      return;
    }

    if (isIosSafari()) {
      setStatus("Please use Safari Share -> Add to Home Screen.");
      return;
    }

    setStatus("Use browser menu to add this app to your home screen.");
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        Add to Home Screen
      </button>

      {open ? (
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1e1e22]/95 p-5 text-left">
            <p className="text-lg font-semibold text-text-primary">Add POJU to your home screen</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">{tip}</p>
            {status ? <p className="mt-2 text-xs text-cyan-100/90">{status}</p> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleGotIt()}
                className="flex-1 rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#340080]"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-full border border-white/15 py-2.5 text-xs font-medium uppercase tracking-[0.05em] text-text-secondary"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

