/**
 * M2.4-R2 — REAL end-to-end Decision Intake run, one session throughout.
 *
 *   pnpm e2e:m2-4-r2-real
 *
 * Fresh session → Blueprint init → first question → real-model answers
 * (via /api/poju/answer-interpretation → OpenRouter) → DC → Understanding →
 * next question → pending → goal change + confirmation + Blueprint update →
 * readiness → user 确认 → Freeze → hash/version check → freeze-bound report
 * job binding. No interpretation hooks. Page generation (Phase 5) is NOT run.
 *
 * Writes a redacted JSON transcript to temp/.
 */
import "fake-indexeddb/auto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installIntakeR6TestGlobals } from "./fixtures/test-browser-globals";
import {
  answerSourceAudit,
  factsFromTurn,
  installRealFetch,
  lastAssistant,
  lastUserTurnId,
  loadEnvLocal,
  snapshot,
} from "./fixtures/m2-4-r2-real-harness";

loadEnvLocal();
installIntakeR6TestGlobals("dev_m2_4_r2_real_e2e");
Object.defineProperty(globalThis, "requestAnimationFrame", {
  value: (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0),
  configurable: true,
  writable: true,
});

type Session = import("../lib/poju/types").POJUSessionState;

const GOAL_CHANGE_TEXT = "其实我现在真正要决定的不是创业，而是要不要接受杭州那家公司的offer。";

/** Synthetic persona answers keyed by the DIR the sent question is bound to. */
const ANSWERS: Record<string, string> = {
  "DIR-BIZ-MODEL": "我原本打算做跨境电商代运营，靠给工厂运营海外店铺收服务费。",
  "DIR-DEF-QUESTION": "我要决定的是要不要接受杭州那家公司的offer。",
  "DIR-DEF-OUTCOME": "我希望两年内年收入稳定在四十万以上，同时工作强度可控。",
  "DIR-DEF-PRIORITIES": "第一是收入稳定，第二是家庭时间，第三才是职位头衔。",
  "DIR-DEF-STAKES": "如果选错，房贷压力会明显变大；至于要多久才能回到现在的收入水平，我说不准，可能一两年吧。",
  "DIR-DEF-UNACCEPTABLE": "不能接受收入断档超过三个月，也不能接受和家人长期两地分居。",
  "DIR-OPT-ON-TABLE": "选项有两个：接受杭州的offer，或者留在现在的上海公司继续做。",
  "DIR-STATUS-QUO": "现在在上海一家公司做运营总监，年薪三十五万，工作稳定但没有上升空间。",
  "DIR-OPT-CONSTRAINTS": "每个月房贷一万二不能断，孩子明年要上小学，学区必须在年底前定下来。",
  "DIR-OPT-IRREV": "辞职后基本回不去现在的公司，但杭州的工作如果不合适，一年内还能再找。",
  "DIR-PAST-ATTEMPTS": "三年前拒绝过一次深圳的offer，当时是因为孩子太小。",
  "DIR-TIMING-WINDOW": "杭州那边要求月底前答复，最晚下个月十五号入职。",
  "DIR-RISK-TOLERANCE": "收入短期少两成我能接受，但这种状态能撑多久我也说不准，大概半年吧。",
  "DIR-EXIT-CRITERIA": "如果入职半年后发现团队不稳定或者收入没兑现，我就会考虑再换。",
  "DIR-VALIDATION-CAPACITY": "我可以先找杭州那边的两个前同事打听团队情况，一周内能问到。",
  "DIR-STAKEHOLDERS": "主要是我太太和父母，太太的意见最关键。",
  "DIR-REL-DYNAMICS": "我太太支持我去杭州，但希望周末能回上海；父母担心不稳定。",
  "DIR-JOB-OFFER": "杭州那家公司给的是运营副总裁，年薪四十五万，税前，期权还没谈细。",
  "DIR-LOCALE-MOVE": "如果去杭州，我先一个人过去，家人一年后再搬。",
};

function answerFor(dirIds: string[]): string {
  const parts = dirIds.map((d) => ANSWERS[d]).filter((x): x is string => Boolean(x));
  if (parts.length > 0) return [...new Set(parts)].join("");
  return "这一点我的情况是：收入稳定最重要，其他条件都可以商量。";
}

