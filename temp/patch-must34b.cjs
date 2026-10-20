const fs = require("fs");

// FAQ FR: remaining product "chats"
const faqPath = "public/v2/faq-i18n.js";
let faq = fs.readFileSync(faqPath, "utf8");
const before = faq;
faq = faq.replace(
  "Le même login <strong>ne</strong> synchronise <strong>pas</strong> les chats entre navigateurs ou appareils.",
  "Le même login <strong>ne</strong> synchronise <strong>pas</strong> les conversations entre navigateurs ou appareils."
);
faq = faq.replace(
  "(les chats ne se synchronisent pas)",
  "(les conversations ne se synchronisent pas)"
);
if (faq === before) {
  console.log("WARN: faq-i18n.js patterns not found");
} else {
  fs.writeFileSync(faqPath, faq, "utf8");
  console.log("patched public/v2/faq-i18n.js");
}

// Hardcoded Welcome to Pivot
function patchFile(path, replacements) {
  let s = fs.readFileSync(path, "utf8");
  let n = 0;
  for (const [from, to] of replacements) {
    if (!s.includes(from)) {
      console.log("MISS in " + path + ": " + JSON.stringify(from).slice(0, 80));
      continue;
    }
    s = s.split(from).join(to);
    n++;
  }
  fs.writeFileSync(path, s, "utf8");
  console.log("patched " + path + " (" + n + " replacements)");
}

patchFile("components/poju/MessageBubble.tsx", [
  ['<p className="pchat__welcome-title">Welcome to Pivot</p>', '<p className="pchat__welcome-title">Welcome to Eastern OS</p>'],
]);

patchFile("components/chat/chat-page-client.tsx", [
  [">Welcome to Pivot</h3>", ">Welcome to Eastern OS</h3>"],
  [
    "I am POJU, blending ancient Eastern wisdom with modern clarity. Ask specific questions for guidance, or simply share your\n                thoughts. Your privacy is sacred here.",
    "Eastern OS uses the baseline structure calibrated from your birth coordinates to support this decision dialogue. For where you’re stuck right now, we’ll work through it step by step.",
  ],
]);

// Verify
const faq2 = fs.readFileSync(faqPath, "utf8");
const frHits = [...faq2.matchAll(/course|les chats|historique de chat|Ton chat/g)].map((m) => m[0]);
console.log("FAQ FR ban hits:", frHits);

const mb = fs.readFileSync("components/poju/MessageBubble.tsx", "utf8");
const cp = fs.readFileSync("components/chat/chat-page-client.tsx", "utf8");
console.log("MessageBubble still Pivot?", /Welcome to Pivot/.test(mb));
console.log("chat-page still Pivot?", /Welcome to Pivot/.test(cp));
