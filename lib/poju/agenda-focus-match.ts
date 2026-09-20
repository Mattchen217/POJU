/**
 * Normalize agenda label/id for loose matching (trim, collapse space, strip quotes).
 */
export function normalizeAgendaRef(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[「」『』""''`]/g, "");
}

/**
 * Label slices that show up in almost any question (情况/态度/时间…).
 * A hit that is only one of these does not prove which item was asked.
 */
const GENERIC_LABEL_HITS = new Set([
  "情况",
  "态度",
  "模式",
  "自己",
  "对方",
  "你对",
  "近期",
  "实际",
  "空间",
  "项目",
  "什么",
  "怎么",
  "是否",
  "分配",
]);

/**
 * When the ask paraphrases an agenda topic without repeating the label verbatim,
 * boost the matching item (fixes 技术依赖 ask → 阶段性安排 truncate label).
 */
const TOPIC_ASK_BOOSTS: ReadonlyArray<{
  ask: RegExp;
  label: RegExp;
  boost: number;
}> = [
  // Soft probe about partner attitude → 兼职反应 (do NOT include 阶段性 in label)
  {
    ask: /试探|(他的|对方的)?态度|怎么说|反应是什么|提过.*兼职|兼职.*提过/,
    label: /兼职|试水|接受度|反应/,
    boost: 10,
  },
  {
    ask: /兼职|试水|全职|核心(圈|位置)|阶段性/,
    label: /兼职|试水|阶段性|全职|接受度/,
    boost: 8,
  },
  {
    ask: /技术|依赖|替代|执行者|壁垒|信得过/,
    label: /技术|依赖|替代|执行/,
    boost: 8,
  },
  {
    ask: /股权|书面|律师|合同|协议|顾问|法务/,
    label: /股权|书面|法律|顾问|协议|合同/,
    boost: 8,
  },
  {
    ask: /撑|底线|收入|半年|储蓄|安全垫|焦虑|断(掉|了)?.*收入/,
    label: /底线|收入|安全|撑/,
    boost: 8,
  },
  {
    ask: /独处|冥想|调频|冷静|习惯|静(一静|下来)/,
    label: /调频|独处|冥想|习惯|调节/,
    boost: 8,
  },
  {
    ask: /里程碑|三个月|进展|资源到位|短期目标/,
    label: /里程碑|目标|进展|资源/,
    boost: 8,
  },
];

export type AskedAgendaResolution = {
  target: { id: string; label: string; status?: string } | null;
  /** Last assistant ask clearly names a different agenda item than the cursor. */
  off_focus: boolean;
  /** Write the user reply onto `target` (pending item, or a strong re-ask of a covered one). */
  capture: boolean;
  /** Mark `target` covered. False when the ask only re-hit an already covered item. */
  cover: boolean;
};

function longestDistinctLabelHit(
  label: string,
  askedHan: string,
): { len: number } {
  const lab = label.replace(/[^\u4e00-\u9fff]/g, "");
  const max = Math.min(lab.length, 12);
  for (let len = max; len >= 2; len--) {
    for (let i = 0; i + len <= lab.length; i++) {
      const slice = lab.slice(i, i + len);
      if (GENERIC_LABEL_HITS.has(slice)) continue;
      if (askedHan.includes(slice)) return { len };
    }
  }
  return { len: 0 };
}

function topicBoost(label: string, asked: string): number {
  let best = 0;
  for (const row of TOPIC_ASK_BOOSTS) {
    if (row.ask.test(asked) && row.label.test(label)) {
      best = Math.max(best, row.boost);
    }
  }
  return best;
}

function scoreAskAgainstItem(
  item: { label: string; supports?: string; collection_goal?: string },
  asked: string,
  askedHan: string,
): number {
  const labelHit = longestDistinctLabelHit(item.label, askedHan).len;
  const supportHit = item.supports
    ? Math.floor(longestDistinctLabelHit(item.supports, askedHan).len / 2)
    : 0;
  const goalHit = item.collection_goal
    ? Math.floor(longestDistinctLabelHit(item.collection_goal, askedHan).len / 2)
    : 0;
  const boost = topicBoost(item.label, asked);
  return Math.max(labelHit, supportHit, goalHit) + boost;
}

/**
 * Bind a collecting reply to the agenda item the assistant actually asked,
 * not the cursor. Paraphrases with no distinctive overlap stay on the cursor.
 * A clear ask about another item must not be filed onto the cursor.
 */
export function resolveAskedAgendaItem(
  agenda: readonly {
    id: string;
    label: string;
    status?: string;
    supports?: string;
    collection_goal?: string;
  }[],
  lastAsked: string,
  focus: { id: string; label: string } | null,
): AskedAgendaResolution {
  const focusItem =
    agenda.find((a) => a.id === focus?.id || a.label === focus?.label) ?? null;
  const onFocus: AskedAgendaResolution = {
    target: focusItem,
    off_focus: false,
    capture: true,
    cover: true,
  };
  if (!focus || !lastAsked.trim() || agenda.length === 0) return onFocus;

  const askedHan = lastAsked.replace(/[^\u4e00-\u9fff]/g, "");
  if (askedHan.length < 2) return onFocus;

  const scored = agenda.map((a) => ({
    a,
    score: scoreAskAgainstItem(a, lastAsked, askedHan),
  }));
  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    // Prefer uncovered when scores tie — avoid stacking onto a wrong covered row.
    const xu = x.a.status === "covered" ? 1 : 0;
    const yu = y.a.status === "covered" ? 1 : 0;
    if (xu !== yu) return xu - yu;
    return agenda.indexOf(x.a) - agenda.indexOf(y.a);
  });
  const top = scored[0];
  const second = scored[1];
  const focusScore =
    scored.find((s) => s.a.id === focus.id || s.a.label === focus.label)?.score ?? 0;

  if (!top || top.score < 2) return onFocus;
  const tied =
    Boolean(second) &&
    second!.score === top.score &&
    top.a.id !== focus.id &&
    top.a.label !== focus.label;
  if (tied && top.score < 6) return onFocus;
  if (top.a.id === focus.id || top.a.label === focus.label || top.score <= focusScore) {
    return onFocus;
  }

  const covered = top.a.status === "covered";
  return {
    target: top.a,
    off_focus: true,
    capture: !covered || top.score >= 6,
    cover: !covered,
  };
}

/**
 * Whether model-reported completed_in_this_turn hits the current focus.
 * Accepts exact label, exact id, or containment when either side is long enough.
 */
export function agendaReportMatchesFocus(
  reported: readonly string[] | null | undefined,
  focus: { id: string; label: string } | null | undefined,
): boolean {
  if (!focus || !reported?.length) return false;
  const labelN = normalizeAgendaRef(focus.label);
  const idN = normalizeAgendaRef(focus.id);
  if (!labelN && !idN) return false;

  for (const raw of reported) {
    if (typeof raw !== "string") continue;
    const n = normalizeAgendaRef(raw);
    if (!n) continue;
    if (labelN && n === labelN) return true;
    if (idN && n === idN) return true;
    if (labelN.length >= 4 && (n.includes(labelN) || labelN.includes(n))) return true;
    if (idN.length >= 2 && (n === idN || n.includes(idN) || idN.includes(n))) return true;
  }
  return false;
}
