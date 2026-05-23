"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { MARKETING_LOCALE_OPTIONS } from "@/lib/i18n/marketing-locale-options";
import { cn } from "@/lib/utils/classnames";

type MobileDrawerProps = {
  open: boolean;
  onClose: () => void;
};

/** 高于 MOBILE_BAR_Z，保证菜单盖住页面与顶栏 */
const MOBILE_MENU_Z = 2_147_483_646;

/**
 * 移动端全屏菜单：Portal + fixed，不用 dialog（部分 iOS/WebKit 上 top layer / showModal 异常）。
 */
export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("nav");
  const tLang = useTranslations("language");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    open ? (
      <div className="md:hidden" aria-hidden={!open}>
        <div
          className="fixed inset-0 flex bg-black/55"
          style={{ zIndex: MOBILE_MENU_Z }}
          role="presentation"
        >
          <button
            type="button"
            className="min-h-[48px] min-w-0 flex-1 cursor-pointer touch-manipulation bg-transparent [-webkit-tap-highlight-color:transparent]"
            aria-label={t("mobileSheetClose")}
            onClick={onClose}
          />

          <aside
            className="flex h-[100dvh] max-h-[100dvh] w-[min(19rem,88vw)] shrink-0 flex-col border-l border-white/[0.09] bg-[#121217] shadow-[-8px_0_40px_rgba(0,0,0,0.35)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="site-mobile-nav-title"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <h2 id="site-mobile-nav-title" className="text-base font-semibold text-text-primary">
                {t("mobileSheetTitle")}
              </h2>
              <button
                type="button"
                className="touch-manipulation rounded-lg p-2 text-text-secondary transition-colors hover:bg-white/10 hover:text-text-primary [-webkit-tap-highlight-color:transparent]"
                aria-label={t("mobileSheetClose")}
                onClick={onClose}
              >
                <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
                  close
                </span>
              </button>
            </div>

            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">{t("mobileNavPrimary")}</p>
              <MobileNavLink href="/poju" onNavigate={onClose}>
                {t("poju")}
              </MobileNavLink>
              <MobileNavLink href="/glyph" onNavigate={onClose}>
                {t("glyph")}
              </MobileNavLink>
              <MobileNavLink href="/syncro" onNavigate={onClose}>
                {t("syncro")}
              </MobileNavLink>
              <MobileNavLink href="/match" onNavigate={onClose}>
                {t("match")}
              </MobileNavLink>
              <MobileNavLink href="/archive" onNavigate={onClose}>
                {t("archive")}
              </MobileNavLink>

              <hr className="my-3 border-white/[0.08]" />

              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">{t("mobileNavLegal")}</p>
              <MobileNavLink href="/disclaimer" onNavigate={onClose}>
                {t("disclaimer")}
              </MobileNavLink>
              <MobileNavLink href="/privacy" onNavigate={onClose}>
                {t("privacy")}
              </MobileNavLink>
              <MobileNavLink href="/terms" onNavigate={onClose}>
                {t("terms")}
              </MobileNavLink>
              <MobileNavLink href="/contact" onNavigate={onClose}>
                {t("contact")}
              </MobileNavLink>

              <hr className="my-3 border-white/[0.08]" />

              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-dim">{tLang("mobileSection")}</p>
              <ul className="flex flex-col gap-0.5">
                {MARKETING_LOCALE_OPTIONS.map(({ code, label }) => {
                  const active = code === locale;
                  return (
                    <li key={code}>
                      <Link
                        href={pathname}
                        locale={code}
                        replace
                        scroll={false}
                        prefetch={false}
                        className={cn(
                          "block touch-manipulation rounded-lg px-3 py-2.5 text-[15px] [-webkit-tap-highlight-color:transparent]",
                          active ? "bg-white/12 font-medium text-text-primary" : "text-text-secondary active:bg-white/8",
                        )}
                        aria-current={active ? "page" : undefined}
                        onClick={() => onClose()}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>
        </div>
      </div>
    ) : null,
    document.body,
  );
}

function MobileNavLink({
  href,
  children,
  onNavigate,
}: {
  href: "/poju" | "/glyph" | "/syncro" | "/match" | "/archive" | "/disclaimer" | "/privacy" | "/terms" | "/contact";
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="touch-manipulation rounded-lg px-3 py-2.5 text-[15px] text-text-primary [-webkit-tap-highlight-color:transparent] active:bg-white/10"
      onClick={() => onNavigate()}
    >
      {children}
    </Link>
  );
}
