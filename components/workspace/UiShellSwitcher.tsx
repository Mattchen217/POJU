"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";

import { useUiShell } from "@/components/workspace/use-ui-shell";
import { isClassicLandingRoute, isHomeRoute } from "@/lib/i18n/pathname-without-locale";

function UiShellSwitcherInner() {
  const { shell, setShell, ready } = useUiShell();
  const pathname = usePathname();

  if (!ready) return null;

  const onClassic =
    shell === "classic" || isClassicLandingRoute(pathname);
  const onWorkspace =
    shell === "workspace" || (isHomeRoute(pathname) && !isClassicLandingRoute(pathname));

  return (
    <div className="workspace-ui-switcher" role="group" aria-label="UI shell switcher">
      <button
        type="button"
        className={onClassic ? "is-active" : undefined}
        aria-pressed={onClassic}
        onClick={() => {
          setShell("classic");
          window.location.href = "/classic";
        }}
      >
        Classic
      </button>
      <button
        type="button"
        className={onWorkspace && !onClassic ? "is-active" : undefined}
        aria-pressed={onWorkspace && !onClassic}
        onClick={() => {
          setShell("workspace");
          window.location.href = "/";
        }}
      >
        Workspace
      </button>
    </div>
  );
}

/** Floating Classic / Workspace control — Classic = `/classic`, Workspace = V2 `/`. */
export function UiShellSwitcher() {
  return (
    <Suspense fallback={null}>
      <UiShellSwitcherInner />
    </Suspense>
  );
}
