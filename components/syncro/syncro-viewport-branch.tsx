"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { detectDevice } from "@/lib/device-detection";
import { SyncroDesktopBanner } from "@/components/syncro/syncro-desktop-banner";
import { SyncroIncompatible } from "@/components/syncro/syncro-incompatible";

type SyncroViewportBranchProps = {
  children: ReactNode;
};

/**
 * 路由级分支：桌面 → 顶部手机引导条 + 完整营销页；移动无罗盘 → 不兼容提示；否则渲染子内容。
 */
export function SyncroViewportBranch({ children }: SyncroViewportBranchProps) {
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<"desktop" | "no_compass" | "mobile">("mobile");

  useEffect(() => {
    const d = detectDevice();
    if (d.type === "desktop") setMode("desktop");
    else if (!d.hasCompass) setMode("no_compass");
    else setMode("mobile");
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-bg-deep" aria-hidden />;
  }

  if (mode === "no_compass") return <SyncroIncompatible />;
  return (
    <>
      {mode === "desktop" ? <SyncroDesktopBanner /> : null}
      {children}
    </>
  );
}
