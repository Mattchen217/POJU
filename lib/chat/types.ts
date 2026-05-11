export type SessionStatus = "active" | "suspended" | "resolved" | "archived";

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  hidden: boolean;
  status: SessionStatus;
  pdfSaves: number;
};

export type MessageRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  sessionId: string;
  role: MessageRole;
  text: string;
  createdAt: number;
  voice?: boolean;
  imageDataUrl?: string;
  summon?: "syncro" | "oracle";
  phaseFive?: boolean;
};

export type DrawerKind = "syncro" | "oracle";
