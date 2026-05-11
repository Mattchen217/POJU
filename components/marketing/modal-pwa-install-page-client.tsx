"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { IosSafariInstallContent } from "@/components/pwa/ios-safari-install-content";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isPwaStandalone } from "@/lib/pwa/detect";
import type { PwaInstallPersona } from "@/lib/pwa/types";

function titleForPersona(persona: PwaInstallPersona): string {
  if (persona === "ios_safari" || persona === "ios_other") return "请先添加到主屏幕";
  if (persona === "android") return "安装 Android 应用";
  if (persona === "mac_safari") return "将本站添加到程序坞";
  if (persona === "mac_chromium" || persona === "mac_other") return "将本站安装到桌面";
  if (persona === "win_chromium" || persona === "linux_chromium" || persona === "desktop_chromium") {
    return "安装桌面应用";
  }
  return "安装到设备";
}

function subtitleForPersona(persona: PwaInstallPersona, hasApk: boolean): string {
  if (persona === "ios_safari" || persona === "ios_other") {
    return "点击下方安装按钮查看分步引导；完成后从桌面图标进入。";
  }
  if (persona === "android") {
    return hasApk
      ? "优先尝试系统安装；若未弹出安装窗口，可使用 APK 备选下载。"
      : "点击下方按钮尝试系统安装，或按浏览器菜单手动添加到主屏幕。";
  }
  if (persona === "mac_safari") {
    return "点击安装查看 Safari 菜单操作说明。";
  }
  if (persona === "mac_chromium" || persona === "mac_other") {
    return "点击安装：将尝试系统安装提示；若无提示，将显示 Chrome / Edge 操作说明。";
  }
  if (persona === "win_chromium" || persona === "linux_chromium" || persona === "desktop_chromium") {
    return "点击安装：将尝试系统安装提示；若无提示，将显示浏览器安装步骤。";
  }
  return "点击安装，按屏幕提示完成。";
}

export function ModalPwaInstallPageClient() {
  const router = useRouter();
  const { requestInstall, refreshStandalone, persona, clientReady, standalone, androidApkUrl } =
    usePwaInstall();
  const [status, setStatus] = useState("");

  const nextPath = useMemo(() => {
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("next") ?? "/"
        : "/";
    return raw.startsWith("/") ? raw : "/";
  }, []);

  const handleContinue = useCallback(() => {
    refreshStandalone();
    if (isPwaStandalone()) {
      window.location.assign(nextPath);
      return;
    }
    setStatus("尚未检测到主屏幕模式。请先完成安装，再从桌面图标进入。");
  }, [nextPath, refreshStandalone]);

  const handleLater = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  const title = titleForPersona(persona);
  const subtitle = subtitleForPersona(persona, Boolean(androidApkUrl));

  useEffect(() => {
    if (!clientReady || !standalone) return;
    window.location.replace(nextPath);
  }, [clientReady, standalone, nextPath]);

  if (clientReady && standalone) {
    return <main className="min-h-[100dvh] bg-[#0f0d15]" />;
  }

  if (clientReady && (persona === "ios_safari" || persona === "ios_other")) {
    return (
      <main className="relative min-h-[100dvh] bg-[#0f0d15] font-['Inter'] text-[#e7e0ed] antialiased">
        <div className="fixed inset-0 z-40 bg-[#0f0d15]/80 backdrop-blur-md" aria-hidden />
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col pb-safe">
          <div className="relative mx-auto w-full rounded-t-[28px] border border-[#e9ddff]/18 border-b-0 bg-[#1a1820]/92 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-b-[28px] sm:border-b">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
            <IosSafariInstallContent onLater={handleLater} />
          </div>
        </div>
      </main>
    );
  }

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
                <h2 className="font-['Manrope'] text-[24px] font-semibold leading-[1.4] text-[#e7e0ed]">{title}</h2>
                <p className="mx-auto max-w-[280px] text-[16px] leading-[1.6] text-[#cbc3d7]">{subtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-[#494454]/30 bg-[#1d1a23]/50 p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">fullscreen</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">全屏体验</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">web_asset_off</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">更少浏览器栏干扰</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#494454]/20 bg-[#211e27]">
                  <span className="material-symbols-outlined text-[18px] text-[#d0bcff]">wifi_off</span>
                </div>
                <span className="text-[16px] leading-[1.6] text-[#cbc3d7]">离线可用</span>
              </div>
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => void requestInstall()}
                className="w-full rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-4 text-[12px] font-bold uppercase tracking-[0.08em] text-[#340080] shadow-[0_0_20px_rgba(160,120,255,0.25)] hover:bg-[#6d3bd7] hover:text-white"
              >
                安装
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="w-full rounded-full border border-white/15 py-4 text-[12px] font-medium uppercase tracking-[0.05em] text-[#cbc3d7] hover:bg-[#1d1a23]/50 hover:text-[#e7e0ed]"
              >
                我已完成，继续
              </button>
              <button
                type="button"
                onClick={handleLater}
                className="w-full rounded-full py-4 text-[12px] font-medium uppercase tracking-[0.05em] text-[#888] hover:text-[#cbc3d7]"
              >
                稍后再说
              </button>
              {androidApkUrl && persona === "android" ? (
                <p className="px-1 text-center text-[11px] leading-relaxed text-white/40">
                  若系统安装失败，安装引导中会提供 APK 下载。
                </p>
              ) : null}
              {status ? <p className="px-1 text-center text-xs text-cyan-100/90">{status}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
