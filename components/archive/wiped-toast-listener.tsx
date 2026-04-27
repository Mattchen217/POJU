"use client";

import { useEffect, useState } from "react";

/** 在 Archive 全量清除后回到营销页时，展示一次性成功提示 */
export function WipedToastListener() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem("poju_archive_wiped_toast")) return;
      sessionStorage.removeItem("poju_archive_wiped_toast");
      setOpen(true);
      const t = window.setTimeout(() => setOpen(false), 4500);
      return () => window.clearTimeout(t);
    } catch {
      /* ignore */
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-[220] max-w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-emerald-400/35 bg-emerald-950/90 px-4 py-3 text-center text-sm text-emerald-50 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
      role="status"
    >
      Everything wiped. You&apos;re starting fresh.
    </div>
  );
}
