import type { ArchiveEntry } from "./types";

function dayOffset(refMs: number, daysAgo: number, hour: number, minute: number): number {
  const x = new Date(refMs);
  x.setDate(x.getDate() - daysAgo);
  x.setHours(hour, minute, 0, 0);
  return x.getTime();
}

function fmtMonthDay(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** 开发调 UI 用：覆盖多天、多产品；接 IndexedDB 后可删或改为仅 storybook。 */
export function buildMockArchiveEntries(refMs = Date.now()): ArchiveEntry[] {
  const t = (daysAgo: number, hour: number, minute: number) => dayOffset(refMs, daysAgo, hour, minute);

  // 这里我们将类型定义改为 any[] 数组，这是解决 Mock 数据复杂类型报错最简单、最彻底的方法
  const rows: any[] = [
    {
      id: "mock-p-today",
      kind: "poju",
      at: t(0, 9, 20),
      titleSuffix: "POJU",
      subtitle: `"Dad and I keep hitting the same wall…" · Still active · 12 messages`,
    },
    {
      id: "mock-o-today",
      kind: "oracle",
      at: t(0, 15, 40),
      titleSuffix: "Oracle",
      subtitle: `"About my decision to move…" · ✦ Calm Current · Sign of Flow`,
    },
    {
      id: "mock-s-yesterday",
      kind: "syncro",
      at: t(1, 8, 5),
      titleSuffix: "Syncro",
      subtitle: `"My desk" · Facing Northwest · Shen hour · 3:47 PM · Newark, DE`,
    },
    {
      id: "mock-p-yesterday",
      kind: "poju",
      at: t(1, 21, 10),
      titleSuffix: "POJU",
      subtitle: `"Should I take the offer…" · Archived · 6 messages`,
    },
    {
      id: "mock-o-week",
      kind: "oracle",
      at: t(3, 11, 0),
      titleSuffix: "Oracle",
      subtitle: `"Relationship timing…" · ✦ Bright Edge · Sign of Crossing`,
    },
    {
      id: "mock-s-week",
      kind: "syncro",
      at: t(5, 18, 30),
      titleSuffix: "Syncro",
      subtitle: `"书房角落" · Facing Southeast · You hour · 2:12 PM · Seattle, WA`,
    },
    {
      id: "mock-p-week2",
      kind: "poju",
      at: t(6, 7, 45),
      titleSuffix: "POJU",
      subtitle: `"Two paths, one deadline…" · Still active · 3 messages`,
    },
    {
      id: "mock-o-month",
      kind: "oracle",
      at: t(12, 20, 15),
      titleSuffix: "Oracle",
      subtitle: `"Career vs family pull…" · ✦ Quiet Root · Sign of Holding`,
    },
    {
      id: "mock-p-month",
      kind: "poju",
      at: t(18, 13, 0),
      titleSuffix: "POJU",
      subtitle: `"What am I not seeing…" · Archived · 24 messages`,
    },
    {
      id: "mock-s-earlier",
      kind: "syncro",
      at: t(40, 10, 0),
      titleSuffix: "Syncro",
      subtitle: `"Living room window" · Facing South · Si hour · 10:20 AM · Austin, TX`,
    },
    {
      id: "mock-p-earlier",
      kind: "poju",
      at: t(55, 16, 50),
      titleSuffix: "POJU",
      subtitle: `"Same pattern again…" · Archived · 9 messages`,
    },
    {
      id: "mock-o-earlier",
      kind: "oracle",
      at: t(88, 6, 30),
      titleSuffix: "Oracle (3-Sign Reading)",
      subtitle: `"Long-term commitment…" · Linked with POJU session · View spread`,
    },
  ];

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAt: r.at,
    title: `${fmtMonthDay(r.at)} · ${r.titleSuffix}`,
    subtitle: r.subtitle,
  }));
}

export function shouldShowArchiveMockData(): boolean {
  const v = process.env.NEXT_PUBLIC_ARCHIVE_MOCK;
  if (v === "0" || v === "false") return false;
  if (v === "1" || v === "true") return true;
  return process.env.NODE_ENV === "development";
}