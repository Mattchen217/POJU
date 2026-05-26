// lib/match/calculations/shensha-resonance.ts

import { checkAllShenSha, type ShenShaName } from '../data/shensha';
import type { HeavenlyStem, EarthlyBranch } from '../data/stems-branches';

export interface ShenShaResonanceResult {
  shared_auspicious: ShenShaName[];
  shared_inauspicious: ShenShaName[];
  cross_gui_ren_aid: boolean;
  both_tao_hua: boolean;
  both_hua_gai: boolean;
  gu_chen_gua_su_present: boolean;
  score: number;
  description_zh: string;
  description_en: string;
}

const AUSPICIOUS_SHENSHA: ShenShaName[] = ['天乙贵人', '文昌', '桃花', '驿马', '华盖'];
const INAUSPICIOUS_SHENSHA: ShenShaName[] = ['孤辰', '寡宿'];

export function calculateShenShaResonance(input: {
  a_day_master: HeavenlyStem;
  a_year_branch: EarthlyBranch;
  a_day_branch: EarthlyBranch;
  a_branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
  b_day_master: HeavenlyStem;
  b_year_branch: EarthlyBranch;
  b_day_branch: EarthlyBranch;
  b_branches: Record<'year' | 'month' | 'day' | 'hour', EarthlyBranch>;
}): ShenShaResonanceResult {

  const aShenSha = checkAllShenSha({
    dayMaster: input.a_day_master,
    yearBranch: input.a_year_branch,
    dayBranch: input.a_day_branch,
    branches: input.a_branches
  });

  const bShenSha = checkAllShenSha({
    dayMaster: input.b_day_master,
    yearBranch: input.b_year_branch,
    dayBranch: input.b_day_branch,
    branches: input.b_branches
  });

  const aFoundMap = new Map<ShenShaName, boolean>();
  const bFoundMap = new Map<ShenShaName, boolean>();
  for (const s of aShenSha) aFoundMap.set(s.name, s.found);
  for (const s of bShenSha) bFoundMap.set(s.name, s.found);

  const sharedAuspicious = AUSPICIOUS_SHENSHA.filter(
    name => aFoundMap.get(name) && bFoundMap.get(name)
  );

  const sharedInauspicious = INAUSPICIOUS_SHENSHA.filter(
    name => aFoundMap.get(name) && bFoundMap.get(name)
  );

  const bothTaoHua = aFoundMap.get('桃花') === true && bFoundMap.get('桃花') === true;

  const bothHuaGai = aFoundMap.get('华盖') === true && bFoundMap.get('华盖') === true;

  const guChenGuaSu =
    (aFoundMap.get('孤辰') && bFoundMap.get('寡宿')) ||
    (bFoundMap.get('孤辰') && aFoundMap.get('寡宿'));

  const crossGuiRenAid = aFoundMap.get('天乙贵人') === true || bFoundMap.get('天乙贵人') === true;

  let score = 0;
  score += sharedAuspicious.length * 3;
  score += bothTaoHua ? 4 : 0;
  score += crossGuiRenAid ? 5 : 0;

  score -= sharedInauspicious.length * 4;
  score -= bothHuaGai ? 3 : 0;
  score -= guChenGuaSu ? 8 : 0;

  const stats = {
    sharedAuspicious,
    sharedInauspicious,
    bothTaoHua,
    bothHuaGai,
    guChenGuaSu,
    crossGuiRenAid
  };

  return {
    shared_auspicious: sharedAuspicious,
    shared_inauspicious: sharedInauspicious,
    cross_gui_ren_aid: crossGuiRenAid,
    both_tao_hua: bothTaoHua,
    both_hua_gai: bothHuaGai,
    gu_chen_gua_su_present: !!guChenGuaSu,
    score: Math.max(-15, Math.min(15, score)),
    description_zh: buildShenShaDescriptionZh(stats),
    description_en: buildShenShaDescriptionEn(stats)
  };
}

function buildShenShaDescriptionZh(s: {
  sharedAuspicious: ShenShaName[];
  sharedInauspicious: ShenShaName[];
  bothTaoHua: boolean;
  bothHuaGai: boolean;
  guChenGuaSu: boolean | undefined;
  crossGuiRenAid: boolean;
}): string {
  const parts: string[] = [];
  if (s.crossGuiRenAid) parts.push('一方或双方有天乙贵人,得贵人助');
  if (s.bothTaoHua) parts.push('双桃花,感情吸引强');
  if (s.sharedAuspicious.length > 0) parts.push(`共有吉神煞:${s.sharedAuspicious.join('、')}`);
  if (s.bothHuaGai) parts.push('双华盖,智慧但偏孤');
  if (s.sharedInauspicious.length > 0) parts.push(`共有凶神煞:${s.sharedInauspicious.join('、')}`);
  if (s.guChenGuaSu) parts.push('一孤一寡,传统不利婚配');
  return parts.length > 0 ? parts.join(';') + '。' : '神煞共振平淡。';
}

function buildShenShaDescriptionEn(s: {
  sharedAuspicious: ShenShaName[];
  sharedInauspicious: ShenShaName[];
  bothTaoHua: boolean;
  bothHuaGai: boolean;
  guChenGuaSu: boolean | undefined;
  crossGuiRenAid: boolean;
}): string {
  const parts: string[] = [];
  if (s.crossGuiRenAid) parts.push('Noble person assistance available');
  if (s.bothTaoHua) parts.push('Mutual peach blossom — magnetic attraction');
  if (s.sharedAuspicious.length > 0) parts.push(`Shared auspicious stars: ${s.sharedAuspicious.join(', ')}`);
  if (s.bothHuaGai) parts.push('Both have hua gai — wise but tendency toward solitude');
  if (s.sharedInauspicious.length > 0) parts.push(`Shared challenging stars: ${s.sharedInauspicious.join(', ')}`);
  if (s.guChenGuaSu) parts.push('Gu chen and gua su present — traditionally unfavorable');
  return parts.length > 0 ? parts.join('; ') + '.' : 'Neutral symbolic-star resonance.';
}
