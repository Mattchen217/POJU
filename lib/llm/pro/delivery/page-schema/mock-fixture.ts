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
        why: "You still hold leverage on delivery quality; walking away now burns runway without a landing pad.",
        when: "Use while sleep recovers above baseline and one sponsor still answers within 48h.",
        dims: { body: "mid", mind: "high", field: "mid" },
      },
      backup: {
        role: "backup",
        name: "Quiet exit prep",
        why: "If sponsorship dies, keep dignity and cash buffer instead of another grind cycle.",
        when: "Switch when two red lights fire or sponsor silence exceeds 10 days.",
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
          body: "Body metrics lag behind mind overdrive — the stuckness is systemic, not a single meeting.",
        },
      ],
      evidence: [],
    },
    science_action: {
      page: "science_action",
      opening: "Lead with scope math, not feelings.",
      primary_toolkit: {
        role: "primary",
        title: "Scope renegotiation toolkit",
        strategy: "Convert vague urgency into written trade-offs the sponsor must pick.",
        exact_script:
          "I can deliver A by Friday if we drop B, or keep B and move A to next week — which do you choose?",
        steps: [
          "List top 3 commitments with hours.",
          "Send trade-off email with two options only.",
          "Book 20-min decision meeting same week.",
        ],
        hard_metrics: ["Sponsor reply < 48h", "Night Slack after 10pm = 0 for 7 days"],
      },
      backup_toolkit: {
        role: "backup",
        title: "Exit-prep toolkit",
        strategy: "Quietly assemble proof + runway without announcing exit.",
        steps: [
          "Export wins folder.",
          "Update one warm contact per week.",
          "Set cash buffer target date.",
        ],
        hard_metrics: ["Buffer ≥ 2 months burn"],
      },
      alert: "Do not write a full legal script here — openings only.",
      evidence: [],
    },
    metaphysics_action: {
      page: "metaphysics_action",
      primary_track: {
        role: "primary",
        title: "Eastern leverage for renegotiation",
        strategy: "Borrow field support when you speak; avoid draining rooms before hard asks.",
        methods: [
          "Ask in the brighter desk corner you already use for deep work.",
          "Schedule the ask after a short walk, not after late Slack.",
        ],
      },
      backup_track: {
        role: "backup",
        title: "Eastern cover for quiet exit",
        strategy: "Reduce field entanglement while you prep.",
        methods: ["Keep evenings device-dark after a fixed hour.", "Avoid victory-lap rooms that reopen old fights."],
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
      evidence: [],
    },
    signals_close: {
      page: "signals_close",
      identity_before: "The one who absorbs urgency",
      identity_after: "The one who forces clear choices",
      quote: "Clarity is a kindness you owe your future self.",
      immediate_action: "Tonight: draft the two-option sentence and leave it in drafts until morning.",
      evidence: [],
    },
  },
};
