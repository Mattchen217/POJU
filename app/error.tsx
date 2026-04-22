"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-4">
      <div className="poju-glass-card max-w-md p-6 text-center">
        <h2 className="text-xl font-semibold text-text-primary">Something in the signal is unclear.</h2>
        <p className="mt-2 text-sm text-text-secondary">{error.message}</p>
        <button type="button" className="poju-button-primary mt-5" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
