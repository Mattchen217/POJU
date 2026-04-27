"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

export function PaymentCancelToast() {
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const from = useMemo(() => params.get("from") ?? "landing_retry", [params]);
  const cancelled = params.get("cancelled") === "true";

  useEffect(() => {
    if (!cancelled) return;
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, [cancelled]);

  useEffect(() => {
    if (!cancelled) return;
    try {
      const next = new URL(window.location.href);
      next.searchParams.delete("cancelled");
      if (!next.searchParams.get("from")) {
        next.searchParams.set("from", from);
      }
      const query = next.searchParams.toString();
      window.history.replaceState({}, "", `${next.pathname}${query ? `?${query}` : ""}`);
    } catch {
      // ignore
    }
  }, [cancelled, from]);

  if (!open) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[220] w-[min(92vw,520px)] -translate-x-1/2 md:top-6">
      <div className="pointer-events-auto rounded-2xl border border-purple-vivid/35 bg-bg-layer-1/90 px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md sm:px-5">
        <p className="text-sm text-text-primary">
          <span className="font-semibold">✦ Payment cancelled.</span> No charge was made.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <a
            href={`/poju?retry=1&from=${encodeURIComponent(from)}`}
            className="inline-flex rounded-full border border-[#7b5cff] bg-[#6d4dff] px-4 py-2 text-xs font-semibold text-white hover:bg-[#7a5dff]"
          >
            Try again
          </a>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex rounded-full px-3 py-2 text-xs text-text-secondary hover:bg-white/5 hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
