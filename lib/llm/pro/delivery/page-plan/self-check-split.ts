const NEGATIVE_RE =
  /压力|易栽|未熟|过耗|过刚|压制|阻力|忌|盲|耗|崩|风险|熔断|红灯|坑|警戒|不宜|硬冲|耗尽|失控|失眠|催促|加塞|英雄|警惕|勿|禁|避免|止损|刹车/;

const POSITIVE_RE =
  /可试|窗口|顺势|可推进|宜|杠杆|恢复|蓄力|巩固|微行动|今晚|本周|抓手|机会|缓冲|节奏/;

/** Split self_check_signals into negative (P5) vs positive (P6) buckets. */
export function splitSelfCheckSignals(signals: readonly string[]): {
  negative: string[];
  positive: string[];
} {
  const negative: string[] = [];
  const positive: string[] = [];
  for (const s of signals) {
    const t = s.trim();
    if (!t) continue;
    const neg = NEGATIVE_RE.test(t);
    const pos = POSITIVE_RE.test(t);
    if (neg && !pos) negative.push(t);
    else if (pos && !neg) positive.push(t);
    else if (neg) negative.push(t);
    else positive.push(t);
  }
  return { negative, positive };
}
