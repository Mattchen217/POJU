"use client";

import { Suspense } from "react";
import { GlyphReadingPage } from "@/components/glyph/GlyphReadingPage";
import "@/styles/glyph-home.css";

export default function GlyphReadingByIdPage() {
  return (
    <Suspense fallback={<div className="session-prep-loading">…</div>}>
      <GlyphReadingPage />
    </Suspense>
  );
}
