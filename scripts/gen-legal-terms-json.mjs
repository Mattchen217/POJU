import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function buildEn() {
  const en = {
    meta: {
      title: "Terms of Service",
      version: "Version 1.0",
      updated: "Last updated: 2026-05-23",
    },
    closing:
      "By using pojulife, you acknowledge that you have read, understood, and agreed to these Terms of Service, our Privacy Policy, our Refund Policy, and our Disclaimer.",
    blocks: [],
  };
  en.blocks.push(
    { kind: "h2", text: "Operator" },
    {
      kind: "p",
      text: 'pojulife (pojulife.com) is operated by Tonghui Chen, an individual developer based in the People\'s Republic of China. In these Terms, "we", "us", and "our" refer to Tonghui Chen operating pojulife. For direct correspondence with the operator, email founder@pojulife.com.',
    },
  );
  const h2 = (text) => en.blocks.push({ kind: "h2", text });
  const h3 = (text) => en.blocks.push({ kind: "h3", text });
  const p = (text) => en.blocks.push({ kind: "p", text });
  const ul = (items) => en.blocks.push({ kind: "ul", items });

  h2("1. Use of services");
  p(
    'By accessing or using pojulife and its products — POJU, Glyph, Syncro, and Match (collectively, "the Services") — you agree to these Terms of Service ("Terms").',
  );
  p(
    "The Services provide AI-powered self-reflection and decision-support tools that draw on Eastern philosophical frameworks and modern psychology research. The Services are for lawful, personal use only and are intended for users 18 years of age or older.",
  );
  p("You agree not to:");
  ul([
    "Use the Services for commercial purposes without prior written permission.",
    "Attempt to reverse-engineer, scrape, decompile, or systematically access the Services.",
    "Use the Services to harass, defame, or harm others.",
    "Submit illegal, threatening, or harmful content.",
    "Impersonate others or misrepresent your identity.",
    "Use the Services in any way that violates applicable laws or regulations.",
  ]);

  h2("2. Nature of the services");
  p(
    "The Services produce reflective text using artificial intelligence. Outputs are designed for personal exploration and self-reflection. They do not constitute:",
  );
  ul([
    "Medical, mental health, legal, financial, or other professional advice.",
    "Predictions of future events or outcomes.",
    "Guarantees of specific results.",
  ]);
  en.blocks.push({
    kind: "linkP",
    before: "See our Disclaimer at ",
    linkHref: "/disclaimer",
    linkLabel: "Disclaimer",
    after: " for full details.",
  });
  p(
    "You acknowledge that AI-generated outputs are inherently probabilistic and may contain errors. You agree to apply your own judgment to anything the Services produce.",
  );

  h2("3. Payments");
  h3("Pricing");
  ul([
    "POJU: US$9.99 per session, charged once. Each session provides 30 days of access to your conversation.",
    "Glyph: First reading is free. Each subsequent reading is US$4.99, charged once per reading.",
    "Syncro: First 24-hour window is free. Each subsequent window is US$4.99, charged once per window.",
    "Match: First reading is free. Each subsequent reading is US$4.99, charged once per reading.",
  ]);
  h3("No subscriptions");
  p(
    "All payments are one-time only. There are no subscriptions, no automatic renewals, and no recurring charges of any kind.",
  );
  h3("Price changes");
  p("Prices may change in the future. You will always see the current price before completing any payment.");
  h3("Payment processing");
  p(
    "Payments are processed by Dodo Payments as the merchant of record. We do not store your full payment card details.",
  );
  h3("What you receive");
  ul([
    "POJU: 30-day access to your conversation, saved locally on your device.",
    "Glyph / Match: Your complete reading, displayed on screen and optionally delivered as a PDF.",
    "Syncro: 24-hour live access to direction-by-hour guidance for one specified task.",
  ]);

  h2("4. Refunds");
  en.blocks.push({
    kind: "linkP",
    before: "We offer refunds under the conditions described in our Refund Policy: ",
    linkHref: "/refund",
    linkLabel: "Refund Policy",
    after: ".",
  });
  p("In summary:");
  ul([
    "Full refund for technical failures (within 7 days).",
    "Full refund for unused POJU sessions (within 24 hours).",
    "Full refund for duplicate or unauthorized charges (any time).",
    "No refunds for dissatisfaction with AI outputs or changes of mind after delivery.",
  ]);
  p("To request a refund, email support@pojulife.com.");

  h2("5. Intellectual property");
  h3("Our property");
  p(
    "The pojulife brand, logos, taglines, written content, product interfaces, and the Five Wind cards (Divine Tailwind, Fair Sky, Still Water, Crosswind, Eye of Storm) and the Five Current categories (Open Current, Following Current, Stillwater, Crosscurrent, Undertow) are proprietary to pojulife. You may not copy, modify, or redistribute them.",
  );
  h3("Your content");
  p(
    "Reflective text generated for your personal Session (e.g., AI responses, PDF reports) is yours to use personally. You may not:",
  );
  ul([
    "Republish AI-generated outputs as your own work.",
    "Use AI outputs for commercial purposes.",
    "Mass-distribute AI outputs to others.",
  ]);
  h3("Public domain references");
  p(
    "Classical philosophical works referenced by the Services (e.g., the I Ching, traditional bazi commentary) are in the public domain. pojulife does not claim exclusive rights over traditional ideas or texts.",
  );

  h2("6. Account and data");
  p("The Services are designed to work without traditional user accounts:");
  ul([
    "No login is required to use the Services.",
    "Your conversations and readings are encrypted and stored locally on your device.",
  ]);
  en.blocks.push({
    kind: "linkP",
    before: "We collect minimal data — see our ",
    linkHref: "/privacy",
    linkLabel: "Privacy Policy",
    after: ".",
  });
  p(
    "You are responsible for the security of your device. We are not liable for loss of data resulting from device loss, damage, browser clearing, or similar events. You may export PDFs of important readings before such events.",
  );

  h2("7. Limitation of liability");
  p("To the maximum extent permitted by law:");
  ul([
    'The Services are provided "as is" and "as available," without warranties of any kind.',
    "We are not liable for any decisions, actions, or outcomes resulting from your use of the Services.",
    "We are not liable for indirect, incidental, consequential, or punitive damages.",
    "Our total cumulative liability in any claim is limited to the total amount you paid to pojulife in the preceding 12 months — typically US$9.99 to US$30.00.",
  ]);
  p("See our Disclaimer for additional limitations.");

  h2("8. Changes to these Terms");
  p("We may update these Terms to reflect changes in our Services, technology, or applicable law.");
  p("For material changes (e.g., new fees, significant restrictions, changes to refund eligibility):");
  ul([
    "We will notify you via an in-app banner on your next visit.",
    "Continued use after the change constitutes acceptance.",
    "If you do not agree, you may discontinue use.",
  ]);
  p("For minor changes (typo corrections, clarifications):");
  ul(['We will update the "Last updated" date.', "No active notification is required."]);

  h2("9. Governing law");
  p(
    "These Terms are governed by the laws of the People's Republic of China, without regard to conflict-of-law principles.",
  );
  p(
    "Any disputes arising from or related to these Terms or the Services shall be submitted to the courts with jurisdiction in the operator's place of residence in China, unless mandatory consumer protection law in your jurisdiction requires otherwise.",
  );
  p(
    "If you are located in the European Union, the United Kingdom, or another jurisdiction with mandatory consumer protection laws, your statutory rights remain intact.",
  );

  h2("10. Termination");
  p("We reserve the right to terminate or suspend access to the Services at our discretion, particularly for:");
  ul([
    "Violations of these Terms.",
    "Fraudulent activity.",
    "Use of the Services in a way that harms other users or the platform.",
  ]);
  p("Termination does not affect:");
  ul([
    "Refund obligations under our Refund Policy.",
    "Your right to data deletion under our Privacy Policy.",
  ]);

  h2("11. Contact");
  en.blocks.push({
    kind: "contact",
    lines: [
      { label: "Questions about these Terms:", email: "legal@pojulife.com" },
      { label: "General support:", email: "support@pojulife.com" },
      { label: "Privacy and data:", email: "privacy@pojulife.com" },
    ],
  });
  p("We do not publish a physical mailing address on this website. Physical address: [Available upon request — email legal@pojulife.com]");

  return en;
}

