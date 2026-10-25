"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";

import { GlyphPrepareProfilePage } from "@/components/glyph/GlyphPrepareProfilePage";

function GlyphPreparingInner() {
  const params = useParams();
  const profileId = typeof params.profileId === "string" ? params.profileId : "";
  if (!profileId) return null;
  return <GlyphPrepareProfilePage profileId={profileId} />;
}

export default function GlyphPreparingRoutePage() {
  return (
    <Suspense fallback={null}>
      <GlyphPreparingInner />
    </Suspense>
  );
}
