"use client";

import { useEffect, useMemo, useState } from "react";

type DeferredPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function ForceHomeScreenGate() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [active, setActive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPromptEvent | null>(null);
  const [status, setStatus] = useState("");
  const [showManualAndroidSteps, setShowManualAndroidSteps] = useState(false);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    setActive(isMobileDevice() && !isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    const onAppInstalled = () => {
      setActive(false);
      setStatus("");
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const title = useMemo(() => {
    if (platform === "android") return "需要添加到主屏幕后才能使用";
    if (platform === "ios") return "请先添加到主屏幕再使用";
    return "请使用桌面应用模式打开";
  }, [platform]);

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) {
      setStatus("当前浏览器未提供系统安装弹窗，请按下方手动步骤添加。");
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setStatus("已发起安装。请从桌面图标重新打开应用。");
      // 浏览器通常不允许脚本强制关闭页面，这里尽量引导退出当前页。
      window.setTimeout(() => {
        window.location.href = "about:blank";
      }, 1200);
    } else {
      setStatus("未安装，当前无法继续使用。");
    }
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-[#0b0a10]/95 px-4 text-text-body">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1e1e22] p-5">
        <p className="text-lg font-semibold text-text-primary">{title}</p>

        {platform === "android" ? (
          <>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              检测到安卓设备。必须先安装到主屏幕，才能正常使用本网站功能。
            </p>
            {!deferredPrompt || showManualAndroidSteps ? (
              <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                <p>1) 点击浏览器右上角菜单（⋮）</p>
                <p>
                  2) 选择
                  <span className="mx-1 rounded border border-white/20 px-2 py-0.5 text-xs">添加到主屏幕</span>
                  或
                  <span className="mx-1 rounded border border-white/20 px-2 py-0.5 text-xs">安装应用</span>
                </p>
                <p>3) 从桌面图标重新打开 POJU</p>
              </div>
            ) : null}
            {status ? <p className="mt-2 text-xs text-cyan-100/90">{status}</p> : null}
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => void handleAndroidInstall()}
                className="w-full rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#340080]"
              >
                马上添加
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowManualAndroidSteps(true);
                  setStatus("请按手动步骤添加到主屏幕后，再点“我已添加，重新检测”。");
                }}
                className="w-full rounded-full border border-white/15 py-3 text-xs font-medium uppercase tracking-[0.05em] text-text-secondary"
              >
                我自己手动添加
              </button>
              {!deferredPrompt ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isStandaloneMode()) {
                      setActive(false);
                    } else {
                      setStatus("尚未检测到主屏幕模式，请从桌面图标打开。");
                    }
                  }}
                  className="w-full rounded-full border border-white/15 py-3 text-xs font-medium uppercase tracking-[0.05em] text-text-secondary"
                >
                  我已添加，重新检测
                </button>
              ) : null}
            </div>
          </>
        ) : platform === "ios" ? (
          <>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              iPhone/iPad 需要手动添加到主屏幕。完成前无法继续使用。
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p>
                1) 点击 Safari 底部分享按钮
                <span className="mx-1 inline-flex h-6 w-6 items-center justify-center rounded border border-white/20 align-middle">
                  <span className="material-symbols-outlined text-[16px]">ios_share</span>
                </span>
              </p>
              <p>
                2) 选择
                <span className="mx-1 rounded border border-white/20 px-2 py-0.5 text-xs">Add to Home Screen</span>
              </p>
              <p>3) 从桌面图标重新打开 POJU</p>
            </div>
            {status ? <p className="mt-2 text-xs text-cyan-100/90">{status}</p> : null}
            <button
              type="button"
              onClick={() => {
                if (isStandaloneMode()) {
                  setActive(false);
                } else {
                  setStatus("尚未检测到主屏幕模式，请从桌面图标打开。");
                }
              }}
              className="mt-5 w-full rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#340080]"
            >
              我已添加，重新检测
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">当前设备不在支持范围，请使用手机并添加到主屏幕后访问。</p>
        )}
      </div>
    </div>
  );
}

