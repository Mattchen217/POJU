"use client";

export function SyncroIncompatible() {
  return (
    <main className="min-h-screen bg-bg-deep px-4 py-16 text-center text-text-body">
      <h1 className="text-2xl font-semibold text-text-primary">Compass unavailable</h1>
      <p className="mx-auto mt-4 max-w-md text-[15px] leading-8 text-text-secondary">
        This browser or device does not expose orientation events. Syncro needs a compass-capable phone with permission
        granted.
      </p>
    </main>
  );
}
