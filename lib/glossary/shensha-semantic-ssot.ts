/**
 * Shen-sha semantic SSOT — safety firewall + tension-aware translation.
 * Keys = CLOSED_SHEN_SHA. Dual consumers: guard prompts + purity scan.
 * Not pure positive labels; not a second closed set.
 */

import { CLOSED_SHEN_SHA, type ClosedShenSha } from "@/lib/glossary/term-closed-set";

export type ShenshaSemanticRow = {
  id: ClosedShenSha;
  /** Mechanism including tension/cost — not only upsides. */
  frame: string;
  user_facing_direction: string;
  /** Optional load / boundary note. */
  load_or_edge: string;
  /** Horror / fate claims banned in user-facing prose. */
  forbidden_claims: readonly string[];
  never: string;
};

/** Shared fate-horror phrases (any shen-sha context). */
export const SHENSHA_SHARED_HORROR_CLAIMS: readonly string[] = [
  "血光之灾",
  "血光",
  "横死",
  "注定孤独",
  "一生孤独",
  "孤苦伶仃",
  "破家",
  "家破人亡",
  "必遭官非",
  "牢狱之灾",
  "克死",
  "克夫",
  "克妻",
  "克子",
  "短命",
  "天打雷劈",
  "厉鬼",
  "邪术",
  "改命成功",
  "注定离婚",
  "注定破产",
];

