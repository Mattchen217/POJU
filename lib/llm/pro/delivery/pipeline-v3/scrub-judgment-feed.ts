/**
 * Pipeline v3 · scrub prescription / means language out of judgment feeds.
 * Keeps structural qimen/bazi facts; strips 宜…/露锋/静默差 etc. (category bans).
 * Never mutates lines that are already 禁区说明（避免把「禁写宜守」改坏）。
 */

function scrubContentLine(line: string): string {
  // Ban / meta lines: leave intact (must not rewrite 宜守 inside 禁写宜守…).
  if (/禁写|禁抄|禁止|批断禁|只写结构|勿含宜/.test(line)) return line;

  let s = line;
  s = s.replace(/宜守中选点[。.]?/g, "攻守交织、窗口收窄。");
  s = s.replace(/宜守中带进[。.]?/g, "气候平稳、进取窗口未明。");
  s = s.replace(/宜守、控扩张[。.]?/g, "偏耗泄、扩张承压偏高。");
  s = s.replace(/宜守[。.]?/g, "承压偏高。");
  s = s.replace(
    /先判攻守松紧再写手段/g,
    "先判攻守松紧（批断只写松紧，不写手段）",
  );
  s = s.replace(
    /先立信息静默的节奏差，再决定是否露锋/g,
    "场域声势易虚高、落实不确定",
  );
  s = s.replace(
    /我侧宜拉开时空差，忌缠斗耗气/g,
    "我侧忌缠斗耗气、胶着承压",
  );
  s = s.replace(/宜拉开时空差[，,]?/g, "");
  s = s.replace(/再决定是否露锋/g, "");
  s = s.replace(/不急于露锋/g, "");
  s = s.replace(
    /宜退避防损[，,]?先护己气/g,
    "退避门当值、护气张力偏高",
  );
  s = s.replace(/宜退避防损/g, "退避门当值、耗损张力偏高");
  s = s.replace(/宜进取开创[^\n，。]{0,24}/g, "进取门当值");
  s = s.replace(/宜守养休整[^\n，。]{0,24}/g, "守养门当值");
  s = s.replace(/宜藏隐试探[^\n，。]{0,24}/g, "藏隐门当值");
  s = s.replace(/宜显名示能[^\n，。]{0,24}/g, "显名门当值");
  return s;
}

/** Strip P4-style action micro-script and 宜… prescription tails from any feed blob. */
export function scrubJudgmentFeedPrescriptions(raw: string): string {
  let t = raw.trim();
  if (!t) return t;

  // Drop adversarial micro-script (means-shaped; for body/moat only).
  // Inserted text must NOT contain the substring「宜守」—otherwise later passes corrupt it.
  t = t.replace(
    /【敌·我·时·空[^\n]*】[\s\S]*?(?=\n【|\n##|$)/g,
    "【奇门结构】值使门宫/主客/场域虚实见上方锁盘行；批断只写结构张力，禁抄退避/守中/静默/露锋动作句。\n",
  );

  // Soften 局势取向 lines that embed 宜退避…（replacement 不含「宜守」二字）
  t = t.replace(/局势取向:\s*[^\n]+/g, (line) => {
    const door = line.match(/（\s*([^·（]+)·/);
    const doorZh = door?.[1]?.trim();
    return doorZh
      ? `局势结构: 值使「${doorZh}」当值 · 场域张力见锁盘（批断禁写攻守祈使）`
      : "局势结构: 值使门当值 · 场域张力见锁盘（批断禁写攻守祈使）";
  });

  t = t
    .split("\n")
    .map(scrubContentLine)
    .join("\n");

  return t.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * 共享 Fact-pack 常含奇门锁盘；对**未授权奇门**的页，组装后剥块，避免串页污染。
 * 授权由 `pageFeedFlags(key).qimen` 决定（目前仅 P4），不是「去奇门运动」。
 * @deprecated 名保留兼容；请用 stripQimenBlocksUnlessPageAllows
 */
export function stripQimenBlocksForFoundationAttribution(raw: string): string {
  return stripQimenBlocksUnlessPageAllows(raw);
}

/** @deprecated 旧名；同 stripQimenBlocksUnlessPageAllows */
export function stripQimenBlocksFromNonP4Feed(raw: string): string {
  return stripQimenBlocksUnlessPageAllows(raw);
}

/** 从喂料 blob 剥奇门锁盘 / 结构占位 / 敌我微剧本（仅当该页不允许 qimen 时调用）。 */
export function stripQimenBlocksUnlessPageAllows(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(
    /【奇门锁盘[^\n]*】[\s\S]*?(?=\n【P2 |\n【本案|\n## |$)/g,
    "",
  );
  t = t.replace(/【奇门结构】[^\n]*\n?/g, "");
  t = t.replace(/【敌·我·时·空[^\n]*】[\s\S]*?(?=\n【|\n##|$)/g, "");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}
