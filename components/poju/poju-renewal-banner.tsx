"use client";

type Props = {
  expiresAt: number;
  extending: boolean;
  onExtend: () => void;
  onDismiss: () => void;
};

export function PojuRenewalBanner({ expiresAt, extending, onExtend, onDismiss }: Props) {
  const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-amber-400/35 bg-amber-950/40 px-4 py-3 text-sm text-amber-50/95 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className="font-semibold text-amber-100">Session renewal</span>
        <span className="text-amber-100/85"> · Active window ends in ~{days} day{days === 1 ? "" : "s"}. Extend 30 days anytime.</span>
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={extending}
          onClick={() => void onExtend()}
          className="rounded-full bg-amber-400/90 px-4 py-1.5 text-xs font-semibold text-neutral-900 disabled:opacity-50"
        >
          {extending ? "Extending…" : "Extend 30 days"}
        </button>
        <button type="button" onClick={onDismiss} className="rounded-full border border-white/20 px-3 py-1.5 text-xs text-amber-100/90">
          Later
        </button>
      </div>
    </div>
  );
}