export const SHENSHA_SEMANTIC_SSOT: Record<ClosedShenSha, ShenshaSemanticRow> = {
  天乙贵人: {
    id: "天乙贵人",
    frame: "关键节点易遇到愿伸手的人；助力不稳定，不可当外挂。",
    user_facing_direction: "重要关头主动寻求可信任的缓冲人",
    load_or_edge: "过度依赖贵人会削弱自己的决断练习",
    forbidden_claims: ["贵人救命", "遇贵则发", "命里自有贵人罩着"],
    never: "承诺必有人替你善后",
  },
  禄神: {
    id: "禄神",
    frame: "资源与名分通道相对顺；顺不等于无代价消耗。",
    user_facing_direction: "把稳定供给用在可复利的能力上",
    load_or_edge: "顺境易松懈边界",
    forbidden_claims: ["禄神主大富", "一生不愁钱"],
    never: "财富宿命保证",
  },
  飞刃: {
    id: "飞刃",
    frame: "高压聚焦与切割力强，伴随冲动/过刚风险（羊刃同义）。",
    user_facing_direction: "发挥专注峰值，同时设冷却与止损",
    load_or_edge: "易伤人或自伤式硬刚",
    forbidden_claims: ["血光之灾", "刀光剑影", "必伤人", "凶死", "羊刃主血光"],
    never: "暴力/血光恐吓",
  },
  文昌: {
    id: "文昌",
    frame: "学习、表达、文书通道开；开了不等于自动成名。",
    user_facing_direction: "把想法写成结构再对外",
    load_or_edge: "空谈不落地时耗能",
    forbidden_claims: ["必中科举", "文昌必成名"],
    never: "学历/功名铁口",
  },
  桃花: {
    id: "桃花",
    frame: "社交吸引力与被看见度高；曝光也带来纠缠与分心。",
    user_facing_direction: "有意识管理曝光与关系边界",
    load_or_edge: "易被人情消耗",
    forbidden_claims: ["烂桃花", "必出轨", "命犯桃花", "克配偶"],
    never: "婚外情宿命",
  },
  驿马: {
    id: "驿马",
    frame: "迁移、切换、在路上的动能强；静不下来时易空耗。",
    user_facing_direction: "把移动动能用在有目的的切换上",
    load_or_edge: "漂泊感、难沉淀",
    forbidden_claims: ["驿马主奔波一生", "不得安生"],
    never: "永久流浪诅咒",
  },
  华盖: {
    id: "华盖",
    frame: "独处、深度、非常规兴趣通道；过度封闭会脱节。",
    user_facing_direction: "保留深度独处，也设最低社交维系",
    load_or_edge: "孤僻、难被理解",
    forbidden_claims: ["华盖主孤独一生", "出家命", "注定无伴"],
    never: "强制宗教/孤独宿命",
  },
  孤辰: {
    id: "孤辰",
    frame: "自立倾向强，亲密协作成本高；不是道德缺陷。",
    user_facing_direction: "合作前先写清边界与节奏",
    load_or_edge: "易被读成冷淡",
    forbidden_claims: ["注定孤独", "孤辰寡宿克亲", "无子女缘"],
    never: "亲缘灭绝恐吓",
  },
  寡宿: {
    id: "寡宿",
    frame: "情感上偏自守，关系需要更长预热；可经营而非命定。",
    user_facing_direction: "亲密关系用慢节奏与明确期待",
    load_or_edge: "被误读为拒绝亲近",
    forbidden_claims: ["寡妇命", "克夫", "注定晚婚不幸"],
    never: "配偶死亡/不幸恐吓",
  },
  将星: {
    id: "将星",
    frame: "扛事与组织势能；扛太多会过载。",
    user_facing_direction: "在关键战役里扛责，同时授权卸压",
    load_or_edge: "英雄式透支",
    forbidden_claims: ["将星主掌权发财", "必为领导"],
    never: "权位铁口",
  },
  劫煞: {
    id: "劫煞",
    frame: "突发打断与资源被抽走的风险感；提醒备份而非诅咒。",
    user_facing_direction: "关键节点留备份与退出方案",
    load_or_edge: "焦虑式预防过度",
    forbidden_claims: ["劫煞主破财横祸", "必遭劫难", "血光"],
    never: "灾难恐吓",
  },
  亡神: {
    id: "亡神",
    frame: "收尾/失去/清空的主题张力；指向止损与哀悼节奏，非死亡预言。",
    user_facing_direction: "对失效事项做清晰告别与归档",
    load_or_edge: "易沉浸失落叙事",
    forbidden_claims: ["亡神主死人", "家有丧事", "本人将亡", "血光"],
    never: "死亡恐吓",
  },
  灾煞: {
    id: "灾煞",
    frame: "意外扰动与脆弱窗口；强调风控，不渲染宿命灾。",
    user_facing_direction: "高风险窗口降低赌注、提高检查频率",
    load_or_edge: "过度恐惧瘫痪行动",
    forbidden_claims: ["必有灾难", "天灾人祸", "血光之灾"],
    never: "灾难恐吓",
  },
  国印: {
    id: "国印",
    frame: "制度内信用与盖章势能；官僚摩擦仍在。",
    user_facing_direction: "用合规与书面化换信任",
    load_or_edge: "被流程绑死",
    forbidden_claims: ["国印主当官", "必掌印把子"],
    never: "官职铁口",
  },
  金舆: {
    id: "金舆",
    frame: "体面资源与被抬轿体验；依赖抬轿则脆弱。",
    user_facing_direction: "善用平台势能，保留自驱能力",
    load_or_edge: "虚荣消耗",
    forbidden_claims: ["金舆主豪门", "必嫁富"],
    never: "婚姻资产铁口",
  },
  天德: {
    id: "天德",
    frame: "缓和冲突、少踩雷的缓冲；不是免责金牌。",
    user_facing_direction: "冲突中先降级再决策",
    load_or_edge: "误以为可冒险无代价",
    forbidden_claims: ["天德化解一切灾", "有天德不怕"],
    never: "无敌护身符叙事",
  },
  月德: {
    id: "月德",
    frame: "人际回旋与被原谅空间；滥用会失信。",
    user_facing_direction: "用回旋空间修复关系，不重复踩线",
    load_or_edge: "惯性拖延道歉",
    forbidden_claims: ["月德免灾", "一生无灾"],
    never: "免灾保证",
  },
  福星贵人: {
    id: "福星贵人",
    frame: "小确幸与情绪回血通道；不能替代结构努力。",
    user_facing_direction: "安排可恢复的小奖励节奏",
    load_or_edge: "享乐逃避",
    forbidden_claims: ["福星照命大富大贵"],
    never: "富贵铁口",
  },
  太极贵人: {
    id: "太极贵人",
    frame: "思辨、抽象、贯通两端的能力；易想太多少落地。",
    user_facing_direction: "把洞察收成一个可测实验",
    load_or_edge: "空转思辨",
    forbidden_claims: ["太极贵人必悟道成仙"],
    never: "宗教神迹",
  },
  天医: {
    id: "天医",
    frame: "修复、照料、健康敏感度；不是医疗执照。",
    user_facing_direction: "重视恢复系统与专业求助边界",
    load_or_edge: "过度焦虑健康",
    forbidden_claims: ["天医可自愈百病", "不用看医生", "确诊"],
    never: "伪医疗",
  },
  学堂: {
    id: "学堂",
    frame: "入门学习窗口；入门≠精通。",
    user_facing_direction: "开辟结构化学习时段",
    load_or_edge: "证书堆砌",
    forbidden_claims: ["学堂主必成学者"],
    never: "学历铁口",
  },
  词馆: {
    id: "词馆",
    frame: "表达与专业输出通道；输出过量会空心。",
    user_facing_direction: "固定对外表达窗口",
    load_or_edge: "表演型疲倦",
    forbidden_claims: ["词馆主文豪命"],
    never: "文名铁口",
  },
  红鸾: {
    id: "红鸾",
    frame: "亲密关系启动/升温窗口；升温也需筛选。",
    user_facing_direction: "关系节点把期待说清楚",
    load_or_edge: "易冲动绑定",
    forbidden_claims: ["红鸾必结婚", "红鸾年必嫁娶", "克配偶"],
    never: "婚期铁口",
  },
  天喜: {
    id: "天喜",
    frame: "喜庆社交与公开认可窗口；热闹不等于深度支持。",
    user_facing_direction: "用公开节点巩固真实同盟",
    load_or_edge: "场面人情债",
    forbidden_claims: ["天喜主大喜临门必发财"],
    never: "喜事铁口",
  },
};

