export type ArchiveProductKind = "poju" | "oracle" | "syncro";

export type ArchiveEntry = {
  id: string;
  kind: ArchiveProductKind;
  title: string;
  subtitle?: string;
  createdAt: number;
  refId?: string;
};
