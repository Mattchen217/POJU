"use client";

import { useEffect, useMemo, useState } from "react";
import { usePwaInstall } from "@/components/pwa/pwa-install-context";
import { isMobileUserAgent, isPwaStandalone } from "@/lib/pwa/detect";
import type { PwaInstallPersona } from "@/lib/pwa/types";

function titleFor(persona: PwaInstallPersona): string {
  if (persona === "android") return "需要添加到主屏幕后才能使用";
  if (persona === "ios_safari" || persona === "ios_other") return "请先添加到主屏幕再使用";
  return "请使用已安装的应用打开";
}

export function ForceHomeScreenGate() {
  const { persona, clientReady, standalone, requestInstall, refreshStandalone } = usePwaInstall();
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!clientReady) return;
    setActive(isMobileUserAgent() && !standalone);
  }, [clientReady, standalone]);

  const title = useMemo(() => titleFor(persona), [persona]);

  if (!clientReady || !active) return null;

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center bg-[#0b0a10]/95 px-4 text-text-body backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#1e1e22] p-5">
        <p className="text-lg font-semibold text-text-primary">{title}</p>

        {persona === "android" ? (
          <>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              点击下方按钮尝试系统安装。若未弹出安装窗口，可在引导中下载 APK。
            </p>
            <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
              <p>也可手动操作：菜单（⋮）→ 安装应用 / 添加到主屏幕</p>
            </div>
          </>
        ) : persona === "ios_safari" || persona === "ios_other" ? (
          <>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              点击「查看安装步骤」将显示分享按钮位置示意与操作说明。
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-text-secondary">当前设备请从桌面图标打开本站。</p>
        )}

        {status ? <p className="mt-2 text-xs text-cyan-100/90">{status}</p> : null}

        <div className="mt-5 grid gap-2">
          {persona === "android" || persona === "ios_safari" || persona === "ios_other" ? (
            <button
              type="button"
              onClick={() => void requestInstall()}
              className="w-full rounded-full border border-[#e9ddff]/30 bg-[#a078ff] py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#340080]"
            >
              {persona === "android" ? "立即安装" : "查看安装步骤"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              refreshStandalone();
              if (isPwaStandalone()) {
                setActive(false);
                setStatus("");
              } else {
                setStatus("尚未检测到主屏幕模式，请从桌面图标打开。");
              }
            }}
            className="w-full rounded-full border border-white/15 py-3 text-xs font-medium uppercase tracking-[0.05em] text-text-secondary"
          >
            我已添加，重新检测
          </button>
        </div>
      </div>
    </div>
  );
}
