export type ArchiveProductKind = "poju" | "oracle" | "syncro";

/** Legacy oracle rows use Dexie sign records; Glyph full-reading rows use IndexedDB `oracle_entries` via refId. */
export type OracleArchiveRowVariant = "sign" | "full_reading";

export type ArchiveEntry = {
  id: string;
  kind: ArchiveProductKind;
  title: string;
  subtitle?: string;
  createdAt: number;
  refId?: string;
  oracleVariant?: OracleArchiveRowVariant;
};
