/**
 * Match Calculation Engine — Step 2 unit tests (day master / yong shen / branches).
 * Run: pnpm test:match-step2
 */

import { calculateDayMasterInteraction } from '../lib/match/calculations/day-master-interaction';
import { calculateYongShenMatch } from '../lib/match/calculations/yong-shen-match';
import { calculateBranchInteractions } from '../lib/match/calculations/branch-interactions';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// 1. 天干五合 — 甲己合化土
const jiaJi = calculateDayMasterInteraction('甲', '己');
assertEq(jiaJi.type, 'tianhe', '甲己 → tianhe');
assert(jiaJi.score >= 15, '甲己合得分高');
assert(jiaJi.description_zh.includes('中正之合'), '含合名');

// 2. 天干七冲 — 甲庚冲
const jiaGeng = calculateDayMasterInteraction('甲', '庚');
assertEq(jiaGeng.type, 'tianchong', '甲庚 → tianchong');
assert(jiaGeng.score <= -10, '甲庚冲得分负');

// 乙庚合(对照)
const yiGeng = calculateDayMasterInteraction('乙', '庚');
assertEq(yiGeng.type, 'tianhe', '乙庚 → tianhe');

// 3. 用神匹配 — abundant / lacking
const abundant = calculateYongShenMatch({
  a_yong_shen_primary: '水',
  b_yong_shen_primary: '木',
  a_wuxing_distribution: { '木': 3, '火': 1, '土': 1, '金': 0, '水': 1 },
  b_wuxing_distribution: { '木': 1, '火': 1, '土': 1, '金': 0, '水': 3 }
});
assertEq(abundant.a_yong_shen_in_b, 'abundant', 'A用神水在B盘充沛');
assertEq(abundant.b_yong_shen_in_a, 'abundant', 'B用神木在A盘充沛');
assert(abundant.score > 10, '双向充沛得分高');
assert(abundant.a_supports_b && abundant.b_supports_a, '双向互助');

const lacking = calculateYongShenMatch({
  a_yong_shen_primary: '金',
  b_yong_shen_primary: '火',
  a_wuxing_distribution: { '木': 2, '火': 0, '土': 2, '金': 0, '水': 2 },
  b_wuxing_distribution: { '木': 2, '火': 1, '土': 2, '金': 0, '水': 1 }
});
assertEq(lacking.a_yong_shen_in_b, 'lacking', 'A用神金在B盘缺乏');
assertEq(lacking.b_yong_shen_in_a, 'lacking', 'B用神火在A盘缺乏');
assert(lacking.score < 0, '双向缺乏得分负');

// 4. 日支相合 — 子丑
const heResult = calculateBranchInteractions(
  { year: '寅', month: '卯', day: '子', hour: '辰' },
  { year: '午', month: '巳', day: '丑', hour: '戌' }
);
assert(heResult.day_branch_he, '日支子丑合');
assert(!heResult.day_branch_chong, '日支无冲');
assert(heResult.score > 0, '合盘得分正');

// 5. 日支相冲 — 子午
const chongResult = calculateBranchInteractions(
  { year: '寅', month: '卯', day: '子', hour: '辰' },
  { year: '午', month: '巳', day: '午', hour: '戌' }
);
assert(chongResult.day_branch_chong, '日支子午冲');
assert(!chongResult.day_branch_he, '日支无合');
assert(chongResult.score <= -10, '冲盘得分负');

console.log('✓ 天干五合 甲己:', jiaJi.type, 'score', jiaJi.score);
console.log('✓ 天干七冲 甲庚:', jiaGeng.type, 'score', jiaGeng.score);
console.log('✓ 用神 abundant score:', abundant.score, '| lacking score:', lacking.score);
console.log('✓ 日支子丑合 score:', heResult.score, '| 子午冲 score:', chongResult.score);
console.log('\nMatch Step 2 — all 5 tests passed.');