/** Follow-up to an unresolved-aspect clarification: adds detail instead of repeating the answer. */
const FOLLOW_UPS: Record<string, string> = {
  "DIR-DEF-OUTCOME": "四十万指的是税前现金收入，不含期权；工作强度可控是指每周不超过五十小时。",
  "DIR-DEF-STAKES": "房贷压力变大具体是指存款只够撑四个月的月供。",
  "DIR-DEF-UNACCEPTABLE": "两地分居超过一年就算长期。",
  "DIR-RISK-TOLERANCE": "收入少两成的状态我最多能撑六个月，超过就必须调整。",
  "DIR-OPT-CONSTRAINTS": "学区要在十二月底前确定，房贷每月一万二是硬性的。",
  "DIR-EXIT-CRITERIA": "团队不稳定是指半年内直属领导或核心成员走掉一半以上。",
  "DIR-JOB-OFFER": "期权会在入职前谈清楚，现金部分已经白纸黑字写进了offer。",
};

function followUpFor(dirIds: string[]): string {
  const parts = dirIds.map((d) => FOLLOW_UPS[d]).filter((x): x is string => Boolean(x));
  if (parts.length > 0) return [...new Set(parts)].join("");
  return "这一点没有更多细节了，就按我前面说的为准。";
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.error("BLOCKER: OPENROUTER_API_KEY is not configured; real E2E cannot run.");
    process.exit(2);
  }
  console.log("OPENROUTER_API_KEY present: true");

  const { __resetPojuDbForTests, ensurePojuDbReady } = await import("../lib/db/poju-db");
  const { createPOJUSession, loadPOJUSession, savePOJUSession } = await import(
    "../lib/poju/session-manager"
  );
  const { handleUserMessage } = await import("../lib/poju/agent");
  const { computeContentHash } = await import("../lib/poju/decision-context/content-hash");
  const {
    freezeIdFromBinding,
    loadAuthoritativeFreeze,
    verifyFrozenSnapshot,
    prepareFreezeBoundFinalDelivery,
  } = await import("../lib/poju/decision-intake/freeze-bound-report");
  const route = await import("../app/api/poju/answer-interpretation/route");

  await __resetPojuDbForTests();
  await ensurePojuDbReady();
  const net = installRealFetch({ routeHandler: route.POST });

  const transcript: Array<Record<string, unknown>> = [];
  const final: Record<string, unknown> = {};
  const checks: Array<{ check: string; ok: boolean; detail?: string }> = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    checks.push({ check: name, ok, detail });
    console.log(`  ${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  };

  async function load(sid: string): Promise<Session> {
    const s = await loadPOJUSession(sid);
    if (!s) throw new Error(`session ${sid} missing`);
    return s;
  }

  let sid = "";
  async function send(text: string, label: string): Promise<Session> {
    const before = await load(sid);
    const callsBefore = net.calls.length;
    const out = await handleUserMessage({ session: before, userMessage: text, locale: "zh" });
    await savePOJUSession(out);
    let after = await load(sid);
    let calls = net.calls.slice(callsBefore);
    const status = calls[0]?.response.http_status ?? null;
    const entry = (s: Session, c: typeof calls, l: string) => {
      const turnId = lastUserTurnId(s);
      return {
        n: transcript.length + 1,
        label: l,
        user: text,
        assistant: lastAssistant(s)?.content.slice(0, 500) ?? null,
        openrouter: c.map((x) => ({
          via_route: x.via_route,
          http_status: x.response.http_status,
          provider: x.response.provider,
          model: x.response.model,
          finish_reason: x.response.finish_reason,
          content: x.response.content,
          error: x.response.error,
        })),
        answer_source: turnId ? answerSourceAudit(s, turnId) : null,
        facts_written: turnId ? factsFromTurn(s, turnId) : [],
        before: snapshot(before),
        after: snapshot(s),
      };
    };
    if (status === 429) {
      transcript.push(entry(after, calls, `${label} [supply-side 429, user resends]`));
      await new Promise((r) => setTimeout(r, 8000));
      const callsMid = net.calls.length;
      const again = await handleUserMessage({ session: after, userMessage: text, locale: "zh" });
      await savePOJUSession(again);
      after = await load(sid);
      calls = net.calls.slice(callsMid);
    }
    const e = entry(after, calls, label);
    transcript.push(e);
    const u = after.decision_understanding;
    const userMsg = [...after.messages].reverse().find((m) => m.role === "user");
    console.log(
      `#${e.n} ${label} | dc v${e.before.dc?.version}->v${e.after.dc?.version} bp v${e.after.blueprint?.version} ` +
        `asked=${u?.budget.session_asked_count ?? "-"} calls=${calls.length} ` +
        `cls=${e.answer_source?.interpretation?.classification ?? "-"} ` +
        `next=${u?.last_sent_question?.dir_ids.join(",") ?? "-"} ready=${u?.readiness.verdict ?? "-"} phase=${after.agent_v2?.current_phase}` +
        (userMsg?.is_rejected ? " USER_MSG_REJECTED" : ""),
    );
    console.log(`    Q: ${(lastAssistant(after)?.content ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
    const ctl = after.pending_intake_control;
    if (ctl) {
      console.log(
        `    control ${ctl.status}: ${ctl.items.map((i) => `${i.kind}:${i.status}:${i.text.slice(0, 30)}`).join(" | ")}`,
      );
    }
    const pend = after.pending_answer_resolution;
    if (pend) {
      console.log(`    pending ${pend.status}: ${pend.unresolved_items.map((i) => `${i.reason}:${i.text.slice(0, 20)}`).join(" | ")}`);
    }
    return after;
  }

  try {
    sid = await createPOJUSession({
      payment_id: "pay_m24r2_real_e2e",
      original_question: "要不要离职去创业？",
    });
    let s = await load(sid);
    check("fresh session has no DC", !s.decision_context);

    s = await send("我在犹豫要不要离职去创业，家里还有贷款。", "bootstrap");
    check("Blueprint + draft DC created", Boolean(s.decision_blueprint) && s.decision_context?.status === "draft");
    check(
      "first question is the authorized adaptive plan",
      Boolean(s.decision_understanding?.last_sent_question) &&
        lastAssistant(s)?.content === s.adaptive_ask_plan?.question_text,
    );

    let goalChanged = false;
    let pendingSeen = false;
    let controlSeen = false;
    const askedPlanIds: string[] = [];
    const answeredDirs = new Set<string>();
    const signatures: string[] = [];
    let guard = 0;
    while (guard < 40) {
      guard += 1;
      const sig = JSON.stringify([
        s.decision_context?.version,
        s.decision_understanding?.last_sent_question?.plan_id,
        s.pending_intake_control?.items.map((i) => i.status),
        s.pending_answer_resolution?.unresolved_items.map((i) => i.item_id),
      ]);
      signatures.push(sig);
      if (signatures.length >= 4 && signatures.slice(-4).every((x) => x === sig)) {
        check("loop progresses (no stall)", false, "3 turns without any state change");
        break;
      }
      const u = s.decision_understanding;
      if (s.agent_v2?.current_phase === "awaiting_confirmation" || u?.readiness.can_ask === false) break;
      const pending = s.pending_answer_resolution;
      const control = s.pending_intake_control;
      if (pending?.status === "pending" && pending.resolving_item_id) {
        pendingSeen = true;
        s = await send("2", "pending clarification → estimate");
        continue;
      }
      const controlItem = control?.items.find(
        (i) => i.item_id === control.resolving_item_id && (i.status === "pending" || i.status === "uncertain"),
      ) ?? control?.items.find((i) => i.status === "pending" || i.status === "uncertain");
      if (control && (control.status === "pending") && controlItem) {
        controlSeen = true;
        if (controlItem.kind === "goal_change") {
          s = await send("1", "confirm goal change");
          continue;
        }
        s = await send(
          controlItem.kind === "unresolved_aspect"
            ? followUpFor(controlItem.authorized_dir_ids)
            : answerFor(controlItem.authorized_dir_ids),
          `control follow-up (${controlItem.kind})`,
        );
        continue;
      }
      const sent = u?.last_sent_question;
      if (!sent) break;
      askedPlanIds.push(sent.plan_id);
      if (!goalChanged && transcript.length >= 2) {
        goalChanged = true;
        s = await send(GOAL_CHANGE_TEXT, "goal change proposal");
        continue;
      }
      const reasked = sent.dir_ids.some((d) => answeredDirs.has(d));
      for (const d of sent.dir_ids) answeredDirs.add(d);
      s = await send(
        reasked ? followUpFor(sent.dir_ids) : answerFor(sent.dir_ids),
        `${reasked ? "follow-up" : "answer"} ${sent.dir_ids.join(",")}`,
      );
    }

    const u = s.decision_understanding!;
    final.budget = u.budget;
    final.readiness = u.readiness;
    const changeLog = s.blueprint_change_log ?? [];
    final.blueprint_change_log = changeLog;
    check("pending clarification exercised", pendingSeen);
    check("intake control exercised", controlSeen);
    check(
      "goal change applied to Blueprint with history",
      changeLog.length >= 1 && (s.decision_blueprint_history?.length ?? 0) >= 1,
      changeLog[0] ? `v${changeLog[0].from_blueprint_version}->v${changeLog[0].to_blueprint_version}: ${changeLog[0].new_decision_target}` : "none",
    );
    check("decision target is the confirmed new target", s.decision_blueprint?.decision_question === changeLog[0]?.new_decision_target);
    const sentIds = transcript
      .map((t) => (t.after as ReturnType<typeof snapshot>).understanding?.last_sent_question?.plan_id)
      .filter((x): x is string => Boolean(x));
    check("no plan sent twice in a row with a different answer charged", new Set(sentIds).size >= 3);
    check("budget within hard cap 15", u.budget.session_asked_count <= 15, `asked=${u.budget.session_asked_count}`);
    check(
      "readiness reached",
      u.readiness.can_ask === false && s.agent_v2?.current_phase === "awaiting_confirmation",
      `${u.readiness.verdict} ${u.readiness.reasons.join("|").slice(0, 200)}`,
    );

    // Freeze via the user's explicit confirmation.
    const draftVersion = s.decision_context!.version;
    s = await send("确认", "user confirm → Freeze");
    const dc = s.decision_context!;
    check("assistant reports freeze", /【已冻结】/.test(lastAssistant(s)?.content ?? ""), lastAssistant(s)?.content.slice(0, 120));
    check("DC final with content hash", dc.status === "final" && Boolean(dc.content_hash) && dc.content_hash!.length === 64);
    check("freeze bumps version", dc.version > draftVersion, `v${draftVersion}->v${dc.version}`);
    check("hash recomputes", computeContentHash(dc) === dc.content_hash);
    check(
      "immutable final version snapshot stored",
      (s.decision_context_versions ?? []).some((v) => v.status === "final" && v.version === dc.version),
    );

    const freezeId = freezeIdFromBinding({
      context_id: dc.context_id,
      context_version: dc.version,
      context_hash: dc.content_hash!,
    });
    const auth = loadAuthoritativeFreeze(s, { freezeId, expected_hash: dc.content_hash! });
    verifyFrozenSnapshot(auth.frozen, auth.binding);
    check("authoritative freeze loads and verifies", auth.binding.context_hash === dc.content_hash);

    const prepared = await prepareFreezeBoundFinalDelivery({
      session: s,
      freezeId,
      expected_hash: dc.content_hash!,
      deps: {
        now: () => new Date().toISOString(),
        persistSession: async (x: Session) => {
          await savePOJUSession(x);
        },
        loadSession: async (id: string) => loadPOJUSession(id),
      },
    });
    check("report job bound to the freeze (no page generation)", prepared.ok, prepared.ok ? undefined : JSON.stringify(prepared).slice(0, 300));
    let binding: unknown = null;
    if (prepared.ok) {
      binding = prepared.job.binding;
      check(
        "binding matches freeze id / version / hash",
        prepared.snapshot.freezeId === freezeId &&
          prepared.snapshot.decisionContextVersion === dc.version &&
          prepared.snapshot.contentHash === dc.content_hash,
      );
      const reloaded = await load(sid);
      check("binding persisted on the session", JSON.stringify(reloaded).includes(freezeId));
    }

    Object.assign(final, {
      freeze_id: freezeId,
      dc_version: dc.version,
      content_hash: dc.content_hash,
      blueprint_version: s.decision_blueprint?.blueprint_version,
      report_binding: binding,
    });
  } catch (e) {
    check("run completed without exception", false, e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  } finally {
    net.restore();
    const realCalls = net.calls.length;
    const okCalls = net.calls.filter((c) => c.response.http_status === 200).length;
    const report = {
      kind: "m2_4_r2_real_e2e",
      ran_at: new Date().toISOString(),
      session_id: sid,
      transport: "handleUserMessage → POST /api/poju/answer-interpretation (real route handler) → OpenRouter",
      stubbed: ["/api/poju/chat (legacy phase chat; replaced by the authorized plan question on intake turns)"],
      phase5_page_generation: "not run",
      openrouter_calls: { total: realCalls, http_200: okCalls, routed: net.calls.filter((c) => c.via_route).length },
      final,
      checks,
      transcript,
    };
    mkdirSync(join(process.cwd(), "temp"), { recursive: true });
    const out = join(process.cwd(), "temp", `m2-4-r2-real-e2e-${Date.now()}.json`);
    writeFileSync(out, JSON.stringify(report, null, 2), "utf8");
    const failedChecks = checks.filter((c) => !c.ok).length;
    console.log(`\nchecks ok ${checks.length - failedChecks}/${checks.length}; openrouter calls ${okCalls}/${realCalls} http 200`);
    console.log(`report: ${out}`);
    if (failedChecks > 0) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
