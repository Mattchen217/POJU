"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { WorkspaceFollowLandingLocale } from "@/components/workspace/WorkspaceFollowLandingLocale";
import { useUiShell } from "@/components/workspace/use-ui-shell";
import { ResumePendingCheckout } from "@/components/auth/ResumePendingCheckout";
import { WorkspaceCheckoutConfirm } from "@/components/account/WorkspaceCheckoutConfirm";
import { parseWorkspaceTab } from "@/lib/ui-shell/resolve-ui-shell";
import { useRouter } from "@/i18n/navigation";

function WorkspaceAppInner() {
  const searchParams = useSearchParams();
  const { shell, ready } = useUiShell();
  const router = useRouter();
  const tab = parseWorkspaceTab(searchParams.get("tab"));

  useEffect(() => {
    if (!ready) return;
    if (shell === "classic") {
      router.replace("/");
    }
  }, [ready, shell, router]);

  if (!ready || shell === "classic") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--ws-bg,#07070e)] text-sm text-[var(--ws-text-secondary,#9a9cae)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <>
      <WorkspaceFollowLandingLocale />
      <ResumePendingCheckout />
      <WorkspaceCheckoutConfirm />
      <WorkspaceShell initialTab={tab} />
    </>
  );
}

export default function WorkspaceAppPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--ws-bg,#07070e)] text-sm text-[var(--ws-text-secondary,#9a9cae)]">
          Loading workspace…
        </div>
      }
    >
      <WorkspaceAppInner />
    </Suspense>
  );
}
