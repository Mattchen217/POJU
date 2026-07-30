"use client";

type Props = {
  options: string[];
  busy?: boolean;
  onPick: (optionText: string) => void;
  groupLabel?: string;
};

/** Inline reply chips under an assistant bubble (not a modal). */
export function PojuReplyOptions({
  options,
  busy = false,
  onPick,
  groupLabel = "Quick replies",
}: Props) {
  if (options.length < 2) return null;

  return (
    <div className="poju-option-cards" role="group" aria-label={groupLabel}>
      {options.map((opt, i) => (
        <button
          key={`${i}-${opt.slice(0, 24)}`}
          type="button"
          className="poju-option-card"
          disabled={busy}
          onClick={() => onPick(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
