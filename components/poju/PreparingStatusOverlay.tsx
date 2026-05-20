import type { ReactNode } from "react";

/** Bottom status copy on top of the persistent preparing Spline scene (layout owns the canvas). */
export function PreparingStatusOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="preparing-spline-page__overlay" role="status" aria-live="polite">
      {children}
    </div>
  );
}
