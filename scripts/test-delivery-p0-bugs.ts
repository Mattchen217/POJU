/**
 * P0 Bug #1/#2 + day7 trace + Lab order smoke.
 * Run: pnpm exec tsx scripts/test-delivery-p0-bugs.ts
 */
import assert from "node:assert/strict";
import {
  buildInitialDeliveryDispatchDag,
  pageAssignId,
  pageReadyId,
} from "@/lib/llm/pro/delivery/dispatch/task-dag";
import { LAB_STEP_DEFS } from "@/lib/llm/pro/delivery/lab/types";
import { filterTasksToCurrentWave } from "@/lib/llm/pro/delivery/page-schema/upstream";
import {
  assessDay7Traceability,
  buildDay7TraceSourceBlob,
} from "@/lib/llm/pro/delivery/page-schema/day7-traceability";
import { DELIVERY_PAGE_TAGS } from "@/lib/llm/pro/delivery/delivery-schema";
import { PAGE_LABEL as P6_LABEL } from "@/lib/llm/pro/delivery/page-prompts/p6-signals-close";

{
  const dag = buildInitialDeliveryDispatchDag("job-test");
  const p3 = dag.tasks[pageAssignId("science_action")];
  const p4 = dag.tasks[pageAssignId("metaphysics_action")];
  const p2 = dag.tasks[pageAssignId("foundation")];
  assert.ok(p3?.deps.includes(pageReadyId("direct_answer")), "P3 assign waits P1");
  assert.ok(p4?.deps.includes(pageReadyId("direct_answer")), "P4 assign waits P1");
  assert.ok(!p2?.deps.includes(pageReadyId("direct_answer")), "P2 does not wait P1");
}

{
  const ready = new Set<"direct_answer" | "foundation">(["foundation"]);
  const wave = filterTasksToCurrentWave(
    [
      { paths: ["science_action"] as const },
      { paths: ["foundation"] as const },
    ],
    ready as Set<import("@/lib/llm/pro/delivery/delivery-schema").DeliverySegmentKey>,
  );
  assert.deepEqual(
    wave.map((t) => t.paths[0]),
    ["foundation"],
  );
  ready.add("direct_answer");
  const wave2 = filterTasksToCurrentWave(
    [{ paths: ["science_action"] as const }],
    ready as Set<import("@/lib/llm/pro/delivery/delivery-schema").DeliverySegmentKey>,
  );
  assert.equal(wave2.length, 1);
}

{
  const keys = LAB_STEP_DEFS.map((s) => s.step_key);
  const p1 = keys.indexOf("direct_answer.fill");
  const p3 = keys.indexOf("science_action.assign");
  assert.ok(p1 >= 0 && p3 >= 0, "lab steps present");
  assert.ok(p1 < p3, "Lab: P1 fill before P3 assign");
}

{
  assert.match(DELIVERY_PAGE_TAGS.signals_close.zh, /出门仪式/);
  assert.match(P6_LABEL, /出门仪式/);
}

{
  const feed = buildDay7TraceSourceBlob(
    "近阶茎：先减会议负荷；护住决策边界；写一页可出示交付物；窗口内再谈扩权",
    ["先减会议负荷"],
  );
  const ok = assessDay7Traceability(
    [
      { action: "本周先减会议负荷", why: "给边界留空" },
      { action: "护住决策边界", why: "不让权漂走" },
      { action: "写一页可出示交付物", why: "今晚能交" },
      { action: "窗口内再谈扩权", why: "条件成熟再谈" },
    ],
    feed,
  );
  assert.equal(ok.ok, true);

  const bad = assessDay7Traceability(
    [
      { action: "去海边晒太阳积德", why: "转运" },
      { action: "买绿植补运气", why: "风水" },
      { action: "每日念咒", why: "仪式" },
      { action: "改生辰八字", why: "改命" },
    ],
    feed,
  );
  assert.equal(bad.ok, false);
}

console.log("ok delivery-p0-bugs");
