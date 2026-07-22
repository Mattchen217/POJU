"use client";

import { Suspense } from "react";

import { useUiShell } from "@/components/workspace/use-ui-shell";

function UiShellSwitcherInner() {
  const { shell, setShell, ready } = useUiShell();

  if (!ready) return null;

  return (
    <div className="workspace-ui-switcher" role="group" aria-label="UI shell switcher">
      <button
        type="button"
        className={shell === "classic" ? "is-active" : undefined}
        aria-pressed={shell === "classic"}
        onClick={() => {
          setShell("classic");
          if (typeof window !== "undefined" && window.location.pathname.includes("/app")) {
            window.location.href = "/";
          } else {
            window.location.reload();
          }
        }}
      >
        Classic
      </button>
      <button
        type="button"
        className={shell === "workspace" ? "is-active" : undefined}
        aria-pressed={shell === "workspace"}
        onClick={() => {
          setShell("workspace");
          window.location.href = "/app?tab=atmos";
        }}
      >
        Workspace
      </button>
    </div>
  );
}

/** Floating Classic / Workspace control so the new shell stays reversible. */
export function UiShellSwitcher() {
  return (
    <Suspense fallback={null}>
      <UiShellSwitcherInner />
    </Suspense>
  );
}
