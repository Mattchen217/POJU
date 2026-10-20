const fs=require("fs");
const p=fs.readFileSync("lib/i18n/pathname-without-locale.ts","utf8");
console.log(p);
