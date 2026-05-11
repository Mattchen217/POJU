"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IosSafariInstallContent } from "@/components/pwa/ios-safari-install-content";

export type PwaInstallGuideKind =
  | "ios"
  | "mac"
  | "mac_chromium"
  | "windows_chromium"
  | "android_fallback"
  | "android_manual"
  | "generic"
  | null;

type PwaInstallGuideLayerProps = {
  kind: PwaInstallGuideKind;
  onClose: () => void;
  androidApkUrl: string;
};

const zOverlay = "z-[100040]";

function GuideBackdrop({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="关闭"
      className={`fixed inset-0 ${zOverlay} bg-[#0b0a10]/55 backdrop-blur-md transition-opacity`}
      onClick={onClose}
    />
  );
}

function BottomSheet({
  children,
  onClose,
  hideDefaultClose = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  hideDefaultClose?: boolean;
}) {
  return (
    <div
      className={`fixed inset-x-0 bottom-0 ${zOverlay} flex max-h-[min(92dvh,640px)] flex-col justify-end p-0 sm:inset-x-auto sm:left-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2`}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative mx-auto w-full rounded-t-[28px] border border-[#e9ddff]/18 border-b-0 bg-[#1a1820]/92 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-b-[28px] sm:border-b">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/25" />
        {children}
        {hideDefaultClose ? null : (
          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-full py-3 text-sm font-medium text-[#cbc3d7] transition hover:bg-white/6 hover:text-[#f4f0fa]"
          >
            知道了
          </button>
        )}
      </div>
    </div>
  );
}

export function PwaInstallGuideLayer({ kind, onClose, androidApkUrl }: PwaInstallGuideLayerProps) {
  useEffect(() => {
    if (!kind || typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [kind]);

  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [kind, onClose]);

  if (!kind || typeof document === "undefined") return null;

  const portal = (
    <>
      <GuideBackdrop onClose={onClose} />

      {kind === "ios" ? (
        <BottomSheet onClose={onClose} hideDefaultClose>
          <IosSafariInstallContent onLater={onClose} />
        </BottomSheet>
      ) : null}

      {kind === "mac" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">添加到程序坞</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            在 Safari 顶部菜单栏点选
            <strong className="text-[#e9ddff]"> 文件 </strong>
            （File）→
            <strong className="text-[#e9ddff]"> 添加到程序坞 </strong>
            （Add to Dock），即可像 App 一样固定本站。
          </p>
          <p className="mt-3 text-center text-xs text-white/45">若菜单为英文：File → Add to Dock</p>
        </BottomSheet>
      ) : null}

      {kind === "mac_chromium" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">在 Mac 上安装本站</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            在 <strong className="text-[#e9ddff]">Chrome / Edge</strong>{" "}
            中，优先查看地址栏右侧是否出现<strong className="text-[#e9ddff]">安装</strong>或
            <strong className="text-[#e9ddff]">电脑图标</strong>。
          </p>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#cbc3d7]">
            若没有图标，可点击右上角 <strong className="text-[#e9ddff]">⋮</strong> 菜单，查找
            <strong className="text-[#e9ddff]">安装 pojulife…</strong>、
            <strong className="text-[#e9ddff]">安装应用</strong> 或
            <strong className="text-[#e9ddff]">保存并分享 → 将页面添加到程序坞</strong>（不同版本文案可能略有差异）。
          </p>
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed text-amber-100/95">
            若你<strong>刚卸载</strong>过本应用：当前标签页可能还没重新收到浏览器的安装信号。请点下方
            <strong>刷新页面</strong>，或关掉标签后重新打开本站，再点安装。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 w-full rounded-full border border-[#e9ddff]/35 bg-[#7c3aed] py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition hover:bg-[#6d28d9]"
          >
            刷新页面并重试
          </button>
        </BottomSheet>
      ) : null}

      {kind === "windows_chromium" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">在 Windows 上安装本站</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            在 <strong className="text-[#e9ddff]">Chrome / Edge</strong>{" "}
            中，查看地址栏右侧是否出现<strong className="text-[#e9ddff]">安装</strong>按钮或
            <strong className="text-[#e9ddff]">应用</strong>图标，点击即可安装。
          </p>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#cbc3d7]">
            也可点击右上角 <strong className="text-[#e9ddff]">⋯</strong> 或{" "}
            <strong className="text-[#e9ddff]">⋮</strong> →{" "}
            <strong className="text-[#e9ddff]">应用</strong> / <strong className="text-[#e9ddff]">Apps</strong> →{" "}
            <strong className="text-[#e9ddff]">安装此站点</strong> /{" "}
            <strong className="text-[#e9ddff]">Install this site as an app</strong>。
          </p>
          <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed text-amber-100/95">
            <strong>为什么卸载后再点安装只有提示、没有系统弹窗？</strong>
            <br />
            浏览器会在<strong>新的页面加载周期</strong>里才再次派发 <code className="text-[10px] text-white/80">beforeinstallprompt</code>
            。若你<strong>没关标签页</strong>就卸载了应用，当前页往往<strong>还没收到</strong>这条事件，我们只能先显示手动说明。
            <br />
            请先<strong>刷新本页</strong>（或 Ctrl+Shift+R 硬刷新），或关闭标签重新打开网站，再点安装；多数情况下安装按钮会恢复。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 w-full rounded-full border border-[#e9ddff]/35 bg-[#7c3aed] py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] transition hover:bg-[#6d28d9]"
          >
            刷新页面并重试
          </button>
        </BottomSheet>
      ) : null}

      {kind === "android_fallback" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">未能唤起系统安装</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            可尝试 Chrome 菜单中的「安装应用 / 添加到主屏幕」，或使用下方 APK 安装包。
          </p>
          {androidApkUrl ? (
            <a
              href={androidApkUrl}
              className="mt-4 flex w-full items-center justify-center rounded-full border border-[#e9ddff]/35 bg-[#a078ff] py-3.5 text-sm font-bold uppercase tracking-wide text-[#2a0066] shadow-[0_0_24px_rgba(160,120,255,0.35)]"
              target="_blank"
              rel="noreferrer"
            >
              下载 APK
            </a>
          ) : (
            <p className="mt-3 text-center text-xs text-amber-200/90">未配置 APK 下载地址（NEXT_PUBLIC_ANDROID_APK_URL）。</p>
          )}
        </BottomSheet>
      ) : null}

      {kind === "android_manual" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">在 Android 上安装</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            在 Chrome 中点击右上角 <strong className="text-[#e9ddff]">⋮</strong>，选择
            <strong className="text-[#e9ddff]">安装应用</strong> 或{" "}
            <strong className="text-[#e9ddff]">添加到主屏幕</strong>。
          </p>
          {androidApkUrl ? (
            <a
              href={androidApkUrl}
              className="mt-4 flex w-full items-center justify-center rounded-full border border-[#e9ddff]/35 bg-[#a078ff] py-3.5 text-sm font-bold uppercase tracking-wide text-[#2a0066] shadow-[0_0_24px_rgba(160,120,255,0.35)]"
              target="_blank"
              rel="noreferrer"
            >
              或直接下载 APK
            </a>
          ) : (
            <p className="mt-3 text-center text-xs text-amber-200/90">
              若需 APK 直链，请在部署环境配置 NEXT_PUBLIC_ANDROID_APK_URL。
            </p>
          )}
        </BottomSheet>
      ) : null}

      {kind === "generic" ? (
        <BottomSheet onClose={onClose}>
          <h2 className="text-center text-lg font-semibold text-[#f4f0fa]">安装到设备</h2>
          <p className="mt-2 text-center text-sm leading-relaxed text-[#cbc3d7]">
            请使用浏览器地址栏的安装图标，或通过菜单中的「安装应用 / 添加到主屏幕」完成安装。
          </p>
        </BottomSheet>
      ) : null}
    </>
  );

  return createPortal(portal, document.body);
}
