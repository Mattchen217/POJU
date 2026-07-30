"use client";

import { Pencil } from "lucide-react";

type Props = {
  options: string[];
  busy?: boolean;
  onPick: (optionText: string) => void;
  /** Fill composer with option text for edit/supplement — does not send. */
  onEdit?: (optionText: string) => void;
  groupLabel?: string;
  editLabel?: string;
};

/** Reply chips inside the glass composer: tap body = send; pencil = edit. */
export function PojuReplyOptions({
  options,
  busy = false,
  onPick,
  onEdit,
  groupLabel = "Quick replies",
  editLabel = "Edit and add detail",
}: Props) {
  if (options.length < 2) return null;

  return (
    <div className="poju-option-cards" role="group" aria-label={groupLabel}>
      {options.map((opt, i) => (
        <div key={`${i}-${opt.slice(0, 24)}`} className="poju-option-row">
          <button
            type="button"
            className="poju-option-card"
            disabled={busy}
            onClick={() => onPick(opt)}
          >
            <span className="poju-option-card__text">{opt}</span>
          </button>
          {onEdit ? (
            <button
              type="button"
              className="poju-option-edit"
              disabled={busy}
              aria-label={editLabel}
              title={editLabel}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(opt);
              }}
            >
              <Pencil size={15} strokeWidth={1.5} aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
