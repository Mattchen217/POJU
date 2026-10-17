const EOS_LANDING_V2_COPY = {
  en: {
    heroEyebrow: "That decision won’t leave you alone.",
    heroH1: "Unstick it. Walk out with a path.",
    heroSub: "One stuck decision. A clear main path and a backup—you keep the final call. Leave with a report you’ll actually use.",
    ctaStart: "Start now",
    ctaSecondary: "What’s in one PASS",
    painTitle: "You’ve thought it to death",
    painBody: "More advice isn’t the missing piece. You need one focused pass that locks what you want, pressure-tests the paths, and ends in something you can act on tonight.",
    productTitle: "Eastern OS",
    productBody: "A multi-turn decision dialogue that ends in a real deliverable: conversation → decision report → optional 30-day same-line reminders.",
    productPrice: "<strong>$19.99</strong> = 1 PASS. Pack: <strong>$59.99 / 5 PASS</strong> (promos labeled separately).",
    productNote: "You buy the process and the deliverables—not a guaranteed life outcome. The decision stays yours.",
    howTitle: "From stuck → clear enough to move",
    step1Label: "Name it",
    step1Body: "Bring the decision that’s been looping.",
    step2Label: "Lock what “good” is",
    step2Body: "We aim the whole session at your expectation—not generic tips.",
    step3Label: "Pressure-test paths",
    step3Body: "Main route and backup get clear enough to choose.",
    step4Label: "Take it with you",
    step4Body: "Report in hand. Optional 30-day same-line reminders so it doesn’t fade.",
    docsTitle: "What you walk away with",
    doc1Title: "Decision list",
    doc1Body: "What to push, what to wait on, what to watch—for *this* call.",
    doc2Title: "Decision report",
    doc2Body: "Main path, backup, and how to move—written so you can use it today.",
    doc3Title: "30-day reminders",
    doc3Body: "Same-line check-ins so one good session doesn’t die in the scroll.",
    methodTitle: "Decision wisdom, not prediction",
    methodBody: "Built on ~3000 years of Eastern decision wisdom as a <strong>structural framework</strong>—timing, tradeoffs, consequence—turned into a modern decision dialogue. It sharpens how you choose. It does <strong>not</strong> predict fate or promise outcomes.",
    methodTag: "Digital decision-support software — structured dialogue + report. Not psychic or fortune-telling.",
    boundsTitle: "Straight talk",
    boundsBody: "Not medical, legal, or financial advice. Not fortune-telling. No guaranteed success, wealth, or relationship outcomes—you keep the call.",
    privacyTitle: "Stays on your device",
    privacyBody: "Conversation and reports live in <strong>this browser’s local storage</strong>. Account = PASS + billing, not chat history. Clear cache / new browser = gone unless you export or email it out.",
    ctaTitle: "Ready to unstick one decision?",
    ctaBody: "<strong>$19.99</strong> = 1 PASS: conversation → decision report → optional 30-day same-line reminders. Pack: <strong>$59.99 / 5 PASS</strong>.",
    ctaLegal: "Process + deliverables—not a guaranteed outcome. Decision stays yours. Not medical, legal, or financial advice."
  },
  zh: {
    heroEyebrow: "那个决定，一直在脑子里转。",
    heroH1: "破开它。带走一条能走的路。",
    heroSub: "一个卡住的决定。清晰的主路径和一条备用——最终决定仍在你。带走一份你会真用上的报告。",
    ctaStart: "马上开始",
    ctaSecondary: "一次 PASS 有什么",
    painTitle: "你已经想够久了",
    painBody: "缺的不是更多建议。你需要一次聚焦：钉住想要什么，压测路径，收成今晚就能用的东西。",
    productTitle: "Eastern OS",
    productBody: "多轮决策对话，收成真交付：对话 → 决策报告 → 可选 30 天同线提醒。",
    productPrice: "<strong>$19.99</strong> = 1 PASS。套装：<strong>$59.99 / 5 PASS</strong>（促销另标）。",
    productNote: "你买的是流程与交付物——不是人生结果保证。决定仍在你。",
    howTitle: "从卡住 → 清楚到能动手",
    step1Label: "说出来",
    step1Body: "把一直在转的那个决定拿出来。",
    step2Label: "钉住「好」长什么样",
    step2Body: "整场对准你的期望——不是泛泛鸡汤。",
    step3Label: "压测路径",
    step3Body: "主路线和备用清楚到你能选。",
    step4Label: "带走",
    step4Body: "报告在手。可选 30 天同线提醒，不让热度散掉。",
    docsTitle: "你带走什么",
    doc1Title: "决策清单",
    doc1Body: "该推、该等、该盯——只为这一次决定。",
    doc2Title: "决策报告",
    doc2Body: "主路径、备用、怎么走——写成今天就能用。",
    doc3Title: "30 天提醒",
    doc3Body: "同线回看，不让一次好对话死在刷屏里。",
    methodTitle: "决策智慧，不是预测",
    methodBody: "以约三千年东方决策智慧为<strong>结构框架</strong>——时机、取舍、后果——做成现代决策对话。帮你选得更清楚。<strong>不</strong>预言命运，也<strong>不</strong>承诺结果。",
    methodTag: "数字决策支持软件——结构化对话 + 报告。不是通灵或算命。",
    boundsTitle: "说清楚",
    boundsBody: "非医疗、法律或投资建议。非算命。不保证成功、暴富或感情结果——决定在你。",
    privacyTitle: "留在你这台设备",
    privacyBody: "对话与报告在<strong>当前浏览器本地</strong>。账号只管 PASS 与账单，不同步聊天。清缓存或换浏览器会丢——除非你导出或发邮件带走。",
    ctaTitle: "准备好破开一个卡住的决定？",
    ctaBody: "<strong>$19.99</strong> = 1 PASS：对话 → 决策报告 → 可选 30 天同线提醒。套装：<strong>$59.99 / 5 PASS</strong>。",
    ctaLegal: "流程与交付物——非结果保证。决定在你。非医疗、法律或投资建议。"
  }
};

            function applyEosLandingV2Copy(locale) {
              const pack = EOS_LANDING_V2_COPY[locale] || EOS_LANDING_V2_COPY.en;
              document.querySelectorAll("[data-eos-v2]").forEach((el) => {
                const key = el.getAttribute("data-eos-v2");
                if (!key || pack[key] == null) return;
                const val = pack[key];
                if (key === "productPrice" || key === "ctaBody" || key === "methodBody" || key === "privacyBody" || key === "heroH1") {
                  el.innerHTML = val;
                } else {
                  el.textContent = val;
                }
              });
            }