/** Resolve 羊刃 → 飞刃 for SSOT lookup. */
export function normalizeShenshaId(name: string): ClosedShenSha | null {
  const t = name.trim();
  if (t === "羊刃" || t === "飞刃") return "飞刃";
  if ((CLOSED_SHEN_SHA as readonly string[]).includes(t)) return t as ClosedShenSha;
  return null;
}

export function getShenshaRow(name: string): ShenshaSemanticRow | null {
  const id = normalizeShenshaId(name);
  return id ? SHENSHA_SEMANTIC_SSOT[id] : null;
}

export function collectShenshaHorrorPatterns(
  ids?: readonly string[],
): string[] {
  const out = new Set<string>(SHENSHA_SHARED_HORROR_CLAIMS);
  const list =
    ids && ids.length > 0
      ? ids
      : (CLOSED_SHEN_SHA as readonly string[]);
  for (const raw of list) {
    const row = getShenshaRow(raw);
    if (!row) continue;
    for (const c of row.forbidden_claims) out.add(c);
  }
  return [...out];
}

export function textHitsShenshaHorror(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  for (const p of collectShenshaHorrorPatterns()) {
    if (p && t.includes(p)) return p;
  }
  return null;
}

export function formatShenshaSemanticForPrompt(names: readonly string[]): string {
  const rows: ShenshaSemanticRow[] = [];
  for (const n of names) {
    const row = getShenshaRow(n);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return "";
  const lines = [
    "【神煞语义 SSOT · 内部 · 安全防火墙】",
    "只解释本盘列出的神煞；frame 含张力/代价，禁止恐吓宿命，禁止纯鸡汤美化。",
    "用户可见用方向语；真名仅依据层/内部。",
  ];
  for (const r of rows) {
    lines.push(
      `- ${r.id}: ${r.frame}｜方向:${r.user_facing_direction}｜边界:${r.load_or_edge || "—"}｜禁:${r.forbidden_claims.slice(0, 3).join("、")}`,
    );
  }
  return lines.join("\n");
}

/** Assert table covers closed set (tests / CI). */
export function assertShenshaSsotComplete(): void {
  for (const id of CLOSED_SHEN_SHA) {
    if (!SHENSHA_SEMANTIC_SSOT[id]) {
      throw new Error(`missing shensha ssot: ${id}`);
    }
  }
}
