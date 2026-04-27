"use client";

export function DisclaimerBackButton() {
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  if (!canGoBack) return null;

  return (
    <button
      type="button"
      onClick={() => window.history.back()}
      className="print:hidden inline-flex items-center gap-1 rounded-lg border border-white/12 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:border-white/20"
      aria-label="Go back"
    >
      <span aria-hidden>←</span> Back
    </button>
  );
}
