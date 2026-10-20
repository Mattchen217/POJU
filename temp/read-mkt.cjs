const fs=require("fs");
const t=fs.readFileSync("components/marketing/site-header.tsx","utf8");
console.log(t.slice(0,4000));
console.log("\n==== site-chrome ====\n");
console.log(fs.readFileSync("components/marketing/site-chrome.tsx","utf8").slice(0,3000));
