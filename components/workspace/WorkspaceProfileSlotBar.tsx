"use client";

import { useState } from "react";

export type ProfileSlotId = "a" | "b";

type Props = {
  value?: ProfileSlotId;
  onChange?: (slot: ProfileSlotId) => void;
  /** Reserved affordance — presentational only; no pricing logic. */
  showAddAffordance?: boolean;
};

/**
 * Placeholder Profile Slot A / B selector for engine canvases.
 * Local UI state only — not wired to profile store yet.
 */
export function WorkspaceProfileSlotBar({
  value: controlled,
  onChange,
  showAddAffordance = true,
}: Props) {
  const [internal, setInternal] = useState<ProfileSlotId>("a");
  const value = controlled ?? internal;

  function select(slot: ProfileSlotId) {
    if (controlled === undefined) setInternal(slot);
    onChange?.(slot);
  }

  return (
    <div className="workspace-profile-slot-bar">
      <div className="workspace-profile-slot-bar__chips" role="group" aria-label="Profile slot">
        <button
          type="button"
          className="workspace-profile-slot-bar__chip"
          aria-pressed={value === "a"}
          onClick={() => select("a")}
        >
          Slot A · Primary
        </button>
        <button
          type="button"
          className="workspace-profile-slot-bar__chip"
          aria-pressed={value === "b"}
          onClick={() => select("b")}
        >
          Slot B · Secondary
        </button>
      </div>
      {showAddAffordance ? (
        <span className="workspace-profile-slot-bar__add" aria-hidden>
          + $9.99
        </span>
      ) : null}
    </div>
  );
}
