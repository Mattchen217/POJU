"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type ProfileSlotId = "a" | "b";

type Props = {
  value?: ProfileSlotId;
  onChange?: (slot: ProfileSlotId) => void;
  showAddAffordance?: boolean;
};

export function WorkspaceProfileSlotBar({
  value: controlled,
  onChange,
  showAddAffordance = true,
}: Props) {
  const t = useTranslations("workspace");
  const tDensity = useTranslations("workspace.density");
  const [internal, setInternal] = useState<ProfileSlotId>("a");
  const value = controlled ?? internal;

  function select(slot: ProfileSlotId) {
    if (controlled === undefined) setInternal(slot);
    onChange?.(slot);
  }

  return (
    <div className="workspace-profile-slot-bar">
      <div className="workspace-profile-slot-bar__chips" role="group" aria-label={t("profileSlot")}>
        <button
          type="button"
          className="workspace-profile-slot-bar__chip"
          aria-pressed={value === "a"}
          onClick={() => select("a")}
        >
          {t("slotA")}
        </button>
        <button
          type="button"
          className="workspace-profile-slot-bar__chip"
          aria-pressed={value === "b"}
          onClick={() => select("b")}
        >
          {t("slotB")}
        </button>
      </div>
      {showAddAffordance ? (
        <button type="button" className="workspace-add-slot-btn" disabled title={tDensity("addSlotSoon")}>
          {tDensity("addSlot")}
        </button>
      ) : null}
    </div>
  );
}
