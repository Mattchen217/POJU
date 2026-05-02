"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/classnames";

const tabs = [
  { href: "/", label: "⌂" },
  { href: "/poju", label: "POJU" },
  { href: "/syncro", label: "SYNCRO" },
  { href: "/glyph", label: "GLYPH" },
  { href: "/archive", label: "✦" },
];

export function PwaTabbar() {
  const pathname = usePathname();
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  if (!standalone) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-glass-border bg-bg-layer-1/95 px-2 py-2 backdrop-blur-xl md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 gap-1 text-center text-xs">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              className={cn(
                "block rounded-full py-2 text-text-secondary",
                pathname === tab.href && "bg-purple-primary/25 text-text-primary",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
