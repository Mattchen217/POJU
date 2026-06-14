"use client";

import { useTranslations } from "next-intl";

import { usePathname, useRouter } from "@/i18n/navigation";
import { ArchiveNavLabel } from "@/components/archive/ArchiveUnreadDot";
import { useArchiveUnread } from "@/components/archive/use-archive-unread";
import { getActiveNavFromPathname } from "@/lib/i18n/pathname-without-locale";

import "@/styles/pwa-nav.css";

const TABS = [
  { id: "poju" as const, name: "POJU", path: "/poju" },
  { id: "glyph" as const, name: "Glyph", path: "/glyph" },
  { id: "match" as const, name: "Match", path: "/match" },
  { id: "syncro" as const, name: "Syncro", path: "/syncro" },
  { id: "archive" as const, name: "Archive", path: "/archive" },
];

export function PWABottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const { hasUnread: hasUnreadArchive } = useArchiveUnread();

  const activeTab = getActiveNavFromPathname(pathname);

  function navigateTo(path: string) {
    router.push(path);
  }

  return (
    <nav className="pwa-bottom-nav" aria-label="Product navigation">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        const label = tab.id === "archive" ? t("archive") : tab.name;

        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-product ${active ? "active" : ""}`}
            onClick={() => navigateTo(tab.path)}
            aria-current={active ? "page" : undefined}
          >
            {tab.id === "archive" ? (
              <ArchiveNavLabel
                label={label}
                showDot={hasUnreadArchive}
                className="archive-nav-label--pwa"
              />
            ) : (
              label
            )}
          </button>
        );
      })}
    </nav>
  );
}
