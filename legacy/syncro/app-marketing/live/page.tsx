import { SyncroGuardedRoute } from "@/components/syncro/SyncroGuardedRoute";
import { SyncroMobileFlow } from "@/components/syncro/syncro-mobile-flow";
import { Suspense } from "react";

export default function SyncroLivePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[100dvh] items-center justify-center bg-black px-4 text-sm text-zinc-400">
          Loading Syncro…
        </main>
      }
    >
      <SyncroGuardedRoute>
        <SyncroMobileFlow />
      </SyncroGuardedRoute>
    </Suspense>
  );
}
