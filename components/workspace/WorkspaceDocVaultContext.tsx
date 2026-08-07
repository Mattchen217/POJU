"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";

import { ARCHIVE_UPDATED_EVENT } from "@/lib/archive/runtime-archive";
import { LOCAL_OWNER_CHANGED_EVENT } from "@/lib/storage/local-owner";
import {
  countDocVaultBySection,
  groupDocVaultBySection,
  listDocVaultItems,
} from "@/lib/workspace/doc-vault-index";
import { markDocVaultRead } from "@/lib/workspace/doc-vault-unread";
import {
  DOC_VAULT_UPDATED_EVENT,
  type DocVaultItem,
  type DocVaultSection,
} from "@/lib/workspace/doc-vault-types";
import { DOC_VAULT_UNREAD_CHANGED_EVENT } from "@/lib/workspace/doc-vault-unread";

export type DocVaultOpenHandlers = {
  /** Switch workspace tab if needed, then open artifact. */
  openItem: (item: DocVaultItem) => void | Promise<void>;
  /** Scroll/focus a section when collapsed icon is clicked. */
  focusSection?: (section: DocVaultSection) => void;
};

type DocVaultApi = {
  items: DocVaultItem[];
  grouped: Record<DocVaultSection, DocVaultItem[]>;
  counts: Record<DocVaultSection, number>;
  loading: boolean;
  refresh: () => Promise<void>;
  openItem: (item: DocVaultItem) => void;
  setOpenHandlers: (handlers: DocVaultOpenHandlers | null) => void;
};

const WorkspaceDocVaultContext = createContext<DocVaultApi | null>(null);

export function WorkspaceDocVaultProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [items, setItems] = useState<DocVaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** Ref — registering open handlers must not re-render / recreate context value. */
  const handlersRef = useRef<DocVaultOpenHandlers | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listDocVaultItems(locale);
      setItems(next);
    } catch (e) {
      console.error("[doc-vault] list failed:", e);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onChange = () => {
      void refresh();
    };
    window.addEventListener(DOC_VAULT_UPDATED_EVENT, onChange);
    window.addEventListener(DOC_VAULT_UNREAD_CHANGED_EVENT, onChange);
    window.addEventListener(ARCHIVE_UPDATED_EVENT, onChange);
    window.addEventListener(LOCAL_OWNER_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(DOC_VAULT_UPDATED_EVENT, onChange);
      window.removeEventListener(DOC_VAULT_UNREAD_CHANGED_EVENT, onChange);
      window.removeEventListener(ARCHIVE_UPDATED_EVENT, onChange);
      window.removeEventListener(LOCAL_OWNER_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  const setOpenHandlers = useCallback((next: DocVaultOpenHandlers | null) => {
    handlersRef.current = next;
  }, []);

  const openItem = useCallback((item: DocVaultItem) => {
    markDocVaultRead(item.id);
    void handlersRef.current?.openItem(item);
  }, []);

  const grouped = useMemo(() => groupDocVaultBySection(items), [items]);
  const counts = useMemo(() => countDocVaultBySection(items), [items]);

  const value = useMemo<DocVaultApi>(
    () => ({
      items,
      grouped,
      counts,
      loading,
      refresh,
      openItem,
      setOpenHandlers,
    }),
    [items, grouped, counts, loading, refresh, openItem, setOpenHandlers],
  );

  return (
    <WorkspaceDocVaultContext.Provider value={value}>{children}</WorkspaceDocVaultContext.Provider>
  );
}

export function useWorkspaceDocVault(): DocVaultApi {
  const ctx = useContext(WorkspaceDocVaultContext);
  if (!ctx) {
    throw new Error("useWorkspaceDocVault must be used within WorkspaceDocVaultProvider");
  }
  return ctx;
}

export function useWorkspaceDocVaultOptional(): DocVaultApi | null {
  return useContext(WorkspaceDocVaultContext);
}
