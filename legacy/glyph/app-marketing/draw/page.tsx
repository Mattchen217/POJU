"use client";

import { Suspense } from "react";
import { GlyphDrawPage } from "@/components/glyph/GlyphDrawPage";
import "@/styles/glyph-home.css";
import "@/styles/chart-loader.css";

export default function GlyphDrawRoutePage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <GlyphDrawPage />
    </Suspense>
  );
}
