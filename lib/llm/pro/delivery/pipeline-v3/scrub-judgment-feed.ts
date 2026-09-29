/**
 * Pipeline v3 · scrub prescription / means language out of judgment feeds.
 * Keeps structural qimen/bazi facts; strips 宜…/露锋/静默差 etc. (category bans).
 */

/** Strip P4-style action micro-script and 宜… prescription tails from any feed blob. */
export function scrubJudgmentFeedPrescriptions(raw: string): string {
  let t = raw.trim();
  if (!t) return t;

  // Drop adversarial micro-script block (means-shaped; for body/moat only).
  t = t.replace(
    /【敌·我·时·空[^\n]*】[\s\S]*?(?=\n【|\n##|$)/g,
    "【奇门结构】值使门宫/主客/场域虚实见上方锁盘行；批断只写结构张力，禁抄宜守/静默/露锋动作句。\n",
  );

  // Soften 局势取向 lines that embed 宜退避…
  t = t.replace(
    /局势取向:\s*[^\n]+/g,
    (line) => {
      const door = line.match(/（\s*([^·（]+)·/);
      const doorZh = door?.[1]?.trim();
      return doorZh
        ? `局势结构: 值使「${doorZh}」当值 · 场域张力见锁盘（批断禁写宜退避/宜守等攻守祈使）`
        : "局势结构: 值使门当值 · 场域张力见锁盘（批断禁写宜退避/宜守等攻守祈使）";
    },
  );

  // Drop / neutralize common prescription stems in inventory & polarity notes.
  t = t
    .replace(/宜守中选点[。.]?/g, "攻守交织、窗口收窄。")
    .replace(/宜守中带进[。.]?/g, "气候平稳、进取窗口未明。")
    .replace(/宜守、控扩张[。.]?/g, "偏耗泄、扩张承压偏高。")
    .replace(/宜守[。.]?/g, "承压偏高。")
    .replace(/先判攻守松紧再写手段/g, "先判攻守松紧（批断只写松紧，不写手段）")
    .replace(/先立信息静默的节奏差，再决定是否露锋/g, "场域声势易虚高、落实不确定")
    .replace(/我侧宜拉开时空差，忌缠斗耗气/g, "我侧忌缠斗耗气、胶着承压")
    .replace(/宜拉开时空差[，,]?/g, "")
    .replace(/再决定是否露锋/g, "")
    .replace(/不急于露锋/g, "")
    .replace(/宜退避防损[，,]?先护己气/g, "退避门当值、护气张力偏高")
    .replace(/宜退避防损/g, "退避门当值、耗损张力偏高")
    .replace(/宜进取开创[^\n，。]{0,24}/g, "进取门当值")
    .replace(/宜守养休整[^\n，。]{0,24}/g, "守养门当值")
    .replace(/宜藏隐试探[^\n，。]{0,24}/g, "藏隐门当值")
    .replace(/宜显名示能[^\n，。]{0,24}/g, "显名门当值");

  return t.replace(/\n{3,}/g, "\n\n").trim();
}
