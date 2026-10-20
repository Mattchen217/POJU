const fs = require("fs");
const path = "public/v2-landing.html";
let html = fs.readFileSync(path, "utf8");
const start = html.indexOf("const TEAM_COPY");
if (start < 0) throw new Error("TEAM_COPY not found");
// Find zh team array: after TEAM_COPY, first "zh:" then "team:"
const zhKey = html.indexOf("zh:", start);
const teamKey = html.indexOf("team:", zhKey);
const arrStart = html.indexOf("[", teamKey);
// Find matching closing bracket for team array
let depth = 0, i = arrStart;
for (; i < html.length; i++) {
  const c = html[i];
  if (c === "[") depth++;
  else if (c === "]") {
    depth--;
    if (depth === 0) { i++; break; }
  }
}
const arrEnd = i;
let teamArr = html.slice(arrStart, arrEnd);
const roles = {
  "Max C.": "创始人兼首席执行官",
  "Arthur M.": "首席系统架构师",
  "Marcus T.": "首席算法与数据工程师",
  "Elena S.": "决策策略负责人",
  "Maya C.": "产品与体验负责人",
};
for (const [name, role] of Object.entries(roles)) {
  const re = new RegExp("(name:\\s*'" + name.replace(".", "\\.") + "',\\s*role:\\s*')([^']*)(')");
  if (!re.test(teamArr)) throw new Error("no match for " + name);
  teamArr = teamArr.replace(re, "$1" + role + "$3");
}
html = html.slice(0, arrStart) + teamArr + html.slice(arrEnd);
fs.writeFileSync(path, html, "utf8");
// verify
for (const role of Object.values(roles)) {
  if (!html.includes(role)) throw new Error("missing " + role);
}
console.log("ZH TEAM_COPY roles updated OK");
console.log("创始人兼首席执行官 present:", html.includes("创始人兼首席执行官"));
