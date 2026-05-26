/**
 * Match Calculation Engine — Step 1 unit tests (stems / branch relations / shensha).
 * Run: pnpm test:match-step1
 */

import { calculateTenGod } from '../lib/match/data/stems-branches';
import { isLiuHe, isLiuChong, isXing } from '../lib/match/data/branch-relations';
import { checkAllShenSha } from '../lib/match/data/shensha';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

// --- calculateTenGod ---
assertEq(calculateTenGod('甲', '甲'), '比肩', '甲甲 比肩');
assertEq(calculateTenGod('甲', '乙'), '劫财', '甲乙 劫财');
assertEq(calculateTenGod('甲', '丙'), '食神', '甲生丙 食神');
assertEq(calculateTenGod('甲', '丁'), '伤官', '甲生丁 伤官');
assertEq(calculateTenGod('甲', '戊'), '偏财', '甲克戊 偏财');
assertEq(calculateTenGod('甲', '己'), '正财', '甲克己 正财');
assertEq(calculateTenGod('甲', '庚'), '七杀', '庚克甲 七杀');
assertEq(calculateTenGod('甲', '辛'), '正官', '辛克甲 正官');
assertEq(calculateTenGod('甲', '壬'), '偏印', '壬生甲 偏印');
assertEq(calculateTenGod('甲', '癸'), '正印', '癸生甲 正印');

// 乙日主: 庚为正官
assertEq(calculateTenGod('乙', '庚'), '正官', '乙见庚 正官');

// --- branch relations ---
const ziChou = isLiuHe('子', '丑');
assert(ziChou.isHe, '子丑六合');
assertEq(ziChou.element, '合化土', '子丑合化土');

assert(!isLiuHe('子', '午').isHe, '子午非六合');
assert(isLiuChong('子', '午'), '子午六冲');
assert(isLiuChong('午', '子'), '午子六冲(反向)');

const ziMao = isXing('子', '卯');
assert(ziMao.isXing, '子卯刑');
assertEq(ziMao.type, '无礼之刑', '无礼之刑');

const chenSelf = isXing('辰', '辰');
assert(chenSelf.isXing, '辰辰自刑');
assertEq(chenSelf.type, '自刑', '自刑');

// --- checkAllShenSha ---
// 甲日主: 天乙贵人在丑、未; 文昌在巳
const shenA = checkAllShenSha({
  dayMaster: '甲',
  yearBranch: '子',
  dayBranch: '子',
  branches: { year: '丑', month: '巳', day: '子', hour: '午' }
});
const guiRen = shenA.find(s => s.name === '天乙贵人');
assert(!!guiRen?.found, '甲命盘丑柱有天乙贵人');
assert(!!guiRen?.positions.includes('year'), '贵人在年支');

const wenChang = shenA.find(s => s.name === '文昌');
assert(!!wenChang?.found, '甲命盘巳柱有文昌');
assert(!!wenChang?.positions.includes('month'), '文昌在月支');

// 申年支桃花 → 酉
const shenB = checkAllShenSha({
  dayMaster: '庚',
  yearBranch: '申',
  dayBranch: '子',
  branches: { year: '申', month: '酉', day: '子', hour: '寅' }
});
const taoHua = shenB.find(s => s.name === '桃花');
assert(!!taoHua?.found, '申年桃花在酉');
assert(!!taoHua?.positions.includes('month'), '月支酉为桃花');

console.log('✓ calculateTenGod: 11 cases passed');
console.log('✓ isLiuHe / isLiuChong / isXing: 7 cases passed');
console.log('✓ checkAllShenSha: 2 profiles passed');
console.log('\nMatch Step 1 — all tests passed.');
