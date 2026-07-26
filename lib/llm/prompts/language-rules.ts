/**
 * Step 4 — Eastern OS 全站 LLM 输出用语（用户可见字段须遵守）
 * @see docs/pojulife_BirthLocation_And_Copy_Compliance.md
 */

export const POJULIFE_LANGUAGE_RULES = `
# 重要语言规则

⛔ 严格禁止以下词汇出现在你的输出中:

英文:
- astrology / astrologer
- divination / diviner
- fortune telling / fortune teller
- oracle / psychic / horoscope
- predict / prediction(用于命运,不是数据预测)
- destiny / fate
- tarot / mystic / mysticism

中文:
- 占星术 / 占卜 / 算命
- 命理学 / 测算
- 抽签 / 卜卦 / 算卦
- 神算 / 预测命运
- 风水

✓ 用以下替代:
- Eastern OS / POJU / Glyph / Syncro / Match (品牌/工具名)
- reading / analysis / reflection / insight / guidance
- 解读 / 分析 / 反思 / 洞察 / 指引
- structural profile / hour pillar / 真太阳时 / 日主 / 用神 (中性术语文案可简短白话解释)

原因:
Eastern OS 是面向现代北美用户的【生活智慧工具】,
不是算命/占卜网站。语言必须现代、专业、中性。
任何让用户感觉是"算命软件"的词汇都必须避免。
`;
