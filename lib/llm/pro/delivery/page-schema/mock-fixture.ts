/**
 * Mock fixture for UI slot development & sanitize tests.
 * Scores are placeholders — live fill must copy from metaphysics_pack only.
 */

import type { DeliveryReportPagesV1 } from "./types";
import { DELIVERY_PAGE_SCHEMA_VERSION } from "./types";

export const DELIVERY_PAGE_SCHEMA_MOCK_V1: DeliveryReportPagesV1 = {
  version: DELIVERY_PAGE_SCHEMA_VERSION,
  unlocked_through_wave: "done",
  pages: {
    direct_answer: {
      page: "direct_answer",
      core_judgment:
        "Stay and renegotiate scope this quarter; only exit if the red-light checklist trips twice.",
      primary: {
        role: "primary",
        name: "Renegotiate in place",
        core_logic:
          "What you lack is not another grind cycle — it is the split between outcome ownership and frontline firefighting. On the primary path you keep the result seat: risk gates, delivery quality, and the few nodes only you can unblock. A trainable deputy takes the physical charge. To the sponsor you remain the person who can force outcomes; your sleep and blood pressure stop subsidizing infinite scope.\n\nOperationally, rewrite vague urgency into a written A-or-B trade-off the sponsor must pick — keep A and slip B, or keep B and cut A — so the boundary is visible, negotiable, and on record. Over a half-year window the proof is not that you can still carry everything, but that remote command plus delegated charge still ships. Success looks like this: they still come to you for results, yet live firefights no longer default to your calendar, and the sleep floor becomes defendable.",
        why: "You still hold leverage on delivery quality; walking away now burns runway without a landing pad.",
        when: "Use while sleep recovers above baseline and one sponsor still answers within 48h.",
        strategic_goal: "Break through while keeping income and voice",
        leverage_chip: "Delivery-quality scorecard the sponsor already trusts",
        dims: { body: "mid", mind: "high", field: "mid" },
      },
      backup: {
        role: "backup",
        name: "Quiet exit prep",
        core_logic:
          "When remote command cannot be negotiated, or the body trips red lights in a row, pause the primary path and run a dignified stop-loss: shrink scope or move into an advisory seat that keeps voice without frontline debt. Freeze heroic ownership first — no more proving loyalty through overtime — then quietly assemble a wins folder and a two-month cash buffer so the next landing is real, not a naked exit.\n\nThis is not a failure story; it converts indispensability from stamina proof into portable evidence. Success looks like this: frontline pressure is off you, sleep and blood pressure enter recovery, and you leave or transfer with dated proof instead of being drained in silence. Within two weeks of the switch, finish a handoff checklist and a buffer-progress review so you do not slide back into another grind.",
        why: "If sponsorship dies, keep dignity and cash buffer instead of another grind cycle.",
        when: "Switch when two red lights fire or sponsor silence exceeds 10 days.",
        strategic_goal: "Stop-loss and exit the front line cleanly",
        leverage_chip: "Wins folder + two-month cash buffer target",
        dims: { body: "low", mind: "mid", field: "low" },
      },
      evidence: [],
    },
    foundation: {
      page: "foundation",
      surface_vs_essence: {
        surface: "Boss conflict and late-night Slack feel like the problem.",
        essence: "Capacity debt + unclear decision rights keep you proving instead of deciding.",
      },
      dashboard: [
        { key: "body", label: "Body load", score: 42, note: "From pack" },
        { key: "mind", label: "Mind strain", score: 68, note: "From pack" },
        { key: "field", label: "Field friction", score: 55, note: "From pack" },
      ],
      why_cards: [
        {
          title: "Structure",
          body: "You own outcomes without owning the gate that releases work.",
        },
        {
          title: "Resistance",
          body: "Every win resets the bar; rest never compounds.",
        },
        {
          title: "Signal",
          body: "Body metrics lag behind mind overdrive — the stuckness is systemic, not a single meeting. That is why the primary path keeps decision rights remote and the backup freezes heroic ownership.",
        },
      ],
      evidence: [],
    },
    science_action: {
      page: "science_action",
      opening: "Lead with scope math, not feelings.",
      primary_toolkit: {
        role: "primary",
        title: "Scope renegotiation · remote command",
        angles: [
          {
            name: "Boundary negotiation",
            strategy:
              "Convert vague urgency into written trade-offs the sponsor must pick.",
            exact_script:
              "Boss — this week covers one track only: finish A by Friday if we drop B, or keep B and move A to next Wed. Reply A or B and I’ll reshape the calendar.",
            means: [
              "List top 3 commitments with hours; cut what cannot run in parallel.",
              "Send a two-option trade-off email/WeChat — no third option.",
              "Book a 20-min decision meeting same week with both options on the agenda.",
            ],
            hard_metrics: [
              "Sponsor replies A or B in writing within 48h",
              "Calendar keeps only the chosen delivery after the meeting",
            ],
          },
          {
            name: "Authority & deputy",
            strategy:
              "Keep decision rights; hand frontline execution to a trainable deputy.",
            exact_script:
              "From next week you own frontline fire: you run daily standup; I keep results and risk gates. Lead two sessions week one; Friday we review — then status leaves my calendar.",
            means: [
              "Name one deputy and write two lines: what they own vs what you keep.",
              "Move status meetings onto their calendar; you become observer or summary-only.",
              "Set a Friday 30-min review: delivery, risk, and decisions only you can make.",
            ],
            hard_metrics: [
              "You own ≤2 live firefights for 7 days",
              "Status meeting owner is the deputy, not you",
            ],
          },
          {
            name: "Body & rhythm guard",
            strategy:
              "Protect sleep and blood-pressure floor so remote command stays sustainable.",
            exact_script:
              "Hard rule: no Slack/WeChat work replies after 10pm weekdays — send urgent items before 9am next day. Hard talks stay morning; not after consecutive late nights.",
            means: [
              "Pin the after-10pm no-reply rule in the team channel and mute night push.",
              "Schedule a 10–15 min walk before any hard ask.",
              "After three short-sleep nights, move the next hard talk to a morning slot.",
            ],
            hard_metrics: [
              "Night Slack/WeChat work replies = 0 for 7 days",
              "All hard talks land in morning windows",
            ],
          },
        ],
      },
      backup_toolkit: {
        role: "backup",
        title: "Quiet exit / scope shrink",
        angles: [
          {
            name: "Proof pack",
            strategy: "Quietly assemble wins without announcing exit.",
            exact_script:
              "Assembling a 12-month delivery/cost summary for handover or internal moves. Please confirm dates/wording on two visible wins by Friday — one-line “confirmed” is enough.",
            means: [
              "Export a wins folder: delivery, cost control, risk gates — 2–3 each.",
              "Date-stamp two sponsor-visible outcomes into a read-only folder.",
              "Ask sponsor for one-line written confirmation; archive the screenshot.",
            ],
            hard_metrics: [
              "Wins folder opens with ≥2 date-stamped outcomes",
              "At least one written sponsor confirmation",
            ],
          },
          {
            name: "Warm network",
            strategy: "Keep dignity runway via warm contacts, not panic applications.",
            exact_script:
              "Exploring an internal move/advisor path. Given my delivery and cost-control record, which title landing feels right? No ask to forward — just your gut read. Thanks.",
            means: [
              "List 3 warm contacts; update only one this week (info swap, not hard job ask).",
              "Draft one soft-landing title option and a one-line value claim.",
              "Send once; log the reply; no chase loops.",
            ],
            hard_metrics: [
              "≥1 warm-contact update with a reply this week",
              "Soft-landing title is speakable in one sentence",
            ],
          },
          {
            name: "Cash buffer",
            strategy: "Set a hard buffer date before any public move.",
            exact_script:
              "Personal buffer rule: no public resignation/transfer announce until the account covers two months burn. This week I freeze new heroic ownership and pin the buffer check.",
            means: [
              "Compute two-month burn and pin a buffer-check date on the calendar.",
              "Freeze new heroic ownership; list what can be handed off.",
              "Friday review: no public announce until buffer hits.",
            ],
            hard_metrics: [
              "Buffer target date is on the calendar with weekly check",
              "Zero public announce before buffer ≥ 2 months burn",
            ],
          },
        ],
      },
      alert: "Do not write a full legal script here — openings only.",
      evidence: [],
    },
    metaphysics_action: {
      page: "metaphysics_action",
      primary_track: {
        role: "primary",
        title: "Eastern leverage for renegotiation",
        dimensions: [
          {
            name: "Field support for the ask",
            strategy: "Borrow field support when you speak; avoid draining rooms before hard asks.",
            means: [
              "Ask in the brighter desk corner you already use for deep work.",
              "Schedule the ask after a short walk, not after late Slack.",
            ],
          hard_metrics: [],
          },
          {
            name: "Timing window",
            strategy: "Use clearer late-morning windows; skip post-depletion evenings.",
            means: ["Prefer late-morning asks.", "No hard negotiation after three late nights."],
          hard_metrics: [],
          },
          {
            name: "Helper / sponsor wind",
            strategy: "Treat existing sponsor warmth as field wind, not emotional fuel.",
            means: ["Open with a shared result metric they already trust."],
          hard_metrics: [],
          },
        ],
      },
      backup_track: {
        role: "backup",
        title: "Eastern cover for quiet exit",
        dimensions: [
          {
            name: "Reduce field entanglement",
            strategy: "Lower entanglement while you prep the exit.",
            means: [
              "Keep evenings device-dark after a fixed hour.",
              "Avoid victory-lap rooms that reopen old fights.",
            ],
          hard_metrics: [],
          },
          {
            name: "Recovery first",
            strategy: "Restore body signal before any public move.",
            means: ["Protect sleep floor for 7 nights before title talks."],
          hard_metrics: [],
          },
        ],
      },
      leverage: ["Use existing sponsor warmth as field wind, not as emotional fuel."],
      avoid: ["Do not turn the whole page into clothing/color rituals."],
      field_matrix: [
        { label: "Ask window", value: "Late morning, clear desk" },
        { label: "Recovery", value: "Walk + dark evening" },
      ],
      evidence: [],
    },
    thirty_day: {
      page: "thirty_day",
      weeks: [
        {
          week: 1,
          focus: "Trade-off email + sleep floor",
          actions: ["Send two-option email", "Zero Slack after 10pm"],
          source_refs: ["p3.primary.steps.0", "p3.primary.hard_metrics"],
        },
        {
          week: 2,
          focus: "Decision meeting",
          actions: ["Hold 20-min sponsor meeting", "Log reply latency"],
          source_refs: ["p3.primary.steps.2"],
        },
        {
          week: 3,
          focus: "Stabilize or arm backup",
          actions: ["If red light, start wins export"],
          source_refs: ["p3.backup.steps.0"],
        },
        {
          week: 4,
          focus: "Review switch condition",
          actions: ["Check silence > 10 days rule"],
          source_refs: ["p1.backup.when"],
        },
      ],
      day7_checklist: [
        "Trade-off email sent",
        "Sponsor reply logged",
        "Three nights under sleep floor recovered",
      ],
      evidence: [],
    },
    risk_guard: {
      page: "risk_guard",
      red_lights: [
        "Sponsor silence > 10 days after written ask",
        "Night Slack returns 3+ nights in a row",
      ],
      traps: ["Re-arguing feelings instead of sending the two-option frame"],
      switch_to_backup:
        "If two red lights fire, freeze renegotiation and run quiet exit prep for two weeks.",
      protection_rules: [
        "No new heroic ownership without a written trade-off",
        "Protect the sleep floor even on 'urgent' weeks",
      ],
      boundary_script: "I can own A or B this week — not both. Which one?",
      evidence: [],
    },
    signals_close: {
      page: "signals_close",
      identity_before: "The one who absorbs urgency",
      identity_after: "The one who forces clear choices",
      quote: "Clarity is a kindness you owe your future self.",
      immediate_action: "Tonight: draft the two-option sentence and leave it in drafts until morning.",
      day7_micro_actions: [
        "Send the two-option trade-off email",
        "Log sponsor reply latency once",
        "Protect sleep floor for three nights",
      ],
      evidence: [],
    },
  },
};
