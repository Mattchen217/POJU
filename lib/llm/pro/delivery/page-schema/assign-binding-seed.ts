/**
 * Shared Assign binding seeds (P2–P6).
 * Construction-first: feeds emit hint tables; assign locks thin LLM fields.
 */

export type AssignPathHint = {
  path: string;
  prefer_primary?: string;
  prefer_candidate_ref?: string;
  prefer_cite?: string;
  prefer_claim?: string;
};

export function clipAssignField(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

/**
 * Feed / prompt ban lines must not become unit_claim seeds.
 * Lab: P4 polarity body「禁物件补泻…勿写财务 KPI」曾原样进 claim → mark body 派工腔.
 */
const ASSIGN_CLAIM_BAN_SEED_RE =
  /禁物件补泻|禁周复盘清单?|勿硬克|勿写财务\s*KPI|禁职场教练腔|禁另立与 Brief 脱节的行动课|禁编造议程未确认的时限 KPI|禁写成\s*P6\s*出门仪式|禁止空壳降级出货|贴本案问题[，,]?/g;

/** Situation / career conclusion tails that must not seed unit_claim (fill territory). */
const ASSIGN_CLAIM_MEANS_TAIL_RE =
  /[，,；;]?(?:技術輸出|技术输出|话语权|核心動力|核心动力|职场课|谈判剧本)[^。；;]*/g;

/** Qimen stance / attack-defense prescriptions — fill territory, not assign claim. */
const ASSIGN_CLAIM_STANCE_TAIL_RE =
  /[，,；;]?(?:宜以客位[^。；;]*|宜进取开创[^。；;]*|宜守养休整[^。；;]*|宜藏隐试探[^。；;]*|宜退避防损[^。；;]*|宜显名[^。；;]*|宜以.{0,24}(?:姿态|进取|开创|守养|藏隐|退避|显名|露锋|试探)[^。；;]*)/g;

/** Shared scrub for prefer_claim / unit_claim before lock or soft-polish. */
export function scrubAssignClaimBanSeed(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  t = t
    .replace(ASSIGN_CLAIM_BAN_SEED_RE, "")
    .replace(ASSIGN_CLAIM_MEANS_TAIL_RE, "")
    .replace(ASSIGN_CLAIM_STANCE_TAIL_RE, "")
    .replace(/[；;，,、]{2,}/g, "；")
    .replace(/^[；;，,、。.\s]+|[；;，,、。.\s]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return t;
}

/** Parse P1 names from risk/close feeds (`Brief 主辅:` or `Primary:` / `Backup:`). */
export function parsePrimaryBackupNamesFromFeed(
  feed: string | null | undefined,
): { primaryName?: string; backupName?: string } {
  if (!feed?.trim()) return {};
  const brief = feed.match(
    /Brief\s*主辅:\s*([^|\n]+?)\s*\|\s*when=[\s\S]*?‖\s*辅=\s*([^|\n]+?)\s*\|\s*when=/,
  );
  const primary =
    brief?.[1]?.trim() ||
    feed.match(/Primary:\s*([^|\n]+)/i)?.[1]?.trim() ||
    undefined;
  const backup =
    brief?.[2]?.trim() ||
    feed.match(/Backup:\s*([^|\n]+)/i)?.[1]?.trim() ||
    undefined;
  const clean = (s: string | undefined) => {
    const t = (s ?? "").replace(/^\(+|\)+$/g, "").trim();
    if (!t || t === "(缺)" || t === "—") return undefined;
    return t;
  };
  return { primaryName: clean(primary), backupName: clean(backup) };
}

function escapeRegExpLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 方案 A #14：切辅 / day7[3] 不得把 P1 **主轨名**写成「辅轨/辅路」目标。
 * Deterministic soft repair — no LLM retry.
 */
export function alignPrimaryBackupTrackProse(
  text: string,
  opts: {
    primaryName?: string;
    backupName?: string;
    path?: string;
  },
): string {
  const primary = opts.primaryName?.trim();
  const backup = opts.backupName?.trim();
  let t = text.trim().replace(/\s+/g, " ");
  if (!t || !backup) return t;

  const path = opts.path ?? "";
  const isSwitchPath =
    path === "switch_to_backup" || path === "day7_micro_actions[3]";
  const hasAuxMarker = /辅轨|辅路|切辅|停主切辅|转向/.test(t);

  // Bare placeholder → nail backup name.
  if (/转向「辅轨」|切到辅轨(?![「])/.test(t)) {
    t = t
      .replace(/转向「辅轨」/g, `转向「${backup}」`)
      .replace(/切到辅轨(?![「])/g, `切到「${backup}」`);
  }

  if (!primary || primary === backup) return t;
  if (!isSwitchPath && !hasAuxMarker) return t;

  const mentionsPrimary = t.includes(primary);
  const mentionsBackup = t.includes(backup);

  // Inverted: aux slot talks about primary as the switch destination.
  if (mentionsPrimary && !mentionsBackup && hasAuxMarker) {
    if (path === "switch_to_backup") {
      return `停主切辅条件：转向「${backup}」`;
    }
    if (path === "day7_micro_actions[3]") {
      return `近7日微动作4（切辅→「${backup}」）：启动「${backup}」`;
    }
    const pre = escapeRegExpLiteral(primary);
    t = t
      .replace(new RegExp(`转向「?${pre}」?(?:辅轨|辅路)?`, "g"), `转向「${backup}」`)
      .replace(new RegExp(`${pre}(?:辅轨|辅路)`, "g"), backup)
      .replace(
        new RegExp(`(?:启动)?辅轨切换[，,]?以?${pre}`, "g"),
        `切辅→「${backup}」`,
      );
  }

  return t;
}

/** Unified feed tail table — fields after path may be omitted. */
export function formatAssignBindingHintTable(
  hints: readonly AssignPathHint[],
  title = "【派工绑定建议表 · 代码按 path 种满】",
): string {
  if (hints.length === 0) return "";
  const lines = [
    title,
    "Assign：chart_anchors[0]←primary；means_candidate_ref←ref；calc_cite/unit_claim 空或过短时用 cite/claim（可润色勿空泛）。",
  ];
  hints.forEach((h, i) => {
    const parts = [`path=${h.path}`];
    if (h.prefer_primary?.trim()) parts.push(`primary=${h.prefer_primary.trim()}`);
    if (h.prefer_candidate_ref?.trim()) {
      parts.push(`ref=${h.prefer_candidate_ref.trim()}`);
    }
    if (h.prefer_cite?.trim()) parts.push(`cite=${clipAssignField(h.prefer_cite, 80)}`);
    if (h.prefer_claim?.trim()) {
      parts.push(`claim=${clipAssignField(h.prefer_claim, 120)}`);
    }
    lines.push(`${i + 1}. ${parts.join(" | ")}`);
  });
  return lines.join("\n");
}

/**
 * Parse `path=… | primary=… | ref=… | cite=… | claim=…` lines.
 * primary optional (P2 may seed ref/cite/claim only).
 */
export function parseAssignPathHintsFromFeed(
  feed: string | null | undefined,
): AssignPathHint[] {
  if (!feed?.trim()) return [];
  const out: AssignPathHint[] = [];
  for (const raw of feed.split("\n")) {
    const line = raw.trim().replace(/^\d+\.\s*/, "");
    if (!line.includes("path=")) continue;
    const fields = new Map<string, string>();
    for (const part of line.split("|")) {
      const m = part.trim().match(/^(path|primary|ref|cite|claim)=(.+)$/);
      if (!m) continue;
      fields.set(m[1]!, m[2]!.trim());
    }
    const path = fields.get("path");
    if (!path) continue;
    const prefer_primary = fields.get("primary");
    const prefer_candidate_ref = fields.get("ref");
    const prefer_cite = fields.get("cite");
    const prefer_claim = fields.get("claim");
    if (
      !prefer_primary &&
      !prefer_candidate_ref &&
      !prefer_cite &&
      !prefer_claim
    ) {
      continue;
    }
    out.push({
      path,
      prefer_primary: prefer_primary || undefined,
      prefer_candidate_ref: prefer_candidate_ref || undefined,
      prefer_cite: prefer_cite || undefined,
      prefer_claim: prefer_claim || undefined,
    });
  }
  return out;
}

export function feedForAssignKey(
  key: string,
  opts: {
    foundation_surface_feed?: string | null;
    science_means_feed?: string | null;
    metaphysics_moat_feed?: string | null;
    risk_fuse_feed?: string | null;
    close_ritual_feed?: string | null;
  },
): string | null {
  switch (key) {
    case "foundation":
      return opts.foundation_surface_feed ?? null;
    case "science_action":
      return opts.science_means_feed ?? null;
    case "metaphysics_action":
      return opts.metaphysics_moat_feed ?? null;
    case "risk_guard":
      return opts.risk_fuse_feed ?? null;
    case "signals_close":
      return opts.close_ritual_feed ?? null;
    default:
      return null;
  }
}
