/**
 * Delivery shelf slot mapping.
 *   pnpm exec tsx scripts/test-delivery-shelf-slots.ts
 */
import {
  buildDeliveryShelfSlots,
  DELIVERY_SHELF_SLOT_COUNT,
  nextSequentialProseGap,
  sequentialDeliveryProseReady,
  splitShelfTitle,
} from "@/lib/poju/delivery-shelf-slots";

const failures: string[] = [];
function assert(label: string, ok: boolean) {
  if (!ok) failures.push(label);
  console.log(`  [${ok ? "PASS" : "FAIL"}] ${label}`);
}

const md = `# Cover

blurb

## 目录

1. 序言

## 序言 · 关于这份报告

Hello.
`;

const slots = buildDeliveryShelfSlots(md, { locale: "zh", complete: false });
assert("12 slots", slots.length === DELIVERY_SHELF_SLOT_COUNT);
assert("cover ready", slots[0]?.kind === "ready" && slots[0].slotId === "cover");
assert("toc ready", slots[1]?.kind === "ready");
assert("preface ready", slots[2]?.kind === "ready");
assert("waiting on next", slots[3]?.kind === "waiting" && slots[3].pageNumber === 2);
assert("preface is prose page 1", slots[2]?.kind === "ready" && slots[2].pageNumber === 1);

{
  // Simulate buffered gap: preface + later segment ready, middle empty.
  const gapped = slots.map((s) => ({ ...s }));
  // Force slot 4 ready without filling slot 3 (waiting).
  if (gapped[4] && (gapped[4].kind === "empty" || gapped[4].kind === "waiting")) {
    gapped[4] = {
      kind: "ready",
      slotId: gapped[4].slotId,
      pageNumber: gapped[4].pageNumber,
      page: {
        id: gapped[4].slotId,
        title: "buffered",
        body: "x",
        dualLayer: true,
      },
    };
  }
  const seq = sequentialDeliveryProseReady(gapped);
  assert("sequential stops at gap", seq.length === 1 && seq[0]?.slotId === "preface");
  const gap = nextSequentialProseGap(gapped);
  assert("gap is next sequential", gap?.pageNumber === 2);
}

const done = buildDeliveryShelfSlots(md, { locale: "zh", complete: true });
assert("no waiting when complete", done.every((s) => s.kind !== "waiting"));

const empty = buildDeliveryShelfSlots("", { locale: "en", complete: false });
assert(
  "empty starts waiting on cover (not a prose page)",
  empty[0]?.kind === "waiting" && empty[0].slotId === "cover" && empty[0].pageNumber === 0,
);

const prefaceSplit = splitShelfTitle("序言 · 关于这份报告");
assert("preface primary", prefaceSplit.primary === "序言");
assert("preface secondary", prefaceSplit.secondary === "关于这份报告");
const energySplit = splitShelfTitle("第一部分 · 你的能量结构");
assert("energy primary", energySplit.primary === "第一部分");
assert("energy secondary", energySplit.secondary === "你的能量结构");
const enSplit = splitShelfTitle("Part I · Your Energy Structure");
assert("en primary", enSplit.primary === "Part I");
assert("en secondary", enSplit.secondary === "Your Energy Structure");
assert("toc alone", splitShelfTitle("目录").primary === "目录" && !splitShelfTitle("目录").secondary);

console.log("\n========================================\n");
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All delivery-shelf-slots checks passed.\n");
