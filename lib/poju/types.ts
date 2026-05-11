import type { UserProfile } from "@/lib/profile/types";

export type PojuPhase = 1 | 2 | 3 | 4 | 5;
export type PojuStatus = "active" | "suspended" | "resolved" | "archived";

export type RenewalRecord = {
  at: number;
  days: number;
};

export type DataCollectionState = {
  name?: string;
  birthDate?: string;
  birthTime?: string;
  location?: string;
  relationshipStatus?: string;
  profession?: string;
};

export type AbuseMetrics = {
  messageCount: number;
  totalChars: number;
  blockedCount: number;
};

export type ActionItem = {
  id: string;
  title: string;
  status: "todo" | "doing" | "done" | "skipped";
  createdAt: number;
};

export type SessionMessage = {
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};

export type SessionState = {
  sessionId: string;
  deviceId: string;
  status: PojuStatus;
  phase: PojuPhase;
  title: string;
  createdAt: number;
  lastInteractionAt: number;
  expiresAt: number;
  renewals: RenewalRecord[];
  collection: DataCollectionState;
  userProfileId?: string;
  /** 用户在 Phase 2 选择「通用分析」，不强制 birth profile（Batch1 3.3 场景 1）。 */
  profileDeclined?: boolean;
  /** 首条用户问题锚点（Batch4 话题锁定）。 */
  originalQuestion?: string;
  topicKeywords?: string[];
  questionLockedAt?: number;
  actions: ActionItem[];
  messages: SessionMessage[];
  abuse: AbuseMetrics;
};

export type CreateSessionInput = {
  deviceId: string;
  userProfile?: UserProfile | null;
};

export type CreateSessionOutput = {
  sessionId: string;
  status: PojuStatus;
  phase: PojuPhase;
  expiresAt: number;
};

export type ChatInput = {
  sessionId: string;
  input: string;
  userProfile?: UserProfile | null;
};

export type ChatOutput = {
  sessionId: string;
  status: PojuStatus;
  phase: PojuPhase;
  reply: string;
  shouldArchive: boolean;
};
