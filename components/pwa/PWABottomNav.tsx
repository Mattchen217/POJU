"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";
import { ArchiveNavLabel } from "@/components/archive/ArchiveUnreadDot";
import { useArchiveUnread } from "@/components/archive/use-archive-unread";
import { getPathnameWithoutLocale } from "@/lib/i18n/pathname-without-locale";
import {
  getWorkspaceHref,
  parseWorkspaceTab,
  type WorkspaceTab,
} from "@/lib/ui-shell/resolve-ui-shell";

import "@/styles/pwa-nav.css";

const TABS = [
  { id: "poju" as const, name: "POJU", path: "/poju", workspaceTab: "poju" as WorkspaceTab },
  { id: "glyph" as const, name: "Glyph", path: "/glyph", workspaceTab: "glyph" as WorkspaceTab },
  { id: "match" as const, name: "Match", path: "/match", workspaceTab: "match" as WorkspaceTab },
  { id: "syncro" as const, name: "Syncro", path: "/syncro", workspaceTab: "syncro" as WorkspaceTab },
  { id: "archive" as const, name: "Archive", path: "/archive", workspaceTab: "archive" as WorkspaceTab },
];

export function PWABottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("nav");
  const { hasUnread: hasUnreadArchive } = useArchiveUnread();

  const path = getPathnameWithoutLocale(pathname);
  const workspaceTab =
    path === "/app" || path.startsWith("/app/")
      ? parseWorkspaceTab(searchParams.get("tab"))
      : null;

  function isActive(tab: (typeof TABS)[number]): boolean {
    if (workspaceTab) return workspaceTab === tab.workspaceTab;
    if (tab.id === "archive") return path === "/archive" || path.startsWith("/archive/");
    return path === tab.path || path.startsWith(`${tab.path}/`);
  }

  function navigateTo(tab: (typeof TABS)[number]) {
    /** Installed / app-mode users should never land on classic V1 product marketing. */
    if (tab.id === "archive") {
      router.push("/archive");
      return;
    }
    router.push(getWorkspaceHref(tab.workspaceTab));
  }

  return (
    <nav className="pwa-bottom-nav" aria-label="Product navigation">
      {TABS.map((tab) => {
        const active = isActive(tab);
        const label = tab.id === "archive" ? t("archive") : tab.name;

        return (
          <button
            key={tab.id}
            type="button"
            className={`nav-product ${active ? "active" : ""}`}
            onClick={() => navigateTo(tab)}
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
