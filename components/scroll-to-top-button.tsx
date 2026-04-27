"use client";

import { useCallback, useEffect, useState } from "react";

const SHOW_AFTER_PX = 360;

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  const update = useCallback(() => {
    setVisible(typeof window !== "undefined" && window.scrollY > SHOW_AFTER_PX);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [update]);

  const goTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={goTop}
      className="fixed bottom-6 right-5 z-[90] flex h-11 w-11 items-center justify-center rounded-full border border-white/14 bg-bg-layer-1/85 text-text-primary shadow-[0_8px_28px_rgba(0,0,0,0.4)] backdrop-blur-md transition hover:border-purple-vivid/35 hover:bg-bg-layer-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-vivid/50 sm:bottom-8 sm:right-8"
      aria-label="Back to top"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d="M6 14l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
