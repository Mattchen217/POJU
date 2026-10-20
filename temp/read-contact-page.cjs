const fs=require("fs");
const page=fs.readFileSync("app/[locale]/contact/page.tsx","utf8");
console.log(page);