function buildZh() {
  const zh = {
    meta: {
      title: "服务条款",
      version: "版本 1.0",
      updated: "最后更新：2026-05-23",
    },
    closing:
      "使用 pojulife 即表示你已阅读、理解并同意本服务条款、我们的隐私政策、退款政策和免责声明。",
    blocks: [],
  };
  zh.blocks.push(
    { kind: "h2", text: "运营方" },
    {
      kind: "p",
      text: "pojulife（pojulife.com）由位于中华人民共和国境内的个人开发者陈同辉运营。在本条款中，「我们」「我方」指运营 pojulife 的陈同辉。如需直接联系运营者，请发邮件至 founder@pojulife.com。",
    },
  );
  const h2 = (text) => zh.blocks.push({ kind: "h2", text });
  const h3 = (text) => zh.blocks.push({ kind: "h3", text });
  const p = (text) => zh.blocks.push({ kind: "p", text });
  const ul = (items) => zh.blocks.push({ kind: "ul", items });

  h2("1. 服务的使用");
  p(
    "通过访问或使用 pojulife 及其产品 —— POJU、Glyph、Syncro 和 Match（统称「服务」）—— 即表示你同意本服务条款（「条款」）。",
  );
  p(
    "本服务提供基于人工智能的自我反思与决策支持工具，借鉴东方哲学框架与现代心理学研究。本服务仅供合法、个人使用，面向 18 岁及以上的用户。",
  );
  p("你同意不会：");
  ul([
    "未经事先书面许可，将服务用于商业目的。",
    "试图反向工程、抓取、反编译或系统性访问服务。",
    "使用服务骚扰、诽谤或伤害他人。",
    "提交非法、威胁性或有害的内容。",
    "冒充他人或谎称身份。",
    "以任何违反适用法律或法规的方式使用服务。",
  ]);

  h2("2. 服务的性质");
  p("本服务通过人工智能生成反思性文字。输出旨在用于个人探索与自我反思。它们不构成：");
  ul([
    "医疗、心理健康、法律、金融或其他专业建议。",
    "对未来事件或结果的预测。",
    "任何特定结果的保证。",
  ]);
  zh.blocks.push({
    kind: "linkP",
    before: "完整说明见我们的",
    linkHref: "/disclaimer",
    linkLabel: "免责声明",
    after: "。",
  });
  p("你承认 AI 生成的输出本质上具有概率性，可能包含错误。你同意对服务生成的任何内容运用你自己的判断。");

  h2("3. 付款");
  h3("定价");
  ul([
    "POJU：每次会话 US$9.99，一次性扣款。每次会话提供 30 天对话访问期。",
    "Glyph：首次解读免费。之后每次解读 US$4.99，按次一次性扣款。",
    "Syncro：首个 24 小时窗口免费。之后每个窗口 US$4.99，按窗口一次性扣款。",
    "Match：首次解读免费。之后每次解读 US$4.99，按次一次性扣款。",
  ]);
  h3("无订阅");
  p("所有付款均为一次性。没有订阅、没有自动续费，也没有任何形式的定期扣款。");
  h3("价格变更");
  p("价格未来可能调整。你在完成任何付款前都会看到当前价格。");
  h3("支付处理");
  p("付款由 Dodo Payments 作为商户记录（Merchant of Record）处理。我们不存储你的完整支付卡信息。");
  h3("你将获得");
  ul([
    "POJU：30 天对话访问期，保存在你设备本地。",
    "Glyph / Match：完整解读，在屏幕上显示，并可选择以 PDF 交付。",
    "Syncro：24 小时实时访问，针对一项指定任务提供按小时方向指引。",
  ]);

  h2("4. 退款");
  zh.blocks.push({
    kind: "linkP",
    before: "我们在",
    linkHref: "/refund",
    linkLabel: "退款政策",
    after: "所述条件下提供退款。",
  });
  p("摘要：");
  ul([
    "技术故障（7 天内）全额退款。",
    "未使用的 POJU 会话（24 小时内）全额退款。",
    "重复或未授权扣款（随时）全额退款。",
    "对 AI 输出的不满或交付后的反悔不予退款。",
  ]);
  p("申请退款请发邮件至 support@pojulife.com。");

  h2("5. 知识产权");
  h3("我们的财产");
  p(
    "pojulife 品牌、标识、标语、书面内容、产品界面，以及五风牌（神风、晴空、静水、横风、风暴眼）与五流类别（顺流、随流、静水、横流、暗流）归 pojulife 所有。你不得复制、修改或再分发。",
  );
  h3("你的内容");
  p("为你的个人会话生成的反思文字（如 AI 回复、PDF 报告）供你个人使用。你不得：");
  ul([
    "将 AI 生成内容作为你自己的作品再发布。",
    "将 AI 输出用于商业目的。",
    "向他人大规模分发 AI 输出。",
  ]);
  h3("公有领域引用");
  p(
    "服务引用的古典哲学作品（如《易经》、传统八字注疏）处于公有领域。pojulife 不对传统思想或文本主张独占权利。",
  );

  h2("6. 账户与数据");
  p("服务设计为无需传统用户账户：");
  ul(["使用服务无需登录。", "你的对话与解读经加密后保存在你设备本地。"]);
  zh.blocks.push({
    kind: "linkP",
    before: "我们收集最少数据 —— 见我们的",
    linkHref: "/privacy",
    linkLabel: "隐私政策",
    after: "。",
  });
  p(
    "你负责自己设备的安全。我们不对因设备丢失、损坏、浏览器清理等导致的数据丢失负责。你可在此类事件前导出重要解读的 PDF。",
  );

  h2("7. 责任限制");
  p("在适用法律允许的最大范围内：");
  ul([
    "服务按「现状」和「可用性」提供，不作任何保证。",
    "我们不对因你使用服务而产生的任何决定、行动或结果负责。",
    "我们不对间接、附带、后果性或惩罚性损害负责。",
    "我们在任何索赔中的累计总责任限于你在过去 12 个月内向 pojulife 支付的总金额 —— 通常为 US$9.99 至 US$30.00。",
  ]);
  p("其他限制见我们的免责声明。");

  h2("8. 条款变更");
  p("我们可能会更新本条款，以反映服务、技术或适用法律的变化。");
  p("对于重大变更（如新费用、重大限制、退款资格变更）：");
  ul([
    "我们将在你下次访问时通过应用内横幅通知你。",
    "变更后继续使用即表示接受。",
    "如你不同意，可以停止使用。",
  ]);
  p("对于次要变更（错别字修正、澄清）：");
  ul(["我们将更新「最后更新」日期。", "不需要主动通知。"]);

  h2("9. 适用法律");
  p("本条款受中华人民共和国法律管辖，不考虑法律冲突原则。");
  p(
    "因本条款或服务产生或相关的任何争议，应提交至运营方在中国境内住所地有管辖权的人民法院解决，除非你所在司法管辖区的强制性消费者保护法另有要求。",
  );
  p(
    "如果你位于欧盟、英国或其他具有强制性消费者保护法的司法管辖区，你的法定权利保持不变。",
  );

  h2("10. 终止");
  p("我们保留自行决定终止或暂停服务访问的权利，特别是针对：");
  ul(["违反本条款。", "欺诈活动。", "以伤害其他用户或平台的方式使用服务。"]);
  p("终止不影响：");
  ul(["退款政策下的退款义务。", "隐私政策下你的数据删除权。"]);

  h2("11. 联系");
  zh.blocks.push({
    kind: "contact",
    lines: [
      { label: "关于本条款的问题：", email: "legal@pojulife.com" },
      { label: "一般支持：", email: "support@pojulife.com" },
      { label: "隐私与数据：", email: "privacy@pojulife.com" },
    ],
  });
  p("本站不公开物理邮寄地址。物理地址：[应要求提供 — 请发邮件至 legal@pojulife.com]");

  return zh;
}

fs.writeFileSync(path.join(root, "messages/en/terms.json"), `${JSON.stringify(buildEn(), null, 2)}\n`);
fs.writeFileSync(path.join(root, "messages/zh/terms.json"), `${JSON.stringify(buildZh(), null, 2)}\n`);
console.log("wrote terms.json en + zh");
