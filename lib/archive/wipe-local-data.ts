import { siteConfig } from "@/lib/config/site";

export function getDisclaimerStorageKey(): string {
  return `pojulife_disclaimer_${siteConfig.disclaimerVersion}`;
}

/**
 * 按文档：清空 IndexedDB + localStorage，仅保留免责确认标记。
 * 成功后由调用方跳转首页；可用 sessionStorage 触发一次性 Toast。
 */
export async function wipeAllLocalData(): Promise<void> {
  const disclaimerKey = getDisclaimerStorageKey();
  let disclaimerValue: string | null = null;
  try {
    disclaimerValue = localStorage.getItem(disclaimerKey);
  } catch {
    /* ignore */
  }

  try {
    localStorage.clear();
    if (disclaimerValue) localStorage.setItem(disclaimerKey, disclaimerValue);
  } catch {
    /* ignore */
  }

  try {
    if (typeof indexedDB !== "undefined" && indexedDB.databases) {
      const list = await indexedDB.databases();
      for (const db of list ?? []) {
        if (db.name) indexedDB.deleteDatabase(db.name);
      }
    }
  } catch {
    /* ignore */
  }

  try {
    sessionStorage.setItem("poju_archive_wiped_toast", "1");
  } catch {
    /* ignore */
  }
}
