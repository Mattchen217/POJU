/**
 * Match Calculation Engine — Step 4 tests (compatibility matrix).
 * Run: pnpm test:match-step4
 */

import {
  calculateCompatibilityMatrix,
  scoreToCompatibilityLevel,
} from '../lib/match/calculate-compatibility';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

const profileA_classical = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: '丁', year_branch: '巳',
        month_stem: '癸', month_branch: '丑',
        day_stem: '乙', day_branch: '子',
        hour_stem: '戊', hour_branch: '寅'
      },
      gender: 'M' as const,
      yong_shen: { primary_element: '水' },
      wuxing_distribution: { '木': 2, '火': 1, '土': 2, '金': 0, '水': 2 },
      da_yun: { current: { stem: '辛', branch: '亥', is_favorable: true } }
    }
  }
};

const profileB_classical = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: '戊', year_branch: '午',
        month_stem: '甲', month_branch: '寅',
        day_stem: '庚', day_branch: '丑',
        hour_stem: '丁', hour_branch: '亥'
      },
      gender: 'F' as const,
      yong_shen: { primary_element: '木' },
      wuxing_distribution: { '木': 2, '火': 2, '土': 2, '金': 1, '水': 1 },
      da_yun: { current: { stem: '丁', branch: '巳', is_favorable: true } }
    }
  }
};

const classical = calculateCompatibilityMatrix({
  profileA: profileA_classical,
  profileB: profileB_classical
});

assertEq(classical.day_master_interaction.type, 'tianhe', '乙庚天干五合');
assert(classical.day_master_interaction.score > 15, '天干合得分');
assert(classical.branch_interactions.day_branch_he, '日支子丑合');
assert(
  ['highly_compatible', 'compatible_with_effort'].includes(classical.overall_level),
  `经典合盘等级: ${classical.overall_level}`
);
assert(
  classical.key_insights.strengths.includes('marriage_palace_bond'),
  'marriage_palace_bond 优势标签'
);

const profileA_clash = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: '癸', year_branch: '亥',
        month_stem: '丙', month_branch: '辰',
        day_stem: '甲', day_branch: '子',
        hour_stem: '丙', hour_branch: '寅'
      },
      gender: 'M' as const,
      yong_shen: { primary_element: '水' },
      wuxing_distribution: { '木': 2, '火': 2, '土': 1, '金': 0, '水': 3 },
      da_yun: { current: { stem: '甲', branch: '寅', is_favorable: true } }
    }
  }
};

const profileB_clash = {
  base_analysis: {
    content: {
      bazi: {
        year_stem: '甲', year_branch: '戌',
        month_stem: '丙', month_branch: '寅',
        day_stem: '庚', day_branch: '午',
        hour_stem: '辛', hour_branch: '巳'
      },
      gender: 'F' as const,
      yong_shen: { primary_element: '土' },
      wuxing_distribution: { '木': 2, '火': 3, '土': 1, '金': 2, '水': 0 },
      da_yun: { current: { stem: '戊', branch: '辰', is_favorable: false } }
    }
  }
};

const clash = calculateCompatibilityMatrix({
  profileA: profileA_clash,
  profileB: profileB_clash
});

assert(clash.branch_interactions.day_branch_chong, '日支子午冲');
assertEq(clash.day_master_interaction.type, 'tianchong', '甲庚天干七冲');
assert(
  ['challenging', 'highly_challenging'].includes(clash.overall_level),
  `经典冲盘等级: ${clash.overall_level}`
);
assert(
  clash.key_insights.challenges.includes('marriage_palace_clash'),
  'marriage_palace_clash 挑战标签'
);

const r1 = calculateCompatibilityMatrix({
  profileA: profileA_classical,
  profileB: profileB_classical
});
const r2 = calculateCompatibilityMatrix({
  profileA: profileA_classical,
  profileB: profileB_classical
});
assertEq(r1.weighted_total_score, r2.weighted_total_score, '确定性: 分数');
assertEq(r1.overall_level, r2.overall_level, '确定性: 等级');

// 5 等级边界
assertEq(scoreToCompatibilityLevel(40), 'highly_compatible', 'level 40');
assertEq(scoreToCompatibilityLevel(15), 'compatible_with_effort', 'level 15');
assertEq(scoreToCompatibilityLevel(0), 'neutral', 'level 0');
assertEq(scoreToCompatibilityLevel(-15), 'neutral', 'level -15');
assertEq(scoreToCompatibilityLevel(-40), 'challenging', 'level -40');
assertEq(scoreToCompatibilityLevel(-41), 'highly_challenging', 'level -41');

// 权重总和 100%
const w = classical._meta.weights;
const sum = Object.values(w).reduce((a, b) => a + b, 0);
assert(Math.abs(sum - 1) < 0.001, '权重总和为 1');

console.log('✓ 经典合盘 乙庚+子丑:');
console.log('    level:', classical.overall_level, 'score:', classical.weighted_total_score);
console.log('    strengths:', classical.key_insights.strengths.join(', '));
console.log('✓ 经典冲盘 甲庚+子午:');
console.log('    level:', clash.overall_level, 'score:', clash.weighted_total_score);
console.log('    challenges:', clash.key_insights.challenges.join(', '));
console.log('✓ 确定性 + 等级映射 + 权重校验通过');
console.log('\nMatch Step 4 — all tests passed.');
