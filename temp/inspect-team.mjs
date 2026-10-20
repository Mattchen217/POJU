const fs=require("fs");
const html=fs.readFileSync("public/v2-landing.html","utf8");
const idx=html.indexOf("TEAM_COPY");
console.log("TEAM_COPY idx", idx);
const slice=html.slice(idx, idx+12000);
fs.writeFileSync("temp/team_slice.js", slice, "utf8");
console.log("slice bytes", slice.length);
// find zh roles
const zhStart=slice.indexOf("zh:");
console.log("zh in slice", zhStart);
const names=["Max C.","Arthur M.","Marcus T.","Elena S.","Maya C."];
for (const n of names) {
  const i=slice.indexOf(n);
  console.log(n, "at", i, "context:", JSON.stringify(slice.slice(Math.max(0,i-20), i+80)));
}
