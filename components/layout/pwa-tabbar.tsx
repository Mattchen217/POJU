"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/classnames";
import { isHomeRoute, isWorkspaceAppRoute } from "@/lib/i18n/pathname-without-locale";

const tabs = [
  { href: "/app?tab=atmos", label: "⌂" },
  { href: "/app?tab=poju", label: "POJU" },
  { href: "/app?tab=glyph", label: "Glyph" },
  { href: "/app?tab=syncro", label: "Syncro" },
  { href: "/app?tab=match", label: "Match" },
  { href: "/archive", label: "✦" },
];

export function PwaTabbar() {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    // Desktop PWA uses website UI — no mobile tab bar (only narrow standalone).
    const narrow = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setStandalone(
        window.matchMedia("(display-mode: standalone)").matches && narrow.matches,
      );
    };
    sync();
    narrow.addEventListener("change", sync);
    return () => narrow.removeEventListener("change", sync);
  }, []);

  if (!standalone) return null;
  if (isWorkspaceAppRoute(pathname)) return null;
  if (isHomeRoute(pathname)) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-glass-border bg-bg-layer-1/95 px-2 py-2 backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-6 gap-1 text-center text-xs">
        {tabs.map((tab) => {
          const active = tab.href.startsWith("/app")
            ? pathname.includes("/app")
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "block rounded-full py-2 text-text-secondary",
                  active && "bg-purple-primary/25 text-text-primary",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
