"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { getPublicAndroidApkUrl } from "@/lib/pwa/android-apk";
import { getPwaInstallPersona, isPwaStandalone } from "@/lib/pwa/detect";
import type { BeforeInstallPromptEvent, PwaInstallPersona } from "@/lib/pwa/types";
import { PwaInstallGuideLayer, type PwaInstallGuideKind } from "@/components/pwa/pwa-install-guide-layer";

type PromptResult =
  | { outcome: "accepted" | "dismissed"; platform: string }
  | { outcome: "no-prompt" }
  | { outcome: "error"; message: string };

type PwaInstallContextValue = {
  clientReady: boolean;
  standalone: boolean;
  persona: PwaInstallPersona;
  deferredPrompt: BeforeInstallPromptEvent | null;
  canUseNativeInstall: boolean;
  promptNativeInstall: () => Promise<PromptResult>;
  androidApkUrl: string;
  refreshStandalone: () => void;
  installGuide: PwaInstallGuideKind;
  closeInstallGuide: () => void;
  requestInstall: () => Promise<void>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

function waitForDeferredPrompt(ref: RefObject<BeforeInstallPromptEvent | null>, maxMs: number) {
  const step = 50;
  const end = Date.now() + maxMs;
  return new Promise<boolean>((resolve) => {
    const tick = () => {
      if (ref.current) {
        resolve(true);
        return;
      }
      if (Date.now() >= end) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, step);
    };
    tick();
  });
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [clientReady, setClientReady] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [persona, setPersona] = useState<PwaInstallPersona>("unknown");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installGuide, setInstallGuide] = useState<PwaInstallGuideKind>(null);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const androidApkUrl = getPublicAndroidApkUrl();

  const refreshStandalone = useCallback(() => {
    setStandalone(isPwaStandalone());
  }, []);

  const closeInstallGuide = useCallback(() => setInstallGuide(null), []);

  useEffect(() => {
    setClientReady(true);
    setStandalone(isPwaStandalone());
    setPersona(getPwaInstallPersona());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const e = event as BeforeInstallPromptEvent;
      deferredPromptRef.current = e;
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      setStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const mqStandalone = window.matchMedia("(display-mode: standalone)");
    const mqFullscreen = window.matchMedia("(display-mode: fullscreen)");
    const onDisplayMode = () => setStandalone(isPwaStandalone());
    mqStandalone.addEventListener("change", onDisplayMode);
    mqFullscreen.addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      mqStandalone.removeEventListener("change", onDisplayMode);
      mqFullscreen.removeEventListener("change", onDisplayMode);
    };
  }, []);

  const runDeferredPrompt = useCallback(async (): Promise<PromptResult> => {
    const e = deferredPromptRef.current;
    if (!e) return { outcome: "no-prompt" };
    try {
      await e.prompt();
      const choice = await e.userChoice;
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") setStandalone(true);
      return choice;
    } catch (err) {
      const message = err instanceof Error ? err.message : "prompt failed";
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      return { outcome: "error", message };
    }
  }, []);

  const promptNativeInstall = useCallback(async () => runDeferredPrompt(), [runDeferredPrompt]);

  const requestInstall = useCallback(async () => {
    if (!clientReady || standalone) return;

    /** 卸载 PWA 后浏览器常延迟数秒才再次派发 beforeinstallprompt；桌面端多等一会 */
    const bipWaitMs =
      persona === "win_chromium" ||
      persona === "linux_chromium" ||
      persona === "desktop_chromium" ||
      persona === "mac_chromium"
        ? 12_000
        : 4500;

    if (!deferredPromptRef.current) {
      await waitForDeferredPrompt(deferredPromptRef, bipWaitMs);
    }

    if (deferredPromptRef.current) {
      const r = await runDeferredPrompt();
      if (
        (r.outcome === "dismissed" || r.outcome === "error") &&
        persona === "android" &&
        androidApkUrl
      ) {
        setInstallGuide("android_fallback");
      }
      return;
    }

    if (persona === "ios_safari" || persona === "ios_other") {
      setInstallGuide("ios");
      return;
    }
    if (persona === "mac_safari") {
      setInstallGuide("mac");
      return;
    }
    if (persona === "mac_chromium" || persona === "mac_other") {
      setInstallGuide("mac_chromium");
      return;
    }
    if (persona === "win_chromium") {
      setInstallGuide("windows_chromium");
      return;
    }
    if (persona === "linux_chromium") {
      setInstallGuide("windows_chromium");
      return;
    }
    if (persona === "android") {
      if (androidApkUrl) setInstallGuide("android_fallback");
      else setInstallGuide("android_manual");
      return;
    }
    if (persona === "desktop_chromium") {
      setInstallGuide("windows_chromium");
      return;
    }
    setInstallGuide("generic");
  }, [clientReady, standalone, persona, androidApkUrl, runDeferredPrompt]);

  const value = useMemo<PwaInstallContextValue>(
    () => ({
      clientReady,
      standalone,
      persona,
      deferredPrompt,
      canUseNativeInstall: deferredPrompt !== null,
      promptNativeInstall,
      androidApkUrl,
      refreshStandalone,
      installGuide,
      closeInstallGuide,
      requestInstall,
    }),
    [
      clientReady,
      standalone,
      persona,
      deferredPrompt,
      promptNativeInstall,
      androidApkUrl,
      refreshStandalone,
      installGuide,
      closeInstallGuide,
      requestInstall,
    ],
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      {clientReady ? (
        <PwaInstallGuideLayer kind={installGuide} onClose={closeInstallGuide} androidApkUrl={androidApkUrl} />
      ) : null}
    </PwaInstallContext.Provider>
  );
}

export function usePwaInstall(): PwaInstallContextValue {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) {
    throw new Error("usePwaInstall must be used within PwaInstallProvider");
  }
  return ctx;
}

export type { PwaInstallGuideKind } from "@/components/pwa/pwa-install-guide-layer";
