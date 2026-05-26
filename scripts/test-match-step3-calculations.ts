/**
 * Match Calculation Engine — Step 3 unit tests (spouse star / shensha / luck cycle).
 * Run: pnpm test:match-step3
 */

import { calculateSpouseStar } from '../lib/match/calculations/spouse-star';
import { calculateShenShaResonance } from '../lib/match/calculations/shensha-resonance';
import { calculateLuckCycleSync } from '../lib/match/calculations/luck-cycle-sync';
import { calculateTenGod } from '../lib/match/data/stems-branches';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// 1. 双向配偶星 — 男庚女乙(日主互为对方配偶星)
const gengMaleYiFemale = calculateSpouseStar({
  a_day_master: '庚',
  a_gender: 'M',
  a_all_stems: { year: '戊', month: '丙', day: '庚', hour: '壬' },
  b_day_master: '乙',
  b_gender: 'F',
  b_all_stems: { year: '丁', month: '癸', day: '乙', hour: '戊' }
});
assertEq(calculateTenGod('庚', '乙'), '正财', '庚男见乙为正财');
assertEq(calculateTenGod('乙', '庚'), '正官', '乙女见庚为正官');
assert(gengMaleYiFemale.a_is_b_spouse_star, 'A(庚)是 B(乙)的正官');
assert(gengMaleYiFemale.b_is_a_spouse_star, 'B(乙)是 A(庚)的正财');
assert(gengMaleYiFemale.a_is_b_spouse_star && gengMaleYiFemale.b_is_a_spouse_star, '双向配偶星');
assertEq(gengMaleYiFemale.score, 10, '双向+18, 双方命盘无配偶星柱 -8 → 10');

// 单向配偶星: 男甲女己 — 己为甲之正财
const jiaMaleJiFemale = calculateSpouseStar({
  a_day_master: '甲',
  a_gender: 'M',
  a_all_stems: { year: '丙', month: '庚', day: '甲', hour: '壬' },
  b_day_master: '己',
  b_gender: 'F',
  b_all_stems: { year: '戊', month: '癸', day: '己', hour: '丁' }
});
assert(jiaMaleJiFemale.b_is_a_spouse_star, '己日主是甲男之正财');
assertEq(calculateTenGod('甲', '己'), '正财', '甲见己正财');
assert(jiaMaleJiFemale.score >= 10, '单向配偶星加分');

// 乙庚经典: 十神为正官(严格配偶星类型为正财, 不记 b_is_a)
assertEq(calculateTenGod('乙', '庚'), '正官', '乙见庚为正官');

// 2. 双桃花共振 — 申年/子年桃花皆在酉, 双方月支酉
const taoHuaRes = calculateShenShaResonance({
  a_day_master: '庚',
  a_year_branch: '申',
  a_day_branch: '子',
  a_branches: { year: '申', month: '酉', day: '子', hour: '寅' },
  b_day_master: '甲',
  b_year_branch: '申',
  b_day_branch: '辰',
  b_branches: { year: '申', month: '酉', day: '辰', hour: '午' }
});
assert(taoHuaRes.both_tao_hua, '双方命盘均有桃花');
assert(taoHuaRes.score >= 4, '双桃花加分');

// 3. 大运地支相合 — 子丑六合
const luckHe = calculateLuckCycleSync({
  a_current_dayun_stem: '辛',
  a_current_dayun_branch: '丑',
  a_dayun_rising: true,
  b_current_dayun_stem: '癸',
  b_current_dayun_branch: '子',
  b_dayun_rising: true
});
assert(luckHe.branches_he, '大运丑子六合');
assert(luckHe.both_rising, '双方运势上升');
assert(luckHe.score >= 8, '合+上升得分');

// 大运六冲对照
const luckChong = calculateLuckCycleSync({
  a_current_dayun_stem: '甲',
  a_current_dayun_branch: '子',
  a_dayun_rising: false,
  b_current_dayun_stem: '丙',
  b_current_dayun_branch: '午',
  b_dayun_rising: false
});
assert(luckChong.branches_chong, '大运子午冲');
assert(luckChong.both_declining, '双方衰退');

console.log('✓ 双向配偶星 男庚女乙:', {
  mutual: gengMaleYiFemale.a_is_b_spouse_star && gengMaleYiFemale.b_is_a_spouse_star,
  score: gengMaleYiFemale.score
});
console.log('✓ 单向 男甲女己:', {
  b_is_a: jiaMaleJiFemale.b_is_a_spouse_star,
  score: jiaMaleJiFemale.score
});
console.log('✓ 双桃花:', taoHuaRes.both_tao_hua, 'score', taoHuaRes.score);
console.log('✓ 大运相合 辛丑+癸子:', luckHe.branches_he, 'score', luckHe.score);
console.log('✓ 大运相冲 甲子+丙午:', luckChong.branches_chong, 'score', luckChong.score);
console.log('\nMatch Step 3 — all tests passed.');
