"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useTranslations } from "next-intl";

import { routing } from "@/i18n/routing";

type SyncroDesktopQRModalProps = {
  onClose: () => void;
  url: string;
};

export function SyncroDesktopQRModal({ onClose, url }: SyncroDesktopQRModalProps) {
  const t = useTranslations("syncro.home.desktop_modal");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="syncro-desktop-qr-title"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-cyan-400/25 bg-bg-deep px-6 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-text-dim hover:bg-white/10 hover:text-text-primary"
          aria-label="Close"
        >
          ×
        </button>

        <h2 id="syncro-desktop-qr-title" className="pr-8 text-xl font-semibold text-text-primary">
          {t("title")}
        </h2>
        <p className="mt-3 text-sm leading-7 text-text-secondary">{t("description")}</p>

        <div className="mx-auto mt-6 inline-flex rounded-xl border border-white/12 bg-white p-3">
          <QRCodeCanvas value={url} size={200} bgColor="#ffffff" fgColor="#1a0a2e" level="M" />
        </div>

        <ol className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm leading-7 text-text-secondary">
          <li>{t("step_1")}</li>
          <li>{t("step_2")}</li>
          <li>{t("step_3")}</li>
        </ol>

        <p className="mt-6 text-xs leading-6 text-text-dim">{t("why_mobile")}</p>
      </div>
    </div>
  );
}

export function buildSyncroMobileUrl(locale: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://easternos.com");
  const path = locale === routing.defaultLocale ? "/syncro" : `/${locale}/syncro`;
  return `${base}${path}`;
}
