import type { SessionState } from "@/lib/poju/types";
import type { UserProfile } from "@/lib/profile/types";

/** 将已保存的 user_profile 写入 session 采集字段，便于 Phase 2 快速满足完成条件。 */
export function applyUserProfileToSession(session: SessionState, profile: UserProfile): void {
  session.userProfileId = profile.id;
  const b = profile.birth;
  session.collection.birthDate =
    session.collection.birthDate ??
    `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  const minute = b.minute ?? 0;
  session.collection.birthTime =
    session.collection.birthTime ?? `${String(b.hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  if (!session.collection.location?.trim()) {
    const loc =
      b.city?.trim() ||
      (b.latitude != null && b.longitude != null ? `${b.latitude},${b.longitude}` : undefined) ||
      "On file";
    session.collection.location = loc;
  }
  session.collection.name = session.collection.name?.trim() || "Saved profile";
}

export function isDataCollectionComplete(session: SessionState): boolean {
  const c = session.collection;
  return !!(c.birthDate && c.birthTime && c.location?.trim() && c.name?.trim());
}

/** Batch1 3.3 / Batch2 6.2：用户跳过表单或已填完硬性字段，即可离开 Phase 2。 */
export function canLeavePhase2(session: SessionState): boolean {
  if (session.profileDeclined) return true;
  return isDataCollectionComplete(session);
}
