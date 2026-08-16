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
      page_title: "Dual-track decision board",
      page_subtitle: "Primary push vs safe stop-loss adjudication",
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
      page_title: "Structural stuck points & deep lesions",
      page_subtitle: "Strip surface myths; lock the real resistance",
      dashboard: [
        { key: "body", label: "Body load", score: 42, note: "From pack" },
        { key: "mind", label: "Mind strain", score: 68, note: "From pack" },
        { key: "field", label: "Field friction", score: 55, note: "From pack" },
      ],
      why_cards: [
        {
          title: "Forced binary",
          surface:
            "From collecting: push overseas frontline or step back — framed as an instant team-pick, plus sponsor pressure for results.",
          essence:
            "Not a courage gap — result rights are welded to frontline fire. Under a need-to-nourish structure you keep proving under load; boundaries were never written as choosable trade-offs.",
        },
        {
          title: "Body alarms",
          surface:
            "Insomnia, blood-pressure swings, rest that never recharges — the body already called stop while the calendar kept stacking.",
          essence:
            "Body load lags mind overdrive: the stuckness is a system-gate mismatch, not one bad meeting.",
        },
        {
          title: "Night drain",
          surface:
            "Late Slack clears whatever charge the day built; rest never compounds.",
          essence:
            "Resistance dimension: urgency punches through personal rhythm. That is why primary keeps decision rights remote and backup freezes heroic ownership while proof and buffer accumulate.",
        },
      ],
      evidence: [],
    },
    science_action: {
      page: "science_action",
      page_title: "Workplace playbook & openings",
      page_subtitle: "Reusable strategy, steps, and short scripts",
      opening: "Start from scope math, not feelings.",
      primary_toolkit: {
        role: "primary",
        title: "Scope renegotiation · remote command",
        angles: [
          {
            name: "Boundary negotiation",
            strategy:
              "Primary track first converts endless urgency into a written two-option boundary: keep A and slip B, or keep B and move A. You stop absorbing scope with emotion; the sponsor must pick. Only then does remote command have a defendable weekly bandwidth.",
            exact_script:
              "Boss — this week covers one track only: finish A by Friday if we drop B, or keep B and move A to next Wed. Reply A or B and I’ll reshape the calendar.",
            means: [
              "List top 3 commitments with hours; cut what cannot run in parallel; leave only two options.",
              "Send the two-option ask and book a 20-min decision meeting the same week.",
            ],
            hard_metrics: ["Sponsor replies A or B in writing within 48h"],
          },
          {
            name: "Authority & deputy",
            strategy:
              "Second primary dimension splits results rights from frontline fire: you keep nodes, quality, and risk gates; a trainable deputy runs standups and firefights. Delegation is how remote command lasts — sponsor still comes to you for outcomes, but default fire no longer lands on you.",
            exact_script:
              "From next week you own frontline fire: you run daily standup; I keep results and risk gates. Lead two sessions week one; Friday we review — then status leaves my calendar.",
            means: [
              "Write two lines of ownership split and move status meetings onto the deputy’s calendar.",
              "Set a Friday 30-min review: delivery, risk, and decisions only you can make.",
            ],
            hard_metrics: ["You own ≤2 live firefights for 7 days"],
          },
          {
            name: "Body & rhythm guard",
            strategy:
              "Third primary dimension writes the body floor as a visible rule: remote command needs clear judgment, not night loyalty theatre. Pin no-reply after 10pm and morning-only hard talks; after short-sleep streaks, reschedule. The guardrail is a precondition for a six-month primary path.",
            exact_script:
              "Hard rule: no Slack/WeChat work replies after 10pm weekdays — send urgent items before 9am next day. Hard talks stay morning; not after consecutive late nights.",
            means: [
              "Pin the night no-reply rule and mute night push; leave a short walk before hard talks.",
              "After three short-sleep nights, move the next hard talk to a morning slot.",
            ],
            hard_metrics: ["Night work replies = 0 for 7 days"],
          },
        ],
      },
      backup_toolkit: {
        role: "backup",
        title: "Quiet exit / scope shrink",
        angles: [
          {
            name: "Proof pack",
            strategy:
              "On backup, first turn “irreplaceable” from stamina into assets: quietly assemble 12 months of delivery, cost control, and risk gates with date stamps. Without the pack, an internal move or shrink becomes a naked exit; with it, stop-loss stays dignified.",
            exact_script:
              "Assembling a 12-month delivery/cost summary for handover or internal moves. Please confirm dates/wording on two visible wins by Friday — one-line “confirmed” is enough.",
            means: [
              "Export the wins folder and date-stamp two sponsor-visible outcomes; ask for one-line written confirmation.",
            ],
            hard_metrics: ["Wins folder has ≥2 date-stamped outcomes"],
          },
          {
            name: "Warm network",
            strategy:
              "Second backup dimension protects a dignity runway via warm contacts: update one trusted person per week for information, not panic applications. Draft one soft-landing title and a one-line value claim so the next seat is speakable.",
            exact_script:
              "Exploring an internal move/advisor path. Given my delivery and cost-control record, which title landing feels right? No ask to forward — just your gut read. Thanks.",
            means: [
              "Update one warm contact this week; draft soft-landing title + one-line value claim before sending.",
            ],
            hard_metrics: ["≥1 warm-contact update with a reply this week"],
          },
          {
            name: "Cash buffer",
            strategy:
              "Third backup dimension is the hard gate before any public move: pin a two-month burn buffer date, freeze new heroic ownership, and make no public resignation/transfer announce until it hits. Buffer is not cowardice — it stops an emotional jump from becoming a second injury.",
            exact_script:
              "Personal buffer rule: no public resignation/transfer announce until the account covers two months burn. This week I freeze new heroic ownership and pin the buffer check.",
            means: [
              "Compute two-month burn and pin the buffer-check date; freeze new heroic ownership until it hits.",
            ],
            hard_metrics: ["Zero public announce before buffer ≥ 2 months burn"],
          },
        ],
      },
      alert: "Keep openings short — no full legal scripts.",
      evidence: [],
    },
    metaphysics_action: {
      page: "metaphysics_action",
      page_title: "Field retune & environmental levers",
      page_subtitle: "Asymmetric leverage, avoid nodes, counter-intuitive field moves",
      question_anchor:
        "Whether to push overseas frontline or step back — how to keep result rights and protect the body in a six-month window.",
      desired_outcome:
        "A sustainable remote-command shape: sponsor still comes for results; frontline fire no longer defaults to me.",
      dimensions: [
        {
          name: "Color & dress anchors",
          strategy:
            "For keeping result rights while cutting frontline drain: wear chart-favored colors in key visible moments so presence stays steady without grinding harder.",
          means: [
            "On key calls and written-send days, outer layer in deep navy / ink black (aligned with chart color anchors).",
            "Avoid large high-saturation clash colors as the main look — that reads as hard-push energy.",
          ],
          hard_metrics: [],
        },
        {
          name: "Direction & spatial facing",
          strategy:
            "Remote command needs sustainable output: seat and open toward high-fit directions from the local pack; avoid depleted facings for hard pushes — spatial fit, not a science negotiation script.",
          means: [
            "Deep work and key opens prefer the high-fit side (e.g. SE / due-east desk corner per pack).",
            "Hard-talk video: stable wall behind you, brighter side in front; avoid long backlit drain seats.",
          ],
          hard_metrics: [],
        },
        {
          name: "High-fit timing windows",
          strategy:
            "Schedule the moves that advance THIS matter into higher-fit hours; depleted slots are for filing only — phase rhythm protects the sustainable-command expectation.",
          means: [
            "Boundary / scope confirms prefer late-morning clear blocks.",
            "After consecutive late nights, evening slots do archive/recovery only — no hard push.",
          ],
          hard_metrics: [],
        },
        {
          name: "Da-yun / phase year windows",
          strategy:
            "Near-phase windows favor structuring remote command, not adding frontline debt; later windows suit outward expansion — qualitative phase guidance, never absolute lucky/unlucky dates.",
          means: [
            "Next 1–2 years: put energy into remote-command structure and delegated ownership; open fewer new frontline battles.",
            "After structure stabilizes, raise outward expansion share in later windows (body floor still gates).",
          ],
          hard_metrics: [],
        },
        {
          name: "Yong complement · Ji avoid",
          strategy:
            "Complement what supports rear-command calm rhythm; avoid entanglement that rebinds fire to frontline hard-push — serving THIS career choice.",
          means: [
            "Keep water / greenery / short walks in the daily field as visible complement moves.",
            "Leave high-pressure victory / quarrel rooms early — avoid ji-style drain loops.",
          ],
          hard_metrics: [],
        },
      ],
      leverage: [
        "Pair high-fit facing + favored colors so key opens land as field wind, not brute force.",
      ],
      avoid: [
        "Do not collapse the page into clothing slogans or zodiac luck.",
        "Do not restate P3 email / delegation / calendar means.",
      ],
      field_matrix: [
        { label: "Dress", value: "Navy / ink black" },
        { label: "Facing", value: "High-fit desk side" },
        { label: "Hours", value: "Late-morning clear" },
        { label: "Years", value: "Near = structure · later = expand" },
      ],
      evidence: [],
    },
    thirty_day: {
      page: "thirty_day",
      page_title: "Four-week rhythm (retired)",
      page_subtitle: "Legacy sessions only",
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
      page_title: "Tripwires & backup switch",
      page_subtitle: "Bottom lines and when to flip tracks",
      red_lights: [
        {
          situation: "Sponsor silence > 10 days after the written two-option ask",
          then_do: "Freeze new heroic ownership; send one status ping then stop chasing",
          watch: "Whether silence stacks with night Slack returning",
          forbid: "Do not re-open soft emotional arguments without a written frame",
        },
        {
          situation: "Night Slack returns 3+ nights in a row while a hard talk is pending",
          then_do: "Park the hard talk until sleep floor recovers for two nights",
          watch: "Blood-pressure / irritability flags the morning after",
          forbid: "Do not negotiate boundaries right after late-night firefighting",
        },
      ],
      traps: [
        {
          situation: "Re-arguing feelings instead of sending the two-option frame",
          then_do: "Rewrite as A-or-B trade-off and send once",
          watch: "Urge to prove loyalty through overtime",
          forbid: "Do not absorb both tracks to 'keep peace'",
        },
      ],
      switch_to_backup: {
        situation: "Two red lights fire while sponsor still refuses clear scope",
        then_do: "Freeze renegotiation; run quiet exit / advisory prep for two weeks",
        watch: "Whether primary path keeps adding unpaid ownership",
        forbid: "Do not stay on primary 'just one more push'",
      },
      protection_rules: [
        {
          situation: "Urgent ask arrives without a written trade-off",
          then_do: "Require A-or-B before accepting ownership",
          watch: "Heroic ownership creeping back into the calendar",
          forbid: "No new heroic ownership without a written trade-off",
        },
        {
          situation: "'Urgent' week threatens the sleep floor",
          then_do: "Protect sleep floor first; move hard talks to morning slots",
          watch: "Consecutive late nights before sponsor meetings",
          forbid: "Do not burn the sleep floor to prove indispensability",
        },
      ],
      boundary_script: "I can own A or B this week — not both. Which one?",
      evidence: [],
    },
    signals_close: {
      page: "signals_close",
      page_title: "Tonight one move & week-one list",
      page_subtitle: "Identity shift, steadying line, tonight loop, 7-day cards",
      identity_before: "The firefighter always on the front line",
      identity_after: "The operator who keeps decisions and delegates execution",
      identity_shift:
        "Primary path is remote ops + deputy authority: value sits in judgment and risk control, not flight hours. Identity must follow that path.",
      quote: "Clarity is a kindness you owe your future self.",
      quote_use: "When you want to say yes to one more trip, say this line first — then check tonight's one move.",
      immediate_action:
        "Tonight: write half a page — you keep back-office decisions; deputy runs the front line. Two columns: you keep / they take.",
      tonight_done_looks_like:
        "A draft file exists with keep/take columns — not a mental rehearsal.",
      tonight_why:
        "Delay past tonight and the old frontline habit pulls you back before the talk.",
      day7_micro_actions: [
        {
          action: "Lock bedtime 23:00 and protect sleep floor",
          why: "Recovery is the judgment floor for the primary path.",
          done_when: "≥3 nights logged as protected.",
        },
        {
          action: "Hand two independent links to the deputy in writing",
          why: "Authority needs evidence before remote-ops negotiation.",
          done_when: "List sent and acknowledged.",
        },
        {
          action: "Book one sponsor conversation slot",
          why: "Turn the compromise from a wish into a calendar fact.",
          done_when: "A firm meeting/call time exists.",
        },
        {
          action: "Draft three remote-ops points (no residency, key nodes, outcome metrics)",
          why: "Open with a frame, not a health complaint.",
          done_when: "Three points fit on the same half-page draft.",
        },
      ],
      takeaways: [
        "Path: remote ops + authority — not hard frontline.",
        "Week lever: sleep floor + written handoff.",
        "Fuse: if blocked or body reds stack → flip backup.",
      ],
      evidence: [],
    },
  },
};
