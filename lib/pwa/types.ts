export type BeforeInstallPromptEvent = Event & {
  preventDefault: () => void;
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type PwaInstallPersona =
  | "ios_safari"
  | "ios_other"
  | "mac_safari"
  | "mac_chromium"
  | "mac_other"
  | "android"
  | "win_chromium"
  | "linux_chromium"
  | "desktop_chromium"
  | "desktop_other"
  | "unknown";
