"use client";

import dynamic from "next/dynamic";
import "@/styles/chart-loader.css";

const PreparingAnalyzingSpline = dynamic(
  () =>
    import("@/components/poju/PreparingAnalyzingSpline").then((m) => ({
      default: m.PreparingAnalyzingSpline,
    })),
  { ssr: false },
);

/**
 * Keeps the analyzing Spline scene mounted for the whole /preparing route.
 * Overlay copy lives in page.tsx — avoids enter/exit/enter flicker from remounting WebGL.
 */
export default function PreparingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="preparing-spline-page">
      <PreparingAnalyzingSpline className="preparing-spline-page__scene" />
      {children}
    </div>
  );
}
