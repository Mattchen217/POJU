"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "next/navigation";
import { PojuLogo } from "@/components/ui/poju-logo";
import { cn } from "@/lib/utils/classnames";
import { MobileDrawer } from "@/components/layout/mobile-drawer";

const navItems = [
  { href: "/poju", label: "POJU" },
  { href: "/glyph", label: "Glyph" },
  { href: "/syncro", label: "Syncro" },
  { href: "/archive", label: "Archive" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  return (
    <header
      className={cn(
        "sticky top-0 z-30",
        isHome
          ? "border-b border-white/5 bg-[#090d19]/72 backdrop-blur-md"
          : "border-b border-glass-border bg-bg-deep/85 backdrop-blur-xl",
      )}
    >
      <div className={cn("mx-auto flex max-w-6xl items-center justify-between px-4 md:px-6", isHome ? "py-2.5" : "py-3")}>
        <PojuLogo />
        <nav className={cn("hidden items-center uppercase md:flex", isHome ? "gap-5 text-[10px] tracking-[0.16em]" : "gap-7 text-[11px] tracking-[0.18em]")}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-text-secondary hover:bg-white/5 hover:text-purple-vivid",
                pathname === item.href && "bg-purple-primary/20 text-text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          aria-label="Open menu"
          className="rounded-full border border-glass-border px-3 py-1 text-sm md:hidden"
          onClick={() => setOpen(true)}
        >
          ≡
        </button>
      </div>
      <MobileDrawer open={open} onClose={() => setOpen(false)} />
    </header>
  );
}
