"use client";

/**
 * V2 workspace landing — loads the Stitch HTML verbatim via /v2-landing.
 * Edit d:\POJU\v2落地页.html (preferred) or docs/visual-reference/v2-workspace-landing.html.
 */
export function V2WorkspaceLandingPage() {
  return (
    <iframe
      src="/v2-landing"
      title="Eastern OS — Cognitive Velocity"
      className="fixed inset-0 z-[1] h-[100dvh] w-screen border-0 bg-[#05070a]"
    />
  );
}
