"use client";

import { type ReactNode, Suspense } from "react";

import { SyncroMobileGuard } from "@/components/syncro/SyncroMobileGuard";

type SyncroGuardedRouteProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

function DefaultFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep text-text-secondary">…</div>
  );
}

export function SyncroGuardedRoute({ children, fallback }: SyncroGuardedRouteProps) {
  return (
    <Suspense fallback={fallback ?? <DefaultFallback />}>
      <SyncroMobileGuard>{children}</SyncroMobileGuard>
    </Suspense>
  );
}
